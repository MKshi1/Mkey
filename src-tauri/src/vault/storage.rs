use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};

use super::crypto::{
    decrypt_bytes, encrypt_bytes, EncryptedBytes, KEY_LENGTH, NONCE_LENGTH, SALT_LENGTH,
};
use super::model::{PortableVault, SiteRecord, StoredVault, VaultPayload};
use super::service::{normalize_optional_text, now_iso, sort_sites};

pub(crate) fn vault_file_path() -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("MKey").join("vault.json")
}

pub(crate) fn persist_vault(
    file_path: &Path,
    payload: &VaultPayload,
    key: &[u8; KEY_LENGTH],
    salt: &[u8; SALT_LENGTH],
    hint: Option<String>,
    created_at: String,
) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建保险库目录失败: {error}"))?;
    }
    let payload_bytes =
        serde_json::to_vec(payload).map_err(|error| format!("序列化保险库失败: {error}"))?;
    let encrypted = encrypt_bytes(&payload_bytes, key)?;
    let stored = StoredVault {
        version: 1,
        password_hint: normalize_optional_text(hint),
        salt: STANDARD.encode(salt),
        nonce: STANDARD.encode(encrypted.nonce),
        ciphertext: STANDARD.encode(encrypted.ciphertext),
        created_at,
        updated_at: payload.updated_at.clone(),
    };
    let serialized = serde_json::to_vec_pretty(&stored)
        .map_err(|error| format!("序列化保险库存档失败: {error}"))?;
    fs::write(file_path, serialized).map_err(|error| format!("写入保险库失败: {error}"))
}

pub(crate) fn load_stored_vault(file_path: &Path) -> Result<StoredVault, String> {
    let content = fs::read(file_path).map_err(|error| format!("读取保险库失败: {error}"))?;
    serde_json::from_slice(&content).map_err(|error| format!("解析保险库失败: {error}"))
}

pub(crate) fn decrypt_payload(
    stored: &StoredVault,
    key: &[u8; KEY_LENGTH],
) -> Result<VaultPayload, String> {
    let nonce_vec = STANDARD
        .decode(stored.nonce.as_bytes())
        .map_err(|_| "保险库随机向量损坏，无法解锁。".to_string())?;
    let nonce: [u8; NONCE_LENGTH] = nonce_vec
        .try_into()
        .map_err(|_| "保险库随机向量长度异常，无法解锁。".to_string())?;
    let ciphertext = STANDARD
        .decode(stored.ciphertext.as_bytes())
        .map_err(|_| "保险库内容损坏，无法解锁。".to_string())?;
    let decrypted = decrypt_bytes(&EncryptedBytes { nonce, ciphertext }, key)?;
    let mut payload: VaultPayload = serde_json::from_slice(&decrypted)
        .map_err(|error| format!("解析保险库内容失败: {error}"))?;
    sort_sites(&mut payload.sites);
    Ok(payload)
}

pub(crate) fn parse_portable_vault(json: &str) -> Result<PortableVault, String> {
    serde_json::from_str::<PortableVault>(json)
        .or_else(|_| {
            serde_json::from_str::<Vec<SiteRecord>>(json).map(|sites| PortableVault {
                exported_at: now_iso(),
                sites,
            })
        })
        .map_err(|error| format!("导入文件格式无效: {error}"))
}
