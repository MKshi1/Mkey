use crate::vault::{
    browser_import::{
        merge_browser_bookmark_import, parse_chromium_bookmarks, plan_browser_bookmark_import,
        read_firefox_bookmarks,
    },
    model::{
        BrowserBookmarkImportRequest, CredentialRecord, EntryKind, HtmlBookmarkFile, SiteRecord,
        VaultPayload,
    },
};

fn html_request(contents: &str) -> BrowserBookmarkImportRequest {
    BrowserBookmarkImportRequest {
        source_ids: Vec::new(),
        html_files: vec![HtmlBookmarkFile {
            name: "bookmarks.html".to_string(),
            contents: contents.to_string(),
        }],
    }
}

#[test]
fn firefox_bookmarks_are_read_from_a_temporary_copy() {
    let directory =
        std::env::temp_dir().join(format!("mkey-firefox-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory).expect("temporary fixture directory");
    let path = directory.join("places.sqlite");
    let connection = rusqlite::Connection::open(&path).expect("fixture database");
    connection
        .execute_batch(
            "CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT NOT NULL);
             CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, parent INTEGER, fk INTEGER, type INTEGER, title TEXT);
             INSERT INTO moz_bookmarks VALUES (1, 0, NULL, 2, 'Toolbar');
             INSERT INTO moz_places VALUES (7, 'https://firefox.example/docs');
             INSERT INTO moz_bookmarks VALUES (2, 1, 7, 1, 'Firefox Docs');",
        )
        .expect("fixture data");
    drop(connection);

    let bookmarks = read_firefox_bookmarks(&path).expect("Firefox fixture should be read");
    assert_eq!(bookmarks.len(), 1);
    assert_eq!(bookmarks[0].title, "Firefox Docs");
    assert_eq!(bookmarks[0].folder_path, vec!["Toolbar".to_string()]);
    std::fs::remove_dir_all(directory).expect("fixture cleanup");
}

#[test]
fn merge_import_adds_bookmarks_without_overwriting_existing_credentials() {
    let mut payload = VaultPayload {
        created_at: "2026-09-06T00:00:00Z".to_string(),
        updated_at: "2026-09-06T00:00:00Z".to_string(),
        sites: vec![SiteRecord {
            id: "site-1".to_string(),
            kind: EntryKind::Site,
            name: "Example".to_string(),
            domain: "example.com".to_string(),
            description: "keep me".to_string(),
            tags: vec!["existing".to_string()],
            accent: "#F97316".to_string(),
            favorite: true,
            created_at: "2026-09-06T00:00:00Z".to_string(),
            updated_at: "2026-09-06T00:00:00Z".to_string(),
            bookmarks: Vec::new(),
            credentials: vec![CredentialRecord {
                id: "credential-1".to_string(),
                label: "main".to_string(),
                username: "person@example.test".to_string(),
                password: "fictional-password".to_string(),
                note: String::new(),
                created_at: "2026-09-06T00:00:00Z".to_string(),
                updated_at: "2026-09-06T00:00:00Z".to_string(),
            }],
        }],
    };

    let result = merge_browser_bookmark_import(
        &mut payload,
        &html_request(r#"<DL><p><DT><H3>Work</H3><DL><p><DT><A HREF="https://example.com/docs">Docs</A></DL><p></DL><p>"#),
    )
    .expect("browser bookmarks should merge");

    assert_eq!(result.added_bookmark_count, 1);
    assert_eq!(payload.sites.len(), 1);
    assert_eq!(payload.sites[0].credentials.len(), 1);
    assert_eq!(payload.sites[0].description, "keep me");
    assert_eq!(payload.sites[0].accent, "#F97316");
    assert_eq!(
        payload.sites[0].bookmarks[0].url,
        "https://example.com/docs"
    );
    assert!(payload.sites[0].tags.contains(&"Work".to_string()));
}

#[test]
fn chromium_bookmarks_preserve_nested_folder_path() {
    let bookmarks = parse_chromium_bookmarks(
        r#"{
          "roots": {
            "bookmark_bar": {
              "type": "folder", "name": "Bookmarks bar", "children": [
                {"type": "folder", "name": "Project", "children": [
                  {"type": "url", "name": "MKey", "url": "https://mkey.example/app"}
                ]}
              ]
            }
          }
        }"#,
    )
    .expect("valid Chromium bookmark JSON should parse");

    assert_eq!(bookmarks.len(), 1);
    assert_eq!(bookmarks[0].title, "MKey");
    assert_eq!(bookmarks[0].url, "https://mkey.example/app");
    assert_eq!(
        bookmarks[0].folder_path,
        vec!["Bookmarks bar".to_string(), "Project".to_string()]
    );
}

#[test]
fn netscape_html_import_tracks_folder_path_and_skips_unsupported_urls() {
    let plan = plan_browser_bookmark_import(
        &html_request(
            r#"<!DOCTYPE NETSCAPE-Bookmark-file-1>
            <DL><p>
                <DT><H3>Work</H3>
                <DL><p>
                    <DT><H3>Tools</H3>
                    <DL><p>
                        <DT><A HREF="https://example.com/docs">Docs</A>
                        <DT><A HREF="javascript:alert(1)">Bad</A>
                    </DL><p>
                </DL><p>
            </DL><p>"#,
        ),
        &[],
    )
    .expect("valid exported HTML should be planned");

    assert_eq!(plan.preview.discovered_bookmark_count, 2);
    assert_eq!(plan.preview.importable_bookmark_count, 1);
    assert_eq!(plan.preview.skipped_invalid_count, 1);
    assert_eq!(plan.sites.len(), 1);
    assert_eq!(plan.sites[0].domain, "example.com");
    assert_eq!(plan.sites[0].bookmarks[0].title, "Docs");
    assert_eq!(
        plan.sites[0].bookmarks[0].tags,
        vec!["Work".to_string(), "Tools".to_string()]
    );
}

#[test]
fn bookmark_import_deduplicates_normalized_urls_and_groups_by_hostname() {
    let plan = plan_browser_bookmark_import(
        &html_request(
            r#"<DL><p>
                <DT><A HREF="https://example.com">Homepage</A>
                <DT><A HREF="https://example.com/">Duplicate</A>
                <DT><A HREF="https://docs.example.com/guide">Guide</A>
            </DL><p>"#,
        ),
        &[],
    )
    .expect("valid exported HTML should be planned");

    assert_eq!(plan.preview.importable_bookmark_count, 2);
    assert_eq!(plan.preview.skipped_duplicate_count, 1);
    assert_eq!(plan.preview.new_site_count, 2);
    assert_eq!(plan.sites.len(), 2);
    assert!(plan.sites.iter().any(|site| site.domain == "example.com"));
    assert!(plan
        .sites
        .iter()
        .any(|site| site.domain == "docs.example.com"));
}
