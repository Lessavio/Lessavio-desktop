#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{params, Connection};
use std::{fs, sync::Mutex, time::Duration};
use tauri::{Manager, State};
use tauri_plugin_notification::NotificationExt;
mod google_auth;
mod reminders;
mod repository;
#[derive(Default)]
struct WorkspaceContext {
    generation: u64,
    scope: Option<String>,
}
struct Database(Mutex<Connection>, Mutex<WorkspaceContext>);
fn validate(payload: &str) -> Result<(), String> {
    if payload.len() > 20_000_000 {
        return Err("Файл слишком большой (максимум 20 МБ)".into());
    }
    let value: serde_json::Value = serde_json::from_str(payload).map_err(|e| e.to_string())?;
    if value["version"] != 1
        || !value["students"].is_array()
        || !value["lessons"].is_array()
        || !value["payments"].is_array()
        || !(value["profile"].is_object() || value["profile"].is_null())
    {
        return Err("Неподдерживаемый формат данных".into());
    }
    Ok(())
}
#[tauri::command]
fn load_workspace(db: State<Database>, scope: String) -> Result<Option<String>, String> {
    let generation = db.1.lock().map_err(|e| e.to_string())?.generation;
    let result = repository::load(&*db.0.lock().map_err(|e| e.to_string())?, &scope)?;
    let mut context = db.1.lock().map_err(|e| e.to_string())?;
    if context.generation == generation {
        context.scope = Some(scope);
    }
    Ok(result)
}
#[tauri::command]
fn deactivate_workspace(db: State<Database>) -> Result<(), String> {
    let mut context = db.1.lock().map_err(|e| e.to_string())?;
    context.generation += 1;
    context.scope = None;
    Ok(())
}
#[tauri::command]
fn save_workspace(db: State<Database>, payload: String, scope: String) -> Result<(), String> {
    validate(&payload)?;
    repository::persist(
        &mut *db.0.lock().map_err(|e| e.to_string())?,
        &scope,
        &payload,
    )
}
#[tauri::command]
fn copy_guest_workspace(db: State<Database>, scope: String) -> Result<(), String> {
    repository::scope_valid(&scope)?;
    if scope == "guest" {
        return Err("Invalid account identity".into());
    }
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    repository::copy_guest(&mut conn, &scope)
}
#[tauri::command]
async fn export_backup(
    db: State<'_, Database>,
    language: String,
    scope: String,
) -> Result<bool, String> {
    let payload: Option<String> =
        { repository::load(&*db.0.lock().map_err(|e| e.to_string())?, &scope)? };
    let Some(payload) = payload else {
        return Err("Сначала создайте профиль".into());
    };
    let file = rfd::AsyncFileDialog::new()
        .set_title(match language.as_str() {
            "uk" => "Зберегти резервну копію",
            "en" => "Save backup",
            _ => "Сохранить резервную копию",
        })
        .set_file_name("Lessavio-backup.json")
        .add_filter("Lessavio backup", &["json"])
        .save_file()
        .await;
    if let Some(file) = file {
        file.write(payload.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}
#[tauri::command]
async fn read_backup(language: String) -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title(match language.as_str() {
            "uk" => "Відновити резервну копію",
            "en" => "Restore backup",
            _ => "Восстановить резервную копию",
        })
        .add_filter("Lessavio backup", &["json"])
        .pick_file()
        .await;
    if let Some(file) = file {
        if fs::metadata(file.path()).map_err(|e| e.to_string())?.len() > 20_000_000 {
            return Err("Файл слишком большой".into());
        }
        let payload = fs::read_to_string(file.path()).map_err(|e| e.to_string())?;
        validate(&payload)?;
        return Ok(Some(payload));
    }
    Ok(None)
}
fn main() {
    tauri::Builder::default().manage(google_auth::GoogleLogin::default()).plugin(tauri_plugin_notification::init()).plugin(tauri_plugin_single_instance::init(|app, _, _| {
        if let Some(window) = app.get_webview_window("main") { let _ = window.unminimize(); let _ = window.set_focus(); }
    })).setup(|app| {
        let dir = app.path().app_data_dir()?;
        fs::create_dir_all(&dir)?;
        // Keep the original filename and application identifier so existing workspaces remain accessible.
        let mut conn = Connection::open(dir.join("tutorly.sqlite"))?;
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;")?;
        repository::initialize(&mut conn)?;
        app.manage(Database(Mutex::new(conn),Mutex::new(WorkspaceContext::default())));
        let handle=app.handle().clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(15));
            let state=handle.state::<Database>();
            let scope=state.1.lock().ok().and_then(|context|context.scope.clone());
            let Some(scope)=scope else {continue;};
            let payload: Option<String> = match state.0.lock() {
                Ok(conn)=>repository::load(&conn,&scope).ok().flatten(),
                Err(_)=>None,
            };
            let Some(payload)=payload else { continue; };
            let Ok(workspace)=serde_json::from_str::<serde_json::Value>(&payload) else { continue; };
            for reminder in reminders::due(&workspace,chrono::Utc::now().timestamp()) {
                // Serialize the final eligibility check with saves and account changes.
                // A lesson cancelled/moved after the earlier snapshot must not notify.
                let Ok(conn)=state.0.lock() else {continue;};
                let Ok(context)=state.1.lock() else {continue;};
                if context.scope.as_deref()!=Some(scope.as_str()){continue;}
                let Some(current)=repository::load(&conn,&scope).ok().flatten().and_then(|raw|serde_json::from_str::<serde_json::Value>(&raw).ok()) else {continue;};
                if !reminders::due(&current,chrono::Utc::now().timestamp()).iter().any(|item|item.id==reminder.id&&item.starts_at==reminder.starts_at&&item.lead==reminder.lead){continue;}
                let already_sent=conn.query_row("SELECT EXISTS(SELECT 1 FROM local_notifications WHERE lesson_id=?1 AND starts_at=?2 AND lead=?3 AND scope=?4)",params![reminder.id,reminder.starts_at,reminder.lead,scope],|row|row.get::<_,bool>(0)).unwrap_or(true);
                if already_sent {continue;}
                if handle.notification().builder().title(&reminder.title).body(&reminder.body).show().is_ok(){
                    let _=conn.execute("INSERT OR IGNORE INTO local_notifications(lesson_id,starts_at,lead,scope) VALUES(?1,?2,?3,?4)",params![reminder.id,reminder.starts_at,reminder.lead,scope]);
                }
            }
            if let Ok(conn)=state.0.lock() { let _=conn.execute("DELETE FROM local_notifications WHERE starts_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')",[]); };
        });
        Ok(())
    }).invoke_handler(tauri::generate_handler![google_auth::google_login, google_auth::cancel_google_login, load_workspace, copy_guest_workspace, deactivate_workspace, save_workspace, export_backup, read_backup]).run(tauri::generate_context!()).expect("Could not start Lessavio");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_backup_versions() {
        assert!(validate(
            r#"{"version":2,"students":[],"lessons":[],"payments":[],"profile":null}"#
        )
        .is_err());
        assert!(validate("not json").is_err());
        assert!(validate(
            r#"{"version":1,"students":[],"lessons":[],"payments":[],"profile":null}"#
        )
        .is_ok());
    }
}
