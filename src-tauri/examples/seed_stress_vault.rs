#![allow(dead_code)]

use std::env;
use std::fs;
use std::path::PathBuf;

use rand::rngs::OsRng;
use rand::RngCore;

#[path = "../src/vault/crypto.rs"]
mod crypto;
#[path = "../src/vault/model.rs"]
mod model;
#[path = "../src/vault/service.rs"]
mod service;
#[path = "../src/vault/storage.rs"]
mod storage;

const TEST_MASTER_PASSWORD: &str = "MKey-Test-2026!";

fn main() -> Result<(), String> {
    let fixture_path = env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("test-data/mkey-stress-import.json"));
    let output_path = storage::vault_file_path();
    if output_path.exists() {
        return Err(format!("保险库已存在，拒绝覆盖：{}", output_path.display()));
    }

    let json = fs::read_to_string(&fixture_path)
        .map_err(|error| format!("读取测试数据失败 {}: {error}", fixture_path.display()))?;
    let portable = storage::parse_portable_vault(&json)?;
    let sites = service::normalize_imported_sites(portable.sites)?;
    let now = service::now_iso();
    let payload = model::VaultPayload {
        created_at: now.clone(),
        updated_at: now.clone(),
        sites,
    };
    let mut salt = [0_u8; crypto::SALT_LENGTH];
    OsRng.fill_bytes(&mut salt);
    let key = crypto::derive_key(TEST_MASTER_PASSWORD, &salt);

    storage::persist_vault(
        &output_path,
        &payload,
        &key,
        &salt,
        Some("压力测试保险库".to_string()),
        now,
    )?;
    let stored = storage::load_stored_vault(&output_path)?;
    let restored = storage::decrypt_payload(&stored, &key)?;
    if restored.sites.len() != payload.sites.len() {
        return Err("写入后的保险库记录数量不一致。".to_string());
    }

    println!(
        "{}",
        serde_json::json!({
            "outputPath": output_path,
            "entries": payload.sites.len(),
            "verifiedEntries": restored.sites.len(),
            "masterPassword": TEST_MASTER_PASSWORD,
        })
    );
    Ok(())
}
