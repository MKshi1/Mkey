#[cfg(test)]
mod browser_import_tests;
mod vault;
#[cfg(test)]
mod vault_tests;

use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(VaultState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            vault::commands::get_vault_status,
            vault::commands::setup_vault,
            vault::commands::unlock_vault,
            vault::commands::lock_vault,
            vault::commands::get_vault_snapshot,
            vault::commands::upsert_site,
            vault::commands::delete_site,
            vault::commands::upsert_bookmark,
            vault::commands::delete_bookmark,
            vault::commands::upsert_credential,
            vault::commands::delete_credential,
            vault::commands::generate_password,
            vault::commands::export_vault_data,
            vault::commands::import_vault_data,
            vault::commands::discover_browser_bookmarks,
            vault::commands::preview_browser_bookmarks,
            vault::commands::merge_browser_bookmarks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MKey");
}
