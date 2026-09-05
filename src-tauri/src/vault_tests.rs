use std::collections::HashSet;
use std::fs;
use std::path::Path;

use crate::vault::crypto::{decrypt_bytes, derive_key, encrypt_bytes, SALT_LENGTH};
use crate::vault::model::{
    BookmarkInput, BookmarkRecord, CredentialInput, CredentialRecord, EntryKind, SiteInput,
    SiteRecord, VaultPayload,
};
use crate::vault::service::{
    build_snapshot, delete_bookmark, delete_credential, generate_password_value,
    normalize_imported_sites, normalize_url, upsert_bookmark, upsert_credential, upsert_site,
};
use crate::vault::storage::{
    decrypt_payload, load_stored_vault, parse_portable_vault, persist_vault, vault_file_path,
};

fn empty_payload() -> VaultPayload {
    VaultPayload {
        created_at: "2026-09-04T00:00:00Z".to_string(),
        updated_at: "2026-09-04T00:00:00Z".to_string(),
        sites: Vec::new(),
    }
}

#[test]
fn stores_the_vault_under_the_mkey_data_directory() {
    assert!(vault_file_path().ends_with(Path::new("MKey").join("vault.json")));
}

fn folder() -> SiteRecord {
    SiteRecord {
        id: "folder-1".to_string(),
        kind: EntryKind::Folder,
        name: "本地工具".to_string(),
        domain: String::new(),
        description: String::new(),
        tags: Vec::new(),
        accent: "#475569".to_string(),
        favorite: false,
        created_at: "2026-09-04T00:00:00Z".to_string(),
        updated_at: "2026-09-04T00:00:00Z".to_string(),
        bookmarks: Vec::new(),
        credentials: Vec::new(),
    }
}

#[test]
fn encryption_round_trip_rejects_the_wrong_key() {
    let salt = [7_u8; SALT_LENGTH];
    let key = derive_key("correct horse battery staple", &salt);
    let wrong_key = derive_key("incorrect password", &salt);
    let encrypted = encrypt_bytes(b"mkey payload", &key).expect("encrypt payload");

    assert_eq!(
        decrypt_bytes(&encrypted, &key).expect("decrypt payload"),
        b"mkey payload"
    );
    assert!(decrypt_bytes(&encrypted, &wrong_key).is_err());
}

#[test]
fn normalizes_bookmark_urls_to_https() {
    assert_eq!(
        normalize_url("example.com/path").expect("normalize URL"),
        "https://example.com/path"
    );
    assert!(normalize_url("not a url").is_err());
}

#[test]
fn folders_reject_bookmarks_but_accept_credentials() {
    let mut payload = empty_payload();
    payload.sites.push(folder());

    let bookmark_result = upsert_bookmark(
        &mut payload,
        "folder-1",
        BookmarkInput {
            id: None,
            title: "主页".to_string(),
            url: "example.com".to_string(),
            description: String::new(),
            pinned: false,
        },
    );
    assert_eq!(bookmark_result.unwrap_err(), "目录条目不支持书签。");

    upsert_credential(
        &mut payload,
        "folder-1",
        CredentialInput {
            id: None,
            label: "本地账号".to_string(),
            username: "owner".to_string(),
            password: "StrongPassword!2026".to_string(),
            note: String::new(),
        },
    )
    .expect("add credential");
    assert_eq!(payload.sites[0].credentials.len(), 1);
}

#[test]
fn snapshot_counts_and_sorts_mkey_records() {
    let mut payload = empty_payload();
    upsert_site(
        &mut payload,
        SiteInput {
            id: None,
            kind: EntryKind::Site,
            name: "普通站点".to_string(),
            domain: "normal.example.com".to_string(),
            description: String::new(),
            tags: Vec::new(),
            accent: "#1D4ED8".to_string(),
            favorite: false,
        },
    )
    .expect("add regular site");
    upsert_site(
        &mut payload,
        SiteInput {
            id: None,
            kind: EntryKind::Site,
            name: "收藏站点".to_string(),
            domain: "favorite.example.com".to_string(),
            description: String::new(),
            tags: Vec::new(),
            accent: "#0EA5A5".to_string(),
            favorite: true,
        },
    )
    .expect("add favorite site");
    let favorite_id = payload
        .sites
        .iter()
        .find(|site| site.favorite)
        .expect("favorite site")
        .id
        .clone();
    upsert_bookmark(
        &mut payload,
        &favorite_id,
        BookmarkInput {
            id: None,
            title: "控制台".to_string(),
            url: "console.example.com".to_string(),
            description: String::new(),
            pinned: true,
        },
    )
    .expect("add bookmark");
    upsert_credential(
        &mut payload,
        &favorite_id,
        CredentialInput {
            id: None,
            label: "管理员".to_string(),
            username: "owner@example.com".to_string(),
            password: "weak".to_string(),
            note: String::new(),
        },
    )
    .expect("add credential");

    let snapshot = build_snapshot(&payload, Some("hint".to_string()));
    assert_eq!(snapshot.sites[0].name, "收藏站点");
    assert_eq!(snapshot.stats.site_count, 2);
    assert_eq!(snapshot.stats.bookmark_count, 1);
    assert_eq!(snapshot.stats.credential_count, 1);
    assert_eq!(snapshot.stats.favorite_count, 1);
    assert_eq!(snapshot.stats.weak_password_count, 1);
}

#[test]
fn generated_password_contains_each_required_character_class() {
    let password = generate_password_value(Some(18)).expect("generate password");

    assert_eq!(password.len(), 18);
    assert!(password
        .chars()
        .any(|character| character.is_ascii_uppercase()));
    assert!(password
        .chars()
        .any(|character| character.is_ascii_lowercase()));
    assert!(password.chars().any(|character| character.is_ascii_digit()));
    assert!(password
        .chars()
        .any(|character| !character.is_ascii_alphanumeric()));
}

#[test]
fn bookmark_and_credential_crud_updates_the_existing_records() {
    let mut payload = empty_payload();
    upsert_site(
        &mut payload,
        SiteInput {
            id: None,
            kind: EntryKind::Site,
            name: "MKey".to_string(),
            domain: "mkey.example.com".to_string(),
            description: String::new(),
            tags: Vec::new(),
            accent: "#1D4ED8".to_string(),
            favorite: false,
        },
    )
    .expect("add site");
    let site_id = payload.sites[0].id.clone();

    upsert_bookmark(
        &mut payload,
        &site_id,
        BookmarkInput {
            id: None,
            title: "旧标题".to_string(),
            url: "old.example.com".to_string(),
            description: String::new(),
            pinned: false,
        },
    )
    .expect("add bookmark");
    let bookmark_id = payload.sites[0].bookmarks[0].id.clone();
    upsert_bookmark(
        &mut payload,
        &site_id,
        BookmarkInput {
            id: Some(bookmark_id.clone()),
            title: "新标题".to_string(),
            url: "new.example.com".to_string(),
            description: "已更新".to_string(),
            pinned: true,
        },
    )
    .expect("update bookmark");
    assert_eq!(payload.sites[0].bookmarks.len(), 1);
    assert_eq!(payload.sites[0].bookmarks[0].title, "新标题");
    assert_eq!(
        payload.sites[0].bookmarks[0].url,
        "https://new.example.com/"
    );
    delete_bookmark(&mut payload, &site_id, &bookmark_id).expect("delete bookmark");
    assert!(payload.sites[0].bookmarks.is_empty());

    upsert_credential(
        &mut payload,
        &site_id,
        CredentialInput {
            id: None,
            label: "旧账号".to_string(),
            username: "old-user".to_string(),
            password: "OldPassword!2026".to_string(),
            note: String::new(),
        },
    )
    .expect("add credential");
    let credential_id = payload.sites[0].credentials[0].id.clone();
    upsert_credential(
        &mut payload,
        &site_id,
        CredentialInput {
            id: Some(credential_id.clone()),
            label: "新账号".to_string(),
            username: "new-user".to_string(),
            password: "NewPassword!2026".to_string(),
            note: "已更新".to_string(),
        },
    )
    .expect("update credential");
    assert_eq!(payload.sites[0].credentials.len(), 1);
    assert_eq!(payload.sites[0].credentials[0].username, "new-user");
    delete_credential(&mut payload, &site_id, &credential_id).expect("delete credential");
    assert!(payload.sites[0].credentials.is_empty());
}

#[test]
fn imported_records_are_validated_and_normalized() {
    let mut site = folder();
    site.kind = EntryKind::Site;
    site.domain = "mkey.example.com".to_string();
    site.tags = vec![" 工具 ".to_string(), "工具".to_string()];
    site.bookmarks.push(BookmarkRecord {
        id: String::new(),
        title: "主页".to_string(),
        url: "docs.example.com".to_string(),
        description: String::new(),
        pinned: false,
        created_at: String::new(),
        updated_at: String::new(),
    });

    let imported = normalize_imported_sites(vec![site]).expect("normalize imported records");
    assert_eq!(imported[0].domain, "mkey.example.com");
    assert_eq!(imported[0].tags, vec!["工具"]);
    assert_eq!(imported[0].bookmarks[0].url, "https://docs.example.com/");
    assert!(!imported[0].bookmarks[0].id.is_empty());

    let mut invalid = folder();
    invalid.kind = EntryKind::Site;
    invalid.domain = "not a url".to_string();
    assert!(normalize_imported_sites(vec![invalid]).is_err());
}

#[test]
fn stress_fixture_imports_encrypts_and_restores_all_records() {
    let credentials = |parent: &str, count: usize| {
        (1..=count)
            .map(|index| {
                serde_json::json!({
                    "id": format!("credential-{parent}-{index}"),
                    "label": format!("账号 {index}"),
                    "username": format!("user-{parent}-{index}@example.test"),
                    "password": if index == 1 { "123456" } else { "MKey!2026Aa" },
                    "note": "内存生成的虚拟压力测试账号",
                    "createdAt": "2026-09-04T12:00:00Z",
                    "updatedAt": "2026-09-04T12:00:00Z"
                })
            })
            .collect::<Vec<_>>()
    };
    let mut fixture_sites = (1..=240)
        .map(|index| {
            let id = format!("site-{index:04}");
            let bookmarks = (1..=5)
                .map(|bookmark_index| {
                    serde_json::json!({
                        "id": format!("bookmark-{id}-{bookmark_index}"),
                        "title": format!("工作台 {bookmark_index}"),
                        "url": format!("https://{id}.example.test/tools/{bookmark_index}"),
                        "description": "内存生成的虚拟压力测试书签",
                        "pinned": bookmark_index == 1,
                        "createdAt": "2026-09-04T12:00:00Z",
                        "updatedAt": "2026-09-04T12:00:00Z"
                    })
                })
                .collect::<Vec<_>>();
            serde_json::json!({
                "id": id,
                "kind": "site",
                "name": format!("测试网站 {index:04}"),
                "domain": format!("site-{index:04}.example.test"),
                "description": "MKey 内存压力测试网站",
                "tags": ["测试", "网站"],
                "accent": "#0F8494",
                "favorite": index % 9 == 0,
                "createdAt": "2026-09-04T12:00:00Z",
                "updatedAt": "2026-09-04T12:00:00Z",
                "bookmarks": bookmarks,
                "credentials": credentials(&id, 3)
            })
        })
        .collect::<Vec<_>>();
    fixture_sites.extend((1..=60).map(|index| {
        let id = format!("folder-{index:04}");
        serde_json::json!({
            "id": id,
            "kind": "folder",
            "name": format!("非网站资料 {index:04}"),
            "domain": "",
            "description": "MKey 内存压力测试非网站条目",
            "tags": ["测试", "非网站"],
            "accent": "#D06B54",
            "favorite": index % 10 == 0,
            "createdAt": "2026-09-04T12:00:00Z",
            "updatedAt": "2026-09-04T12:00:00Z",
            "bookmarks": [],
            "credentials": credentials(&id, 3)
        })
    }));
    let json = serde_json::json!({
        "exportedAt": "2026-09-04T12:00:00Z",
        "sites": fixture_sites
    })
    .to_string();
    let portable = parse_portable_vault(&json).expect("parse stress fixture");
    let sites = normalize_imported_sites(portable.sites).expect("normalize stress fixture");
    let payload = VaultPayload {
        created_at: "2026-09-04T12:00:00Z".to_string(),
        updated_at: "2026-09-04T12:00:00Z".to_string(),
        sites,
    };
    let snapshot = build_snapshot(&payload, Some("stress".to_string()));

    assert_eq!(snapshot.sites.len(), 300);
    assert_eq!(snapshot.stats.bookmark_count, 1_200);
    assert_eq!(snapshot.stats.credential_count, 900);
    assert!(snapshot.stats.weak_password_count > 0);

    let salt = [9_u8; SALT_LENGTH];
    let key = derive_key("MKey stress test password", &salt);
    let output_path =
        std::env::temp_dir().join(format!("mkey-stress-{}.json", uuid::Uuid::new_v4()));
    persist_vault(
        &output_path,
        &payload,
        &key,
        &salt,
        Some("stress".to_string()),
        payload.created_at.clone(),
    )
    .expect("persist encrypted stress vault");
    let stored = load_stored_vault(&output_path).expect("load encrypted stress vault");
    let restored = decrypt_payload(&stored, &key).expect("decrypt stress vault");
    fs::remove_file(output_path).expect("remove temporary stress vault");

    assert_eq!(restored.sites.len(), 300);
    assert_eq!(restored.sites[0].bookmarks.len(), 5);
    assert_eq!(restored.sites[0].credentials.len(), 3);
}

#[test]
fn imported_duplicate_ids_are_repaired_globally() {
    let mut first = folder();
    let mut second = folder();
    first.id = "duplicate".to_string();
    second.id = "duplicate".to_string();
    for site in [&mut first, &mut second] {
        site.credentials.push(CredentialRecord {
            id: "duplicate".to_string(),
            label: "测试账号".to_string(),
            username: "stress-user".to_string(),
            password: "StressPassword!2026".to_string(),
            note: String::new(),
            created_at: String::new(),
            updated_at: String::new(),
        });
    }

    let sites = normalize_imported_sites(vec![first, second]).expect("normalize duplicate IDs");
    let all_ids = sites
        .iter()
        .flat_map(|site| {
            std::iter::once(site.id.as_str())
                .chain(site.bookmarks.iter().map(|bookmark| bookmark.id.as_str()))
                .chain(
                    site.credentials
                        .iter()
                        .map(|credential| credential.id.as_str()),
                )
        })
        .collect::<Vec<_>>();
    let unique_ids = all_ids.iter().copied().collect::<HashSet<_>>();

    assert_eq!(unique_ids.len(), all_ids.len());
}

#[test]
fn imported_records_enforce_the_same_required_fields_as_editors() {
    let mut unnamed_site = folder();
    unnamed_site.name = "   ".to_string();
    assert!(normalize_imported_sites(vec![unnamed_site]).is_err());

    let mut untitled_bookmark_site = folder();
    untitled_bookmark_site.kind = EntryKind::Site;
    untitled_bookmark_site.domain = "example.test".to_string();
    untitled_bookmark_site.bookmarks.push(BookmarkRecord {
        id: "bookmark-1".to_string(),
        title: "   ".to_string(),
        url: "docs.example.test".to_string(),
        description: String::new(),
        pinned: false,
        created_at: String::new(),
        updated_at: String::new(),
    });
    assert!(normalize_imported_sites(vec![untitled_bookmark_site]).is_err());

    let mut empty_credential_site = folder();
    empty_credential_site.credentials.push(CredentialRecord {
        id: "credential-1".to_string(),
        label: String::new(),
        username: "   ".to_string(),
        password: "   ".to_string(),
        note: String::new(),
        created_at: String::new(),
        updated_at: String::new(),
    });
    assert!(normalize_imported_sites(vec![empty_credential_site]).is_err());
}
