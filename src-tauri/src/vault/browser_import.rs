use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

use html_escape::decode_html_entities;
use regex::Regex;
use serde::{Deserialize, Serialize};
use url::Url;
use uuid::Uuid;

use super::{
    model::{
        BookmarkRecord, BrowserBookmarkImportRequest, BrowserBookmarkSource, EntryKind,
        HtmlBookmarkFile, SiteRecord, VaultPayload,
    },
    service::{normalize_url, now_iso},
};

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserBookmarkImportPreview {
    pub discovered_bookmark_count: usize,
    pub importable_bookmark_count: usize,
    pub skipped_invalid_count: usize,
    pub skipped_duplicate_count: usize,
    pub new_site_count: usize,
    pub existing_site_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserBookmarkImportResult {
    pub preview: BrowserBookmarkImportPreview,
    pub added_bookmark_count: usize,
}

#[derive(Debug, Clone)]
struct DiscoveredSource {
    descriptor: BrowserBookmarkSource,
    path: PathBuf,
    kind: SourceKind,
}

#[derive(Debug, Clone, Copy)]
enum SourceKind {
    Chromium,
    Firefox,
}

#[derive(Debug, Clone)]
pub(crate) struct BrowserBookmarkImportPlan {
    pub preview: BrowserBookmarkImportPreview,
    pub sites: Vec<PlannedSite>,
}

#[derive(Debug, Clone)]
pub(crate) struct PlannedSite {
    pub domain: String,
    pub bookmarks: Vec<PlannedBookmark>,
}

#[derive(Debug, Clone)]
pub(crate) struct PlannedBookmark {
    pub title: String,
    pub url: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct RawBookmark {
    pub title: String,
    pub url: String,
    pub folder_path: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ChromiumBookmarkFile {
    roots: BTreeMap<String, ChromiumBookmarkNode>,
}

#[derive(Debug, Deserialize)]
struct ChromiumBookmarkNode {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    children: Vec<ChromiumBookmarkNode>,
}

pub(crate) fn plan_browser_bookmark_import(
    request: &BrowserBookmarkImportRequest,
    existing_sites: &[SiteRecord],
) -> Result<BrowserBookmarkImportPlan, String> {
    let mut raw_bookmarks = Vec::new();
    let sources = discover_sources();
    for source_id in &request.source_ids {
        let source = sources
            .iter()
            .find(|source| source.descriptor.id == *source_id)
            .ok_or_else(|| "所选浏览器书签来源已不可用，请刷新后重试。".to_string())?;
        raw_bookmarks.extend(read_discovered_source(source)?);
    }
    for file in &request.html_files {
        raw_bookmarks.extend(parse_netscape_html(file)?);
    }
    Ok(clean_bookmarks(raw_bookmarks, existing_sites))
}

pub(crate) fn discover_browser_bookmark_sources() -> Vec<BrowserBookmarkSource> {
    discover_sources()
        .into_iter()
        .map(|source| source.descriptor)
        .collect()
}

pub(crate) fn merge_browser_bookmark_import(
    payload: &mut VaultPayload,
    request: &BrowserBookmarkImportRequest,
) -> Result<BrowserBookmarkImportResult, String> {
    let plan = plan_browser_bookmark_import(request, &payload.sites)?;
    let mut added_bookmark_count = 0;
    for planned_site in &plan.sites {
        let now = now_iso();
        let site = if let Some(existing) = payload.sites.iter_mut().find(|site| {
            site.kind == EntryKind::Site && site.domain.eq_ignore_ascii_case(&planned_site.domain)
        }) {
            existing
        } else {
            payload.sites.push(SiteRecord {
                id: Uuid::new_v4().to_string(),
                kind: EntryKind::Site,
                name: planned_site.domain.clone(),
                domain: planned_site.domain.clone(),
                description: String::new(),
                tags: Vec::new(),
                accent: "#1D4ED8".to_string(),
                favorite: false,
                created_at: now.clone(),
                updated_at: now.clone(),
                bookmarks: Vec::new(),
                credentials: Vec::new(),
            });
            payload.sites.last_mut().expect("site was just pushed")
        };

        for planned_bookmark in &planned_site.bookmarks {
            for tag in &planned_bookmark.tags {
                if !site.tags.iter().any(|existing| existing == tag) {
                    site.tags.push(tag.clone());
                }
            }
            site.bookmarks.push(BookmarkRecord {
                id: Uuid::new_v4().to_string(),
                title: planned_bookmark.title.clone(),
                url: planned_bookmark.url.clone(),
                description: String::new(),
                pinned: false,
                created_at: now.clone(),
                updated_at: now.clone(),
            });
            added_bookmark_count += 1;
        }
        site.updated_at = now;
    }
    Ok(BrowserBookmarkImportResult {
        preview: plan.preview,
        added_bookmark_count,
    })
}

pub(crate) fn parse_chromium_bookmarks(contents: &str) -> Result<Vec<RawBookmark>, String> {
    let file = serde_json::from_str::<ChromiumBookmarkFile>(contents)
        .map_err(|_| "浏览器书签文件格式无效。".to_string())?;
    let mut bookmarks = Vec::new();
    for root in file.roots.into_values() {
        let mut folder_path = Vec::new();
        collect_chromium_bookmarks(&root, &mut folder_path, &mut bookmarks);
    }
    Ok(bookmarks)
}

fn discover_sources() -> Vec<DiscoveredSource> {
    let mut sources = Vec::new();
    for (browser, root) in chromium_roots() {
        let Ok(profiles) = fs::read_dir(root) else {
            continue;
        };
        for profile in profiles.flatten() {
            let bookmarks = profile.path().join("Bookmarks");
            if bookmarks.is_file() {
                let profile_name = profile.file_name().to_string_lossy().to_string();
                sources.push(discovered_source(
                    browser,
                    profile_name,
                    "chromium-json",
                    bookmarks,
                    SourceKind::Chromium,
                ));
            }
        }
    }

    for root in firefox_roots() {
        let Ok(profiles) = fs::read_dir(root) else {
            continue;
        };
        for profile in profiles.flatten() {
            let places = profile.path().join("places.sqlite");
            if places.is_file() {
                sources.push(discovered_source(
                    "Firefox",
                    profile.file_name().to_string_lossy().to_string(),
                    "firefox-sqlite",
                    places,
                    SourceKind::Firefox,
                ));
            }
        }
    }
    sources.sort_by(|left, right| left.descriptor.id.cmp(&right.descriptor.id));
    sources
}

fn discovered_source(
    browser: &str,
    profile: String,
    format: &str,
    path: PathBuf,
    kind: SourceKind,
) -> DiscoveredSource {
    let safe_profile = profile.trim().to_string();
    DiscoveredSource {
        descriptor: BrowserBookmarkSource {
            id: format!("{browser}:{safe_profile}:{format}"),
            browser: browser.to_string(),
            profile: safe_profile,
            format: format.to_string(),
        },
        path,
        kind,
    }
}

fn chromium_roots() -> Vec<(&'static str, PathBuf)> {
    if cfg!(target_os = "windows") {
        let Some(root) = dirs::data_local_dir() else {
            return Vec::new();
        };
        return vec![
            ("Chrome", root.join("Google/Chrome/User Data")),
            ("Edge", root.join("Microsoft/Edge/User Data")),
        ];
    }
    if cfg!(target_os = "macos") {
        let Some(home) = dirs::home_dir() else {
            return Vec::new();
        };
        return vec![
            (
                "Chrome",
                home.join("Library/Application Support/Google/Chrome"),
            ),
            (
                "Edge",
                home.join("Library/Application Support/Microsoft Edge"),
            ),
        ];
    }
    let Some(config) = dirs::config_dir() else {
        return Vec::new();
    };
    vec![
        ("Chrome", config.join("google-chrome")),
        ("Edge", config.join("microsoft-edge")),
    ]
}

fn firefox_roots() -> Vec<PathBuf> {
    if cfg!(target_os = "windows") {
        return dirs::config_dir()
            .map(|root| vec![root.join("Mozilla/Firefox/Profiles")])
            .unwrap_or_default();
    }
    if cfg!(target_os = "macos") {
        return dirs::home_dir()
            .map(|home| vec![home.join("Library/Application Support/Firefox/Profiles")])
            .unwrap_or_default();
    }
    dirs::home_dir()
        .map(|home| vec![home.join(".mozilla/firefox")])
        .unwrap_or_default()
}

fn read_discovered_source(source: &DiscoveredSource) -> Result<Vec<RawBookmark>, String> {
    match source.kind {
        SourceKind::Chromium => {
            let contents = fs::read_to_string(&source.path)
                .map_err(|_| "无法读取浏览器书签文件。".to_string())?;
            parse_chromium_bookmarks(&contents)
        }
        SourceKind::Firefox => read_firefox_bookmarks(&source.path),
    }
}

pub(crate) fn read_firefox_bookmarks(path: &Path) -> Result<Vec<RawBookmark>, String> {
    let copy = TemporaryFirefoxDatabase::copy_from(path)?;
    let connection = rusqlite::Connection::open_with_flags(
        copy.database_path(),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|_| "无法打开 Firefox 书签数据库。".to_string())?;

    let mut folders = HashMap::<i64, (i64, String)>::new();
    let mut statement = connection
        .prepare("SELECT id, parent, title FROM moz_bookmarks WHERE type = 2")
        .map_err(|_| "无法读取 Firefox 书签目录。".to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|_| "无法读取 Firefox 书签目录。".to_string())?;
    for row in rows.flatten() {
        folders.insert(row.0, (row.1, row.2.unwrap_or_default()));
    }

    let mut statement = connection
        .prepare(
            "SELECT b.parent, b.title, p.url FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1 AND p.url IS NOT NULL",
        )
        .map_err(|_| "无法读取 Firefox 书签。".to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|_| "无法读取 Firefox 书签。".to_string())?;
    let mut bookmarks = Vec::new();
    for row in rows.flatten() {
        bookmarks.push(RawBookmark {
            title: row.1.unwrap_or_default(),
            url: row.2,
            folder_path: firefox_folder_path(row.0, &folders),
        });
    }
    Ok(bookmarks)
}

fn firefox_folder_path(parent: i64, folders: &HashMap<i64, (i64, String)>) -> Vec<String> {
    let mut path = Vec::new();
    let mut current = parent;
    let mut visited = HashSet::new();
    while visited.insert(current) {
        let Some((next, title)) = folders.get(&current) else {
            break;
        };
        if !title.trim().is_empty() {
            path.push(title.trim().to_string());
        }
        current = *next;
    }
    path.reverse();
    path
}

struct TemporaryFirefoxDatabase {
    directory: PathBuf,
}

impl TemporaryFirefoxDatabase {
    fn copy_from(path: &Path) -> Result<Self, String> {
        let directory = std::env::temp_dir().join(format!("mkey-bookmarks-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory)
            .map_err(|_| "无法创建 Firefox 书签临时副本。".to_string())?;
        let copy = Self { directory };
        for suffix in ["", "-wal", "-shm"] {
            let source = PathBuf::from(format!("{}{}", path.display(), suffix));
            if source.exists() {
                fs::copy(
                    &source,
                    copy.database_path()
                        .with_file_name(format!("places.sqlite{suffix}")),
                )
                .map_err(|_| "无法复制 Firefox 书签数据库。".to_string())?;
            }
        }
        Ok(copy)
    }

    fn database_path(&self) -> PathBuf {
        self.directory.join("places.sqlite")
    }
}

impl Drop for TemporaryFirefoxDatabase {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

fn collect_chromium_bookmarks(
    node: &ChromiumBookmarkNode,
    folder_path: &mut Vec<String>,
    bookmarks: &mut Vec<RawBookmark>,
) {
    match node.kind.as_str() {
        "url" => {
            if let Some(url) = node.url.as_ref() {
                bookmarks.push(RawBookmark {
                    title: node.name.trim().to_string(),
                    url: url.trim().to_string(),
                    folder_path: folder_path.clone(),
                });
            }
        }
        "folder" => {
            let pushed = if node.name.trim().is_empty() {
                false
            } else {
                folder_path.push(node.name.trim().to_string());
                true
            };
            for child in &node.children {
                collect_chromium_bookmarks(child, folder_path, bookmarks);
            }
            if pushed {
                folder_path.pop();
            }
        }
        _ => {}
    }
}

fn parse_netscape_html(file: &HtmlBookmarkFile) -> Result<Vec<RawBookmark>, String> {
    if file.contents.trim().is_empty() {
        return Err(format!("{} 不是有效的书签导出文件。", file.name));
    }

    let token = Regex::new(
        r#"(?is)<\s*(?P<closing>/)?\s*(?P<tag>h3|a|dl)\b(?P<attrs>[^>]*)>|(?P<text>[^<]+)"#,
    )
    .expect("bookmark HTML token regex is valid");
    let href = Regex::new(
        r#"(?is)\bhref\s*=\s*(?:\"(?P<double>[^\"]*)\"|'(?P<single>[^']*)'|(?P<bare>[^\s>]+))"#,
    )
    .expect("bookmark href regex is valid");

    let mut folder_path = Vec::new();
    let mut pending_folder = None;
    let mut heading = None::<String>;
    let mut anchor = None::<(String, String)>;
    let mut bookmarks = Vec::new();

    for captures in token.captures_iter(&file.contents) {
        if let Some(text) = captures.name("text") {
            let decoded = decode_html_entities(text.as_str()).trim().to_string();
            if decoded.is_empty() {
                continue;
            }
            if let Some(current) = heading.as_mut() {
                current.push_str(&decoded);
            } else if let Some((_, current)) = anchor.as_mut() {
                current.push_str(&decoded);
            }
            continue;
        }

        let tag = captures
            .name("tag")
            .expect("tag exists when this is not text")
            .as_str()
            .to_ascii_lowercase();
        let closing = captures.name("closing").is_some();
        let attrs = captures.name("attrs").map_or("", |value| value.as_str());

        match (tag.as_str(), closing) {
            ("h3", false) => heading = Some(String::new()),
            ("h3", true) => {
                pending_folder = heading.take().map(|value| value.trim().to_string());
            }
            ("dl", false) => {
                if let Some(folder) = pending_folder.take().filter(|value| !value.is_empty()) {
                    folder_path.push(folder);
                }
            }
            ("dl", true) => {
                folder_path.pop();
                pending_folder = None;
            }
            ("a", false) => {
                let url = href
                    .captures(attrs)
                    .and_then(|match_| {
                        match_
                            .name("double")
                            .or_else(|| match_.name("single"))
                            .or_else(|| match_.name("bare"))
                    })
                    .map(|value| decode_html_entities(value.as_str()).trim().to_string());
                if let Some(url) = url {
                    anchor = Some((url, String::new()));
                }
            }
            ("a", true) => {
                if let Some((url, title)) = anchor.take() {
                    bookmarks.push(RawBookmark {
                        title: title.trim().to_string(),
                        url,
                        folder_path: folder_path.clone(),
                    });
                }
            }
            _ => {}
        }
    }

    Ok(bookmarks)
}

fn clean_bookmarks(
    raw_bookmarks: Vec<RawBookmark>,
    existing_sites: &[SiteRecord],
) -> BrowserBookmarkImportPlan {
    let mut preview = BrowserBookmarkImportPreview {
        discovered_bookmark_count: raw_bookmarks.len(),
        ..Default::default()
    };
    let mut existing_urls = HashSet::new();
    let mut existing_domains = HashSet::new();
    for site in existing_sites {
        existing_domains.insert(site.domain.to_ascii_lowercase());
        for bookmark in &site.bookmarks {
            if let Ok(url) = normalize_url(&bookmark.url) {
                existing_urls.insert(url);
            }
        }
    }

    let mut seen_urls = existing_urls;
    let mut grouped = BTreeMap::<String, Vec<PlannedBookmark>>::new();
    for raw in raw_bookmarks {
        let Ok(parsed) = Url::parse(raw.url.trim()) else {
            preview.skipped_invalid_count += 1;
            continue;
        };
        if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
            preview.skipped_invalid_count += 1;
            continue;
        }
        let Ok(url) = normalize_url(raw.url.as_str()) else {
            preview.skipped_invalid_count += 1;
            continue;
        };
        if !seen_urls.insert(url.clone()) {
            preview.skipped_duplicate_count += 1;
            continue;
        }
        let domain = parsed
            .host_str()
            .expect("host was checked above")
            .to_ascii_lowercase();
        let title = if raw.title.trim().is_empty() {
            domain.clone()
        } else {
            raw.title.trim().to_string()
        };
        let tags = normalize_tags(raw.folder_path);
        grouped
            .entry(domain)
            .or_default()
            .push(PlannedBookmark { title, url, tags });
        preview.importable_bookmark_count += 1;
    }

    preview.new_site_count = grouped
        .keys()
        .filter(|domain| !existing_domains.contains(*domain))
        .count();
    preview.existing_site_count = grouped.len() - preview.new_site_count;
    BrowserBookmarkImportPlan {
        preview,
        sites: grouped
            .into_iter()
            .map(|(domain, bookmarks)| PlannedSite { domain, bookmarks })
            .collect(),
    }
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    tags.into_iter()
        .map(|tag| tag.trim().to_string())
        .filter(|tag| !tag.is_empty())
        .filter(|tag| seen.insert(tag.clone()))
        .collect()
}
