use std::collections::HashSet;

use chrono::Utc;
use rand::rngs::OsRng;
use rand::{seq::SliceRandom, RngCore};
use url::Url;
use uuid::Uuid;

use super::crypto::{password_strength, PasswordStrength};
use super::model::{
    BookmarkInput, BookmarkRecord, CredentialInput, CredentialRecord, EntryKind, SiteInput,
    SiteRecord, VaultPayload, VaultSnapshot, VaultStats,
};

const DEFAULT_PASSWORD_LENGTH: usize = 18;
const DEFAULT_ACCENT: &str = "#1D4ED8";

pub(crate) fn upsert_site(payload: &mut VaultPayload, site: SiteInput) -> Result<(), String> {
    let now = now_iso();
    let normalized_tags = normalize_tags(site.tags);
    let normalized_domain = normalize_domain(&site.domain, site.kind)?;
    let accent = normalize_accent(&site.accent);
    let description = normalize_text(&site.description);
    let name = non_empty_text(&site.name, "条目名称不能为空。")?;

    if let Some(existing) = payload
        .sites
        .iter_mut()
        .find(|current| matches_id(current.id.as_str(), site.id.as_deref()))
    {
        existing.kind = site.kind;
        existing.name = name;
        existing.domain = normalized_domain;
        existing.description = description;
        existing.tags = normalized_tags;
        existing.accent = accent;
        existing.favorite = site.favorite;
        if existing.kind == EntryKind::Folder {
            existing.bookmarks.clear();
        }
        existing.updated_at = now;
    } else {
        payload.sites.push(SiteRecord {
            id: Uuid::new_v4().to_string(),
            kind: site.kind,
            name,
            domain: normalized_domain,
            description,
            tags: normalized_tags,
            accent,
            favorite: site.favorite,
            created_at: now.clone(),
            updated_at: now,
            bookmarks: Vec::new(),
            credentials: Vec::new(),
        });
    }
    Ok(())
}

pub(crate) fn delete_site(payload: &mut VaultPayload, site_id: &str) -> Result<(), String> {
    let before = payload.sites.len();
    payload.sites.retain(|site| site.id != site_id);
    if before == payload.sites.len() {
        return Err("没有找到要删除的条目。".to_string());
    }
    Ok(())
}

pub(crate) fn upsert_bookmark(
    payload: &mut VaultPayload,
    site_id: &str,
    bookmark: BookmarkInput,
) -> Result<(), String> {
    let site = find_site_mut(&mut payload.sites, site_id)?;
    if site.kind == EntryKind::Folder {
        return Err("目录条目不支持书签。".to_string());
    }

    let now = now_iso();
    let normalized_url = normalize_url(&bookmark.url)?;
    let title = non_empty_text(&bookmark.title, "书签标题不能为空。")?;
    let description = normalize_text(&bookmark.description);

    if let Some(existing) = site
        .bookmarks
        .iter_mut()
        .find(|current| matches_id(current.id.as_str(), bookmark.id.as_deref()))
    {
        existing.title = title;
        existing.url = normalized_url;
        existing.description = description;
        existing.pinned = bookmark.pinned;
        existing.updated_at = now.clone();
    } else {
        site.bookmarks.push(BookmarkRecord {
            id: Uuid::new_v4().to_string(),
            title,
            url: normalized_url,
            description,
            pinned: bookmark.pinned,
            created_at: now.clone(),
            updated_at: now.clone(),
        });
    }
    site.updated_at = now;
    Ok(())
}

pub(crate) fn delete_bookmark(
    payload: &mut VaultPayload,
    site_id: &str,
    bookmark_id: &str,
) -> Result<(), String> {
    let site = find_site_mut(&mut payload.sites, site_id)?;
    let before = site.bookmarks.len();
    site.bookmarks.retain(|bookmark| bookmark.id != bookmark_id);
    if before == site.bookmarks.len() {
        return Err("没有找到要删除的书签。".to_string());
    }
    site.updated_at = now_iso();
    Ok(())
}

pub(crate) fn upsert_credential(
    payload: &mut VaultPayload,
    site_id: &str,
    credential: CredentialInput,
) -> Result<(), String> {
    let site = find_site_mut(&mut payload.sites, site_id)?;
    let now = now_iso();
    let label = normalize_text(&credential.label);
    let username = non_empty_text(&credential.username, "账号不能为空。")?;
    let password = non_empty_text(&credential.password, "密码不能为空。")?;
    let note = normalize_text(&credential.note);

    if let Some(existing) = site
        .credentials
        .iter_mut()
        .find(|current| matches_id(current.id.as_str(), credential.id.as_deref()))
    {
        existing.label = label;
        existing.username = username;
        existing.password = password;
        existing.note = note;
        existing.updated_at = now.clone();
    } else {
        site.credentials.push(CredentialRecord {
            id: Uuid::new_v4().to_string(),
            label,
            username,
            password,
            note,
            created_at: now.clone(),
            updated_at: now.clone(),
        });
    }
    site.updated_at = now;
    Ok(())
}

pub(crate) fn delete_credential(
    payload: &mut VaultPayload,
    site_id: &str,
    credential_id: &str,
) -> Result<(), String> {
    let site = find_site_mut(&mut payload.sites, site_id)?;
    let before = site.credentials.len();
    site.credentials
        .retain(|credential| credential.id != credential_id);
    if before == site.credentials.len() {
        return Err("没有找到要删除的账号密码。".to_string());
    }
    site.updated_at = now_iso();
    Ok(())
}

pub(crate) fn normalize_imported_sites(
    mut sites: Vec<SiteRecord>,
) -> Result<Vec<SiteRecord>, String> {
    let now = now_iso();
    let mut used_ids = HashSet::new();
    for site in &mut sites {
        site.id = unique_import_id(&site.id, &mut used_ids);
        site.name = non_empty_text(&site.name, "条目名称不能为空。")?;
        site.description = normalize_text(&site.description);
        site.accent = normalize_accent(&site.accent);
        if site.created_at.trim().is_empty() {
            site.created_at = now.clone();
        }
        site.updated_at = now.clone();
        site.tags = normalize_tags(std::mem::take(&mut site.tags));

        if site.kind == EntryKind::Folder {
            site.bookmarks.clear();
            site.domain = normalize_domain(&site.domain, EntryKind::Folder)?;
        } else {
            site.domain = normalize_domain(&site.domain, EntryKind::Site)?;
        }

        for bookmark in &mut site.bookmarks {
            bookmark.id = unique_import_id(&bookmark.id, &mut used_ids);
            bookmark.title = non_empty_text(&bookmark.title, "书签标题不能为空。")?;
            bookmark.url = normalize_url(&bookmark.url)?;
            bookmark.description = normalize_text(&bookmark.description);
            if bookmark.created_at.trim().is_empty() {
                bookmark.created_at = now.clone();
            }
            bookmark.updated_at = now.clone();
        }

        for credential in &mut site.credentials {
            credential.id = unique_import_id(&credential.id, &mut used_ids);
            credential.label = normalize_text(&credential.label);
            credential.username = non_empty_text(&credential.username, "账号不能为空。")?;
            credential.password = non_empty_text(&credential.password, "密码不能为空。")?;
            credential.note = normalize_text(&credential.note);
            if credential.created_at.trim().is_empty() {
                credential.created_at = now.clone();
            }
            credential.updated_at = now.clone();
        }
    }
    sort_sites(&mut sites);
    Ok(sites)
}

fn unique_import_id(candidate: &str, used_ids: &mut HashSet<String>) -> String {
    let trimmed = candidate.trim();
    if !trimmed.is_empty() && used_ids.insert(trimmed.to_string()) {
        return trimmed.to_string();
    }

    loop {
        let generated = Uuid::new_v4().to_string();
        if used_ids.insert(generated.clone()) {
            return generated;
        }
    }
}

pub(crate) fn build_snapshot(payload: &VaultPayload, hint: Option<String>) -> VaultSnapshot {
    let mut sites = payload.sites.clone();
    sort_sites(&mut sites);
    let bookmark_count = sites.iter().map(|site| site.bookmarks.len()).sum();
    let credential_count = sites.iter().map(|site| site.credentials.len()).sum();
    let favorite_count = sites.iter().filter(|site| site.favorite).count();
    let weak_password_count = sites
        .iter()
        .flat_map(|site| site.credentials.iter())
        .filter(|credential| password_strength(&credential.password) == PasswordStrength::Weak)
        .count();

    VaultSnapshot {
        hint,
        stats: VaultStats {
            site_count: sites.len(),
            bookmark_count,
            credential_count,
            favorite_count,
            weak_password_count,
        },
        sites,
    }
}

pub(crate) fn sort_sites(sites: &mut [SiteRecord]) {
    for site in sites.iter_mut() {
        site.bookmarks.sort_by(|left, right| {
            right
                .pinned
                .cmp(&left.pinned)
                .then_with(|| right.updated_at.cmp(&left.updated_at))
        });
        site.credentials
            .sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    }
    sites.sort_by(|left, right| {
        right
            .favorite
            .cmp(&left.favorite)
            .then_with(|| right.updated_at.cmp(&left.updated_at))
    });
}

pub(crate) fn generate_password_value(length: Option<usize>) -> Result<String, String> {
    let requested = length.unwrap_or(DEFAULT_PASSWORD_LENGTH).clamp(12, 40);
    let upper = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
    let lower = b"abcdefghijkmnopqrstuvwxyz";
    let digits = b"23456789";
    let symbols = b"!@#$%^&*-_=+";
    let alphabet = [
        upper.as_slice(),
        lower.as_slice(),
        digits.as_slice(),
        symbols.as_slice(),
    ]
    .concat();
    let mut random = OsRng;
    let mut password = vec![
        random_character(upper, &mut random),
        random_character(lower, &mut random),
        random_character(digits, &mut random),
        random_character(symbols, &mut random),
    ];
    while password.len() < requested {
        password.push(random_character(&alphabet, &mut random));
    }
    password.shuffle(&mut random);
    Ok(password.into_iter().collect())
}

fn random_character(alphabet: &[u8], random: &mut OsRng) -> char {
    let mut byte = [0_u8; 1];
    random.fill_bytes(&mut byte);
    char::from(alphabet[usize::from(byte[0]) % alphabet.len()])
}

pub(crate) fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|text| normalize_text(&text))
        .filter(|text| !text.is_empty())
}

pub(crate) fn normalize_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("链接地址不能为空。".to_string());
    }
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let parsed = Url::parse(&with_scheme).map_err(|_| "请输入有效的链接地址。".to_string())?;
    if parsed.host_str().is_none() {
        return Err("请输入有效的链接地址。".to_string());
    }
    Ok(parsed.to_string())
}

fn normalize_domain(domain: &str, kind: EntryKind) -> Result<String, String> {
    let trimmed = domain.trim();
    if trimmed.is_empty() {
        return if kind == EntryKind::Folder {
            Ok(String::new())
        } else {
            Err("网站域名不能为空。".to_string())
        };
    }
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let parsed = Url::parse(&with_scheme).map_err(|_| "请输入有效的域名或网址。".to_string())?;
    parsed
        .host_str()
        .filter(|host| !host.is_empty())
        .map(|host| host.to_lowercase())
        .ok_or_else(|| "请输入有效的域名或网址。".to_string())
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut normalized = tags
        .into_iter()
        .map(|tag| normalize_text(&tag))
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>();
    normalized.sort();
    normalized.dedup();
    normalized
}

fn normalize_accent(accent: &str) -> String {
    let trimmed = accent.trim();
    if trimmed.is_empty() {
        DEFAULT_ACCENT.to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_text(value: &str) -> String {
    value.trim().to_string()
}

fn non_empty_text(value: &str, error_message: &str) -> Result<String, String> {
    let normalized = normalize_text(value);
    if normalized.is_empty() {
        Err(error_message.to_string())
    } else {
        Ok(normalized)
    }
}

fn find_site_mut<'a>(
    sites: &'a mut [SiteRecord],
    site_id: &str,
) -> Result<&'a mut SiteRecord, String> {
    sites
        .iter_mut()
        .find(|site| site.id == site_id)
        .ok_or_else(|| "没有找到对应条目。".to_string())
}

fn matches_id(existing: &str, incoming: Option<&str>) -> bool {
    incoming.is_some_and(|candidate| candidate == existing)
}

pub(crate) fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
