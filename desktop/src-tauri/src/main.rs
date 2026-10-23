#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{params, Connection, OptionalExtension};
use std::{fs, sync::Mutex, time::Duration};
use tauri::{Manager, State};
struct Database(Mutex<Connection>);
fn validate(payload: &str) -> Result<(), String> {
    if payload.len() > 20_000_000 { return Err("Файл слишком большой (максимум 20 МБ)".into()); }
    let value: serde_json::Value = serde_json::from_str(payload).map_err(|e| e.to_string())?;
    if value["version"] != 1 || !value["students"].is_array() || !value["lessons"].is_array() || !value["payments"].is_array() || !(value["profile"].is_object() || value["profile"].is_null()) {
        return Err("Неподдерживаемый формат данных".into());
    }
    Ok(())
}
#[tauri::command]
fn load_workspace(db: State<Database>) -> Result<Option<String>, String> {
    db.0.lock().map_err(|e| e.to_string())?.query_row("SELECT payload FROM workspace WHERE id=1", [], |r| r.get(0)).optional().map_err(|e| e.to_string())
}
#[tauri::command]
fn save_workspace(db: State<Database>, payload: String) -> Result<(), String> {
    validate(&payload)?;
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    persist(&mut conn, &payload)
}
fn persist(conn: &mut Connection, payload: &str) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    // Preserve the previous state once per UTC day, including before a restore.
    tx.execute("INSERT OR IGNORE INTO backups(day,payload) SELECT date('now'),payload FROM workspace WHERE id=1", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM backups WHERE day NOT IN (SELECT day FROM backups ORDER BY day DESC LIMIT 14)", []).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO workspace(id,payload) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload", params![payload]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
async fn export_backup(db: State<'_, Database>) -> Result<bool, String> {
    let payload: Option<String> = { db.0.lock().map_err(|e| e.to_string())?.query_row("SELECT payload FROM workspace WHERE id=1", [], |r|r.get(0)).optional().map_err(|e|e.to_string())? };
    let Some(payload) = payload else { return Err("Сначала создайте профиль".into()) };
    let file = rfd::AsyncFileDialog::new().set_title("Сохранить резервную копию").set_file_name("Tutorly-backup.json").add_filter("Tutorly backup", &["json"]).save_file().await;
    if let Some(file) = file { file.write(payload.as_bytes()).await.map_err(|e| e.to_string())?; return Ok(true); }
    Ok(false)
}
#[tauri::command]
async fn read_backup() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new().set_title("Восстановить резервную копию").add_filter("Tutorly backup", &["json"]).pick_file().await;
    if let Some(file) = file {
        if fs::metadata(file.path()).map_err(|e|e.to_string())?.len() > 20_000_000 { return Err("Файл слишком большой".into()); }
        let payload = fs::read_to_string(file.path()).map_err(|e|e.to_string())?;
        validate(&payload)?; return Ok(Some(payload));
    }
    Ok(None)
}
fn main() {
    tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, _, _| {
        if let Some(window) = app.get_webview_window("main") { let _ = window.unminimize(); let _ = window.set_focus(); }
    })).setup(|app| {
        let dir = app.path().app_data_dir()?;
        fs::create_dir_all(&dir)?;
        let conn = Connection::open(dir.join("tutorly.sqlite"))?;
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS backups(day TEXT PRIMARY KEY,payload TEXT NOT NULL); PRAGMA user_version=1;")?;
        app.manage(Database(Mutex::new(conn)));
        Ok(())
    }).invoke_handler(tauri::generate_handler![load_workspace, save_workspace, export_backup, read_backup]).run(tauri::generate_context!()).expect("Не удалось запустить Tutorly");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn persists_and_preserves_previous_state() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE workspace(id INTEGER PRIMARY KEY,payload TEXT NOT NULL); CREATE TABLE backups(day TEXT PRIMARY KEY,payload TEXT NOT NULL);").unwrap();
        persist(&mut conn, "first").unwrap();
        persist(&mut conn, "second").unwrap();
        persist(&mut conn, "third").unwrap();
        let current: String = conn.query_row("SELECT payload FROM workspace WHERE id=1", [], |r| r.get(0)).unwrap();
        let previous: String = conn.query_row("SELECT payload FROM backups", [], |r| r.get(0)).unwrap();
        assert_eq!(current, "third");
        assert_eq!(previous, "first");
    }
    #[test]
    fn rejects_invalid_backup_versions() {
        assert!(validate(r#"{"version":2,"students":[],"lessons":[],"payments":[],"profile":null}"#).is_err());
        assert!(validate("not json").is_err());
        assert!(validate(r#"{"version":1,"students":[],"lessons":[],"payments":[],"profile":null}"#).is_ok());
    }
}
