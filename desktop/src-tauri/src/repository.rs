use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::collections::BTreeMap;

pub fn scope_valid(scope: &str) -> Result<(), String> {
    if scope == "guest"
        || (scope.starts_with("firebase:")
            && scope.len() <= 300
            && scope.split(':').count() == 3
            && scope.split(':').skip(1).all(|part| {
                !part.is_empty()
                    && part
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
            }))
    {
        Ok(())
    } else {
        Err("Invalid workspace scope".into())
    }
}
pub fn initialize(conn: &mut Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version > 2 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let tx = conn.transaction()?;
    tx.execute_batch("CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS backups(day TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS local_workspaces(scope TEXT PRIMARY KEY,workspace_id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS local_backups(scope TEXT NOT NULL,day TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(scope,day));
      CREATE TABLE IF NOT EXISTS local_changes(sequence INTEGER PRIMARY KEY AUTOINCREMENT,scope TEXT NOT NULL,revision INTEGER NOT NULL,entity TEXT NOT NULL,entity_id TEXT NOT NULL,operation TEXT NOT NULL CHECK(operation IN ('upsert','delete')),payload TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS local_changes_scope ON local_changes(scope,sequence);
      CREATE TABLE IF NOT EXISTS local_record_versions(scope TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(scope,entity,entity_id));
      CREATE TABLE IF NOT EXISTS local_notifications(scope TEXT NOT NULL,lesson_id TEXT NOT NULL,starts_at TEXT NOT NULL,lead INTEGER NOT NULL,PRIMARY KEY(scope,lesson_id,starts_at,lead));
      INSERT OR IGNORE INTO local_workspaces(scope,payload) SELECT 'guest',payload FROM workspace WHERE id=1;
      INSERT OR IGNORE INTO local_backups(scope,day,payload) SELECT 'guest',day,payload FROM backups;
      PRAGMA user_version=2;")?;
    if version < 2 {
        let legacy_log:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='notification_log')",[],|r|r.get(0))?;
        if legacy_log {
            tx.execute("INSERT OR IGNORE INTO local_notifications(scope,lesson_id,starts_at,lead) SELECT 'guest',lesson_id,starts_at,lead FROM notification_log",[])?;
        }
    }
    tx.commit()
}
pub fn load(conn: &Connection, scope: &str) -> Result<Option<String>, String> {
    scope_valid(scope)?;
    conn.query_row(
        "SELECT payload FROM local_workspaces WHERE scope=?1",
        [scope],
        |r| r.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}
fn records(value: &Value) -> BTreeMap<(String, String), Value> {
    let mut entries = BTreeMap::new();
    if !value["profile"].is_null() {
        entries.insert(
            ("profile".into(), "profile".into()),
            value["profile"].clone(),
        );
    }
    for entity in ["students", "lessons", "payments"] {
        if let Some(items) = value[entity].as_array() {
            for item in items {
                if let Some(id) = item["id"].as_str() {
                    entries.insert((entity.into(), id.into()), item.clone());
                }
            }
        }
    }
    entries
}
pub fn persist(conn: &mut Connection, scope: &str, payload: &str) -> Result<(), String> {
    scope_valid(scope)?;
    let next: Value = serde_json::from_str(payload).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let previous: Option<(String, i64)> = tx
        .query_row(
            "SELECT payload,revision FROM local_workspaces WHERE scope=?1",
            [scope],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let old_value = previous
        .as_ref()
        .map(|(raw, _)| serde_json::from_str::<Value>(raw))
        .transpose()
        .map_err(|e| e.to_string())?
        .unwrap_or(Value::Null);
    if old_value == next {
        return Ok(());
    }
    let revision = previous
        .as_ref()
        .map(|(_, revision)| revision + 1)
        .unwrap_or(1);
    tx.execute("INSERT OR IGNORE INTO local_backups(scope,day,payload) SELECT scope,date('now'),payload FROM local_workspaces WHERE scope=?1",[scope]).map_err(|e|e.to_string())?;
    tx.execute("DELETE FROM local_backups WHERE scope=?1 AND day NOT IN (SELECT day FROM local_backups WHERE scope=?1 ORDER BY day DESC LIMIT 14)",[scope]).map_err(|e|e.to_string())?;
    let old = records(&old_value);
    let new = records(&next);
    let keys: std::collections::BTreeSet<_> = old.keys().chain(new.keys()).cloned().collect();
    for (entity, id) in keys {
        if old.get(&(entity.clone(), id.clone())) == new.get(&(entity.clone(), id.clone())) {
            continue;
        }
        let record = new.get(&(entity.clone(), id.clone()));
        let operation = if record.is_some() { "upsert" } else { "delete" };
        let raw = record.map(Value::to_string);
        tx.execute("INSERT INTO local_changes(scope,revision,entity,entity_id,operation,payload) VALUES(?1,?2,?3,?4,?5,?6)",params![scope,revision,entity,id,operation,raw]).map_err(|e|e.to_string())?;
        tx.execute("INSERT INTO local_record_versions(scope,entity,entity_id,revision,deleted) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(scope,entity,entity_id) DO UPDATE SET revision=excluded.revision,deleted=excluded.deleted,updated_at=CURRENT_TIMESTAMP",params![scope,entity,id,revision,record.is_none()]).map_err(|e|e.to_string())?;
    }
    tx.execute("INSERT INTO local_workspaces(scope,payload,revision) VALUES(?1,?2,?3) ON CONFLICT(scope) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,updated_at=CURRENT_TIMESTAMP",params![scope,payload,revision]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
pub fn copy_guest(conn: &mut Connection, scope: &str) -> Result<(), String> {
    scope_valid(scope)?;
    if scope == "guest" {
        return Err("Invalid account identity".into());
    }
    if let Some(existing) = load(conn, scope)? {
        let value: Value = serde_json::from_str(&existing).map_err(|e| e.to_string())?;
        if !value["profile"].is_null()
            || ["students", "lessons", "payments"]
                .iter()
                .any(|key| value[*key].as_array().is_some_and(|a| !a.is_empty()))
        {
            return Err("Пространство аккаунта уже содержит данные".into());
        }
    }
    let source = load(conn, "guest")?.ok_or("Нет локальных данных для копирования")?;
    let value: Value = serde_json::from_str(&source).map_err(|e| e.to_string())?;
    if value["profile"].is_null() {
        return Err("Нет локальных данных для копирования".into());
    }
    persist(conn, scope, &source)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        initialize(&mut c).unwrap();
        c
    }
    fn payload(name: &str) -> String {
        serde_json::json!({"version":1,"profile":{"name":name},"students":[],"lessons":[],"payments":[]}).to_string()
    }
    #[test]
    fn scopes_and_snapshots_are_isolated() {
        let mut c = db();
        persist(&mut c, "guest", &payload("guest")).unwrap();
        persist(&mut c, "firebase:test:alice", &payload("Alice")).unwrap();
        persist(&mut c, "firebase:test:alice", &payload("Alice updated")).unwrap();
        assert_eq!(load(&c, "guest").unwrap(), Some(payload("guest")));
        assert!(load(&c, "firebase:test:bob").unwrap().is_none());
        let backup: String = c
            .query_row(
                "SELECT payload FROM local_backups WHERE scope='firebase:test:alice'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(backup, payload("Alice"));
    }
    #[test]
    fn migrates_old_workspace_once_without_changing_ids() {
        let mut c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE workspace(id INTEGER PRIMARY KEY,payload TEXT);CREATE TABLE backups(day TEXT PRIMARY KEY,payload TEXT);").unwrap();
        c.execute("INSERT INTO workspace VALUES(1,?1)", [payload("legacy")])
            .unwrap();
        initialize(&mut c).unwrap();
        persist(&mut c, "guest", &payload("updated")).unwrap();
        initialize(&mut c).unwrap();
        assert_eq!(load(&c, "guest").unwrap(), Some(payload("updated")));
    }
    #[test]
    fn revisions_changes_and_deletion_tombstones_are_atomic() {
        let mut c = db();
        let mut w: Value = serde_json::from_str(&payload("A")).unwrap();
        w["students"] = serde_json::json!([{"id":"s","name":"Anna"}]);
        persist(&mut c, "guest", &w.to_string()).unwrap();
        persist(&mut c, "guest", &w.to_string()).unwrap();
        w["students"] = serde_json::json!([]);
        persist(&mut c, "guest", &w.to_string()).unwrap();
        let (revision, deleted): (i64, bool) = c
            .query_row(
                "SELECT revision,deleted FROM local_record_versions WHERE entity='students'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!((revision, deleted), (2, true));
        let count: i64 = c
            .query_row(
                "SELECT count(*) FROM local_changes WHERE operation='delete'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        assert!(persist(&mut c, "firebase:test:other", "invalid json").is_err());
        assert!(load(&c, "firebase:test:other").unwrap().is_none());
    }
    #[test]
    fn guest_copy_is_explicit_and_never_overwrites_an_existing_account() {
        let mut c = db();
        persist(&mut c, "guest", &payload("Guest")).unwrap();
        copy_guest(&mut c, "firebase:test:alice").unwrap();
        assert_eq!(
            load(&c, "firebase:test:alice").unwrap(),
            load(&c, "guest").unwrap()
        );
        assert!(copy_guest(&mut c, "firebase:test:alice").is_err());
        assert!(copy_guest(&mut c, "guest").is_err());
        let ids: Vec<String> = c
            .prepare("SELECT workspace_id FROM local_workspaces")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(Result::unwrap)
            .collect();
        assert_ne!(ids[0], ids[1]);
    }
    #[test]
    fn migration_failure_leaves_newer_schema_untouched() {
        let mut c = db();
        c.execute_batch("PRAGMA user_version=3;").unwrap();
        assert!(initialize(&mut c).is_err());
        assert_eq!(
            c.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            3
        );
    }
    #[test]
    fn migration_preserves_sent_guest_reminders_without_replaying_legacy_logs() {
        let mut c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE notification_log(lesson_id TEXT,starts_at TEXT,lead INTEGER); INSERT INTO notification_log VALUES('lesson','2026-10-23T10:00:00Z',15); PRAGMA user_version=1;").unwrap();
        initialize(&mut c).unwrap();
        let count: i64 = c
            .query_row(
                "SELECT count(*) FROM local_notifications WHERE scope='guest'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        c.execute("DELETE FROM local_notifications", []).unwrap();
        initialize(&mut c).unwrap();
        assert_eq!(
            c.query_row("SELECT count(*) FROM local_notifications", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}
