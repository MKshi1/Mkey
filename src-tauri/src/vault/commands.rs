use std::path::PathBuf;
use std::sync::Mutex;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use rand::rngs::OsRng;
use rand::RngCore;
use tauri::State;

use super::browser_import::{
    discover_browser_bookmark_sources, merge_browser_bookmark_import, plan_browser_bookmark_import,
    BrowserBookmarkImportPreview, BrowserBookmarkImportResult,
};
use super::crypto::{derive_key, validate_master_password, KEY_LENGTH, SALT_LENGTH};
use super::model::{
    BookmarkInput, BrowserBookmarkImportRequest, BrowserBookmarkSource, CredentialInput,
    CredentialRecord, EntryKind, PortableVault, SiteInput, SiteRecord, VaultPayload, VaultSnapshot, VaultStatus,
};
use serde::Deserialize;
use super::service::{
    build_snapshot, delete_bookmark as delete_bookmark_record,
    delete_credential as delete_credential_record, delete_site as delete_site_record,
    generate_password_value, normalize_imported_sites, normalize_optional_text, now_iso,
    sort_sites, upsert_bookmark as upsert_bookmark_record,
    upsert_credential as upsert_credential_record, upsert_site as upsert_site_record,
};
use super::storage::{
    decrypt_payload, load_stored_vault, parse_portable_vault, persist_vault, vault_file_path,
};

#[derive(Default)]
pub struct VaultState {
    session: Mutex<Option<UnlockedVault>>,
}

struct UnlockedVault {
    salt: [u8; SALT_LENGTH],
    key: [u8; KEY_LENGTH],
    hint: Option<String>,
    file_path: PathBuf,
    payload: VaultPayload,
}

#[tauri::command]
pub fn get_vault_status(state: State<'_, VaultState>) -> Result<VaultStatus, String> {
    let file_path = vault_file_path();
    let configured = file_path.exists();
    let session = state
        .session
        .lock()
        .map_err(|_| "无法读取当前保险库会话。".to_string())?;
    let hint = if let Some(unlocked) = session.as_ref() {
        unlocked.hint.clone()
    } else if configured {
        load_stored_vault(&file_path)?.password_hint
    } else {
        None
    };
    Ok(VaultStatus {
        configured,
        unlocked: session.is_some(),
        hint,
    })
}

#[tauri::command]
pub fn setup_vault(
    master_password: String,
    hint: Option<String>,
    state: State<'_, VaultState>,
) -> Result<VaultSnapshot, String> {
    validate_master_password(&master_password)?;
    let file_path = vault_file_path();
    if file_path.exists() {
        return Err("保险库已存在，请直接解锁。".to_string());
    }
    let mut salt = [0_u8; SALT_LENGTH];
    OsRng.fill_bytes(&mut salt);
    let key = derive_key(&master_password, &salt);
    let now = now_iso();
    let payload = VaultPayload {
        created_at: now.clone(),
        updated_at: now,
        sites: Vec::new(),
    };
    persist_vault(
        &file_path,
        &payload,
        &key,
        &salt,
        hint.clone(),
        payload.created_at.clone(),
    )?;
    let mut session = state
        .session
        .lock()
        .map_err(|_| "无法写入当前保险库会话。".to_string())?;
    *session = Some(UnlockedVault {
        salt,
        key,
        hint: normalize_optional_text(hint),
        file_path,
        payload,
    });
    let unlocked = session.as_ref().expect("session just initialized");
    Ok(build_snapshot(&unlocked.payload, unlocked.hint.clone()))
}

#[tauri::command]
pub fn unlock_vault(
    master_password: String,
    state: State<'_, VaultState>,
) -> Result<VaultSnapshot, String> {
    let file_path = vault_file_path();
    if !file_path.exists() {
        return Err("还没有创建保险库，请先设置主密码。".to_string());
    }
    let stored = load_stored_vault(&file_path)?;
    let salt_vec = STANDARD
        .decode(stored.salt.as_bytes())
        .map_err(|_| "保险库盐值损坏，无法解锁。".to_string())?;
    let salt: [u8; SALT_LENGTH] = salt_vec
        .try_into()
        .map_err(|_| "保险库盐值长度异常，无法解锁。".to_string())?;
    let key = derive_key(&master_password, &salt);
    let payload = decrypt_payload(&stored, &key)?;
    let mut session = state
        .session
        .lock()
        .map_err(|_| "无法写入当前保险库会话。".to_string())?;
    *session = Some(UnlockedVault {
        salt,
        key,
        hint: stored.password_hint.clone(),
        file_path,
        payload,
    });
    let unlocked = session.as_ref().expect("session just initialized");
    Ok(build_snapshot(&unlocked.payload, unlocked.hint.clone()))
}

#[tauri::command]
pub fn lock_vault(state: State<'_, VaultState>) -> Result<VaultStatus, String> {
    let file_path = vault_file_path();
    let configured = file_path.exists();
    let hint = if configured {
        load_stored_vault(&file_path)?.password_hint
    } else {
        None
    };
    let mut session = state
        .session
        .lock()
        .map_err(|_| "无法清理当前保险库会话。".to_string())?;
    *session = None;
    Ok(VaultStatus {
        configured,
        unlocked: false,
        hint,
    })
}

#[tauri::command]
pub fn get_vault_snapshot(state: State<'_, VaultState>) -> Result<VaultSnapshot, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "无法读取当前保险库会话。".to_string())?;
    let unlocked = session
        .as_ref()
        .ok_or_else(|| "保险库尚未解锁。".to_string())?;
    Ok(build_snapshot(&unlocked.payload, unlocked.hint.clone()))
}

#[tauri::command]
pub fn upsert_site(site: SiteInput, state: State<'_, VaultState>) -> Result<VaultSnapshot, String> {
    mutate_vault(state, |vault| upsert_site_record(&mut vault.payload, site))
}

#[tauri::command]
pub fn delete_site(site_id: String, state: State<'_, VaultState>) -> Result<VaultSnapshot, String> {
    mutate_vault(state, |vault| {
        delete_site_record(&mut vault.payload, &site_id)
    })
}

#[tauri::command]
pub fn upsert_bookmark(
    site_id: String,
    bookmark: BookmarkInput,
    state: State<'_, VaultState>,
) -> Result<VaultSnapshot, String> {
    mutate_vault(state, |vault| {
        upsert_bookmark_record(&mut vault.payload, &site_id, bookmark)
    })
}

#[tauri::command]
pub fn delete_bookmark(
    site_id: String,
    bookmark_id: String,
    state: State<'_, VaultState>,
) -> Result<VaultSnapshot, String> {
    mutate_vault(state, |vault| {
        delete_bookmark_record(&mut vault.payload, &site_id, &bookmark_id)
    })
}

#[tauri::command]
pub fn upsert_credential(
    site_id: String,
    credential: CredentialInput,
    state: State<'_, VaultState>,
) -> Result<VaultSnapshot, String> {
    mutate_vault(state, |vault| {
        upsert_credential_record(&mut vault.payload, &site_id, credential)
    })
}

#[tauri::command]
pub fn delete_credential(
    site_id: String,
    credential_id: String,
    state: State<'_, VaultState>,
) -> Result<VaultSnapshot, String> {
    mutate_vault(state, |vault| {
        delete_credential_record(&mut vault.payload, &site_id, &credential_id)
    })
}

#[tauri::command]
pub fn generate_password(length: Option<usize>) -> Result<String, String> {
    generate_password_value(length)
}

#[tauri::command]
pub fn export_vault_data(state: State<'_, VaultState>) -> Result<String, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "无法读取当前保险库会话。".to_string())?;
    let unlocked = session
        .as_ref()
        .ok_or_else(|| "保险库尚未解锁。".to_string())?;
    let portable = PortableVault {
        exported_at: now_iso(),
        sites: unlocked.payload.sites.clone(),
    };
    serde_json::to_string_pretty(&portable).map_err(|error| format!("导出失败: {error}"))
}

#[tauri::command]
pub fn import_vault_data(
    json: String,
    state: State<'_, VaultState>,
) -> Result<VaultSnapshot, String> {
    mutate_vault(state, |vault| {
        let imported = parse_portable_vault(&json)?;
        vault.payload.sites = normalize_imported_sites(imported.sites)?;
        Ok(())
    })
}

#[derive(Deserialize)]
struct LegacyToken {
    #[serde(default)]
    refresh_token: String,
}

#[derive(Deserialize)]
struct LegacyAccount {
    #[serde(default)]
    email: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    notes: Option<String>,
    token: LegacyToken,
}

#[derive(Deserialize)]
struct LegacyAccountCollection {
    #[serde(default)]
    accounts: Vec<LegacyAccount>,
}

#[tauri::command]
pub fn import_legacy_accounts(json: String, state: State<'_, VaultState>) -> Result<VaultSnapshot, String> {
    let accounts = serde_json::from_str::<Vec<LegacyAccount>>(&json)
        .or_else(|_| serde_json::from_str::<LegacyAccount>(&json).map(|account| vec![account]))
        .or_else(|_| serde_json::from_str::<LegacyAccountCollection>(&json).map(|collection| collection.accounts))
        .map_err(|_| "不是可识别的旧版账号导出文件。".to_string())?;
    mutate_vault(state, |vault| {
        let now = now_iso();
        let site = if let Some(existing) = vault.payload.sites.iter_mut().find(|site| site.name == "旧版账号迁移") {
            existing
        } else {
            vault.payload.sites.push(SiteRecord {
                id: uuid::Uuid::new_v4().to_string(), kind: EntryKind::Folder,
                name: "旧版账号迁移".to_string(), domain: String::new(),
                description: "由旧版 KeyLink 账号数据离线迁移。".to_string(), tags: vec!["空间：迁移".to_string()], accent: "#C2185B".to_string(), favorite: false,
                created_at: now.clone(), updated_at: now.clone(), bookmarks: Vec::new(), credentials: Vec::new(),
            });
            vault.payload.sites.last_mut().expect("legacy migration folder was added")
        };
        let mut imported = 0;
        for account in accounts {
            let email = account.email.trim();
            let token = account.token.refresh_token.trim();
            if email.is_empty() || token.is_empty() || site.credentials.iter().any(|credential| credential.username == email) { continue; }
            let label = account.name.unwrap_or_else(|| email.to_string());
            let note = [account.notes.unwrap_or_default(), if account.tags.is_empty() { String::new() } else { format!("标签：{}", account.tags.join(", ")) }].into_iter().filter(|value| !value.trim().is_empty()).collect::<Vec<_>>().join("\n");
            site.credentials.push(CredentialRecord { id: uuid::Uuid::new_v4().to_string(), label, username: email.to_string(), password: token.to_string(), note, created_at: now.clone(), updated_at: now.clone() });
            imported += 1;
        }
        if imported == 0 { return Err("未找到可迁移的新账号或密钥。".to_string()); }
        site.updated_at = now;
        Ok(())
    })
}

#[tauri::command]
pub fn discover_browser_bookmarks() -> Vec<BrowserBookmarkSource> {
    discover_browser_bookmark_sources()
}

#[tauri::command]
pub fn preview_browser_bookmarks(
    request: BrowserBookmarkImportRequest,
    state: State<'_, VaultState>,
) -> Result<BrowserBookmarkImportPreview, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "无法读取当前保险库会话。".to_string())?;
    let vault = session
        .as_ref()
        .ok_or_else(|| "保险库尚未解锁。".to_string())?;
    Ok(plan_browser_bookmark_import(&request, &vault.payload.sites)?.preview)
}

#[tauri::command]
pub fn merge_browser_bookmarks(
    request: BrowserBookmarkImportRequest,
    state: State<'_, VaultState>,
) -> Result<BrowserBookmarkImportResult, String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "无法写入当前保险库会话。".to_string())?;
    let vault = session
        .as_mut()
        .ok_or_else(|| "保险库尚未解锁。".to_string())?;
    let result = merge_browser_bookmark_import(&mut vault.payload, &request)?;
    persist_unlocked_vault(vault)?;
    Ok(result)
}

fn mutate_vault<F>(state: State<'_, VaultState>, action: F) -> Result<VaultSnapshot, String>
where
    F: FnOnce(&mut UnlockedVault) -> Result<(), String>,
{
    let mut session = state
        .session
        .lock()
        .map_err(|_| "无法写入当前保险库会话。".to_string())?;
    let vault = session
        .as_mut()
        .ok_or_else(|| "保险库尚未解锁。".to_string())?;
    action(vault)?;
    persist_unlocked_vault(vault)?;
    Ok(build_snapshot(&vault.payload, vault.hint.clone()))
}

fn persist_unlocked_vault(vault: &mut UnlockedVault) -> Result<(), String> {
    sort_sites(&mut vault.payload.sites);
    vault.payload.updated_at = now_iso();
    persist_vault(
        &vault.file_path,
        &vault.payload,
        &vault.key,
        &vault.salt,
        vault.hint.clone(),
        vault.payload.created_at.clone(),
    )
}
