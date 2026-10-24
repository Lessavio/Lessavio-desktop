// Temporary loopback receiver for installed-app OAuth, not a hosted backend.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tauri::State;
use url::Url;
#[derive(Default, Clone)]
pub struct GoogleLogin {
    running: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
}
struct Running(Arc<AtomicBool>);
impl Drop for Running {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}
fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
fn callback(target: &str, state: &str) -> Result<Option<String>, String> {
    let url = Url::parse(&format!("http://127.0.0.1{target}")).map_err(|_| "auth/google-failed")?;
    if url.path() != "/oauth/callback" {
        return Ok(None);
    }
    let pairs = url.query_pairs().collect::<Vec<_>>();
    if pairs.iter().filter(|(k, _)| k == "state").count() != 1
        || !pairs.iter().any(|(k, v)| k == "state" && v == state)
    {
        return Ok(None);
    }
    if pairs.iter().any(|(k, _)| k == "error") {
        return Err("auth/google-cancelled".into());
    }
    let codes = pairs
        .iter()
        .filter(|(k, _)| k == "code")
        .collect::<Vec<_>>();
    if codes.len() != 1 || codes[0].1.is_empty() {
        return Err("auth/google-failed".into());
    }
    Ok(Some(codes[0].1.to_string()))
}
fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", url])
        .spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let result = std::process::Command::new("xdg-open").arg(url).spawn();
    result.map(|_| ()).map_err(|_| "auth/google-failed".into())
}
fn login(client_id: String, control: GoogleLogin) -> Result<String, String> {
    let _running = Running(control.running.clone());
    if !client_id.ends_with(".apps.googleusercontent.com")
        || client_id.len() > 200
        || !client_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
    {
        return Err("auth/google-not-configured".into());
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| "auth/google-failed")?;
    listener
        .set_nonblocking(true)
        .map_err(|_| "auth/google-failed")?;
    let redirect = format!(
        "http://127.0.0.1:{}/oauth/callback",
        listener
            .local_addr()
            .map_err(|_| "auth/google-failed")?
            .port()
    );
    let verifier = random_token();
    let state = random_token();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("client_id", client_id.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("response_type", "code"),
        ("scope", "openid email profile"),
        ("state", state.as_str()),
        ("code_challenge", challenge.as_str()),
        ("code_challenge_method", "S256"),
        ("prompt", "select_account"),
    ]);
    open_browser(url.as_str())?;
    let started = Instant::now();
    let code = loop {
        if control.cancel.load(Ordering::SeqCst) {
            return Err("auth/google-cancelled".into());
        }
        if started.elapsed() > Duration::from_secs(120) {
            return Err("auth/google-timeout".into());
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
                stream.set_write_timeout(Some(Duration::from_secs(2))).ok();
                let mut bytes = Vec::new();
                let mut part = [0u8; 1024];
                while bytes.len() < 8192 && !bytes.windows(4).any(|w| w == b"\r\n\r\n") {
                    match stream.read(&mut part) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => bytes.extend_from_slice(&part[..n]),
                    }
                }
                let request = String::from_utf8_lossy(&bytes);
                let target = request
                    .lines()
                    .next()
                    .and_then(|line| line.strip_prefix("GET "))
                    .and_then(|line| line.split(' ').next())
                    .unwrap_or("");
                let result = if target.starts_with('/') {
                    callback(target, &state)
                } else {
                    Ok(None)
                };
                let valid = !matches!(&result, Ok(None));
                let body = if matches!(&result, Ok(Some(_))) {
                    "Sign-in received. Return to Lessavio. You can close this tab."
                } else {
                    "Sign-in was not completed. Return to Lessavio."
                };
                let _=write!(stream,"HTTP/1.1 {}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{}",if valid{"200 OK"}else{"400 Bad Request"},body.len(),body);
                match result {
                    Ok(Some(code)) => break code,
                    Err(e) => return Err(e),
                    _ => {}
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(50))
            }
            Err(_) => return Err("auth/google-failed".into()),
        }
    };
    if control.cancel.load(Ordering::SeqCst) {
        return Err("auth/google-cancelled".into());
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "auth/google-failed")?;
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("code", code.as_str()),
            ("code_verifier", verifier.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect.as_str()),
        ])
        .send()
        .map_err(|_| "auth/network-request-failed")?;
    if !response.status().is_success() {
        return Err("auth/google-failed".into());
    }
    let value: serde_json::Value = response.json().map_err(|_| "auth/google-failed")?;
    if control.cancel.load(Ordering::SeqCst) {
        return Err("auth/google-cancelled".into());
    }
    value["id_token"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| "auth/google-failed".into())
}
#[tauri::command]
pub async fn google_login(
    control: State<'_, GoogleLogin>,
    client_id: String,
) -> Result<String, String> {
    if control
        .running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("auth/google-failed".into());
    }
    control.cancel.store(false, Ordering::SeqCst);
    let control = control.inner().clone();
    tauri::async_runtime::spawn_blocking(move || login(client_id, control))
        .await
        .map_err(|_| "auth/google-failed".to_string())?
}
#[tauri::command]
pub fn cancel_google_login(control: State<'_, GoogleLogin>) {
    control.cancel.store(true, Ordering::SeqCst);
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn callback_requires_exact_state_path_and_single_code() {
        assert_eq!(
            callback("/oauth/callback?state=expected&code=abc", "expected").unwrap(),
            Some("abc".into())
        );
        assert_eq!(
            callback("/oauth/callback?state=wrong&code=abc", "expected").unwrap(),
            None
        );
        assert_eq!(
            callback("/other?state=expected&code=abc", "expected").unwrap(),
            None
        );
        assert_eq!(
            callback(
                "/oauth/callback?state=expected&state=wrong&code=abc",
                "expected"
            )
            .unwrap(),
            None
        );
        assert!(callback("/oauth/callback?state=expected&code=a&code=b", "expected").is_err());
        assert_eq!(
            callback(
                "/oauth/callback?state=expected&error=access_denied",
                "expected"
            )
            .unwrap_err(),
            "auth/google-cancelled"
        );
    }
    #[test]
    fn pkce_s256_matches_rfc7636() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes())),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }
}
