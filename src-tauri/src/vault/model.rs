use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub configured: bool,
    pub unlocked: bool,
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSnapshot {
    pub hint: Option<String>,
    pub sites: Vec<SiteRecord>,
    pub stats: VaultStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStats {
    pub site_count: usize,
    pub bookmark_count: usize,
    pub credential_count: usize,
    pub favorite_count: usize,
    pub weak_password_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoredVault {
    pub(crate) version: u32,
    pub(crate) password_hint: Option<String>,
    pub(crate) salt: String,
    pub(crate) nonce: String,
    pub(crate) ciphertext: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VaultPayload {
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) sites: Vec<SiteRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PortableVault {
    pub(crate) exported_at: String,
    pub(crate) sites: Vec<SiteRecord>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum EntryKind {
    #[default]
    Site,
    Folder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteRecord {
    pub id: String,
    #[serde(default)]
    pub kind: EntryKind,
    pub name: String,
    #[serde(default)]
    pub domain: String,
    pub description: String,
    pub tags: Vec<String>,
    pub accent: String,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub bookmarks: Vec<BookmarkRecord>,
    pub credentials: Vec<CredentialRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkRecord {
    pub id: String,
    pub title: String,
    pub url: String,
    pub description: String,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialRecord {
    pub id: String,
    pub label: String,
    pub username: String,
    pub password: String,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteInput {
    pub id: Option<String>,
    #[serde(default)]
    pub kind: EntryKind,
    pub name: String,
    pub domain: String,
    pub description: String,
    pub tags: Vec<String>,
    pub accent: String,
    pub favorite: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkInput {
    pub id: Option<String>,
    pub title: String,
    pub url: String,
    pub description: String,
    pub pinned: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialInput {
    pub id: Option<String>,
    pub label: String,
    pub username: String,
    pub password: String,
    pub note: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBookmarkImportRequest {
    #[serde(default)]
    pub source_ids: Vec<String>,
    #[serde(default)]
    pub html_files: Vec<HtmlBookmarkFile>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlBookmarkFile {
    pub name: String,
    pub contents: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBookmarkSource {
    pub id: String,
    pub browser: String,
    pub profile: String,
    pub format: String,
}
