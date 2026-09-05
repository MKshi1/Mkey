use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use pbkdf2::pbkdf2_hmac;
use rand::rngs::OsRng;
use rand::RngCore;
use sha2::Sha256;

pub(crate) const PBKDF2_ITERATIONS: u32 = 120_000;
pub(crate) const SALT_LENGTH: usize = 16;
pub(crate) const NONCE_LENGTH: usize = 12;
pub(crate) const KEY_LENGTH: usize = 32;
pub(crate) const MIN_MASTER_PASSWORD_LENGTH: usize = 8;

pub(crate) struct EncryptedBytes {
    pub(crate) nonce: [u8; NONCE_LENGTH],
    pub(crate) ciphertext: Vec<u8>,
}

pub(crate) fn derive_key(master_password: &str, salt: &[u8; SALT_LENGTH]) -> [u8; KEY_LENGTH] {
    let mut key = [0_u8; KEY_LENGTH];
    pbkdf2_hmac::<Sha256>(
        master_password.as_bytes(),
        salt,
        PBKDF2_ITERATIONS,
        &mut key,
    );
    key
}

pub(crate) fn encrypt_bytes(
    plaintext: &[u8],
    key: &[u8; KEY_LENGTH],
) -> Result<EncryptedBytes, String> {
    let mut nonce = [0_u8; NONCE_LENGTH];
    OsRng.fill_bytes(&mut nonce);
    let cipher =
        Aes256Gcm::new_from_slice(key).map_err(|_| "初始化保险库加密器失败。".to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|_| "加密保险库失败。".to_string())?;
    Ok(EncryptedBytes { nonce, ciphertext })
}

pub(crate) fn decrypt_bytes(
    encrypted: &EncryptedBytes,
    key: &[u8; KEY_LENGTH],
) -> Result<Vec<u8>, String> {
    let cipher =
        Aes256Gcm::new_from_slice(key).map_err(|_| "初始化保险库加密器失败。".to_string())?;
    cipher
        .decrypt(
            Nonce::from_slice(&encrypted.nonce),
            encrypted.ciphertext.as_ref(),
        )
        .map_err(|_| "主密码错误，或保险库内容已损坏。".to_string())
}

pub(crate) fn validate_master_password(master_password: &str) -> Result<(), String> {
    if master_password.trim().len() < MIN_MASTER_PASSWORD_LENGTH {
        return Err(format!(
            "主密码至少需要 {MIN_MASTER_PASSWORD_LENGTH} 个字符。"
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PasswordStrength {
    Weak,
    Good,
    Strong,
}

pub(crate) fn password_strength(password: &str) -> PasswordStrength {
    let has_upper = password
        .chars()
        .any(|character| character.is_ascii_uppercase());
    let has_lower = password
        .chars()
        .any(|character| character.is_ascii_lowercase());
    let has_digit = password.chars().any(|character| character.is_ascii_digit());
    let has_symbol = password
        .chars()
        .any(|character| !character.is_ascii_alphanumeric());
    let score = usize::from(has_upper)
        + usize::from(has_lower)
        + usize::from(has_digit)
        + usize::from(has_symbol);

    if password.len() >= 16 && score >= 4 {
        PasswordStrength::Strong
    } else if password.len() >= 10 && score >= 3 {
        PasswordStrength::Good
    } else {
        PasswordStrength::Weak
    }
}
