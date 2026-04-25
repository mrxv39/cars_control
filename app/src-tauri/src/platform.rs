use rusqlite::{Connection, Result as SqlResult};

// Stub para una feature "platform-specific tables" que nunca llegó a
// implementarse — `db.rs::init_db` la invoca y `lib.rs:16` la declara
// como módulo, pero el archivo no existía y rompía `cargo check`.
//
// Mantener no-op hasta decidir qué guarda esta tabla (idea original
// no documentada). Devolver Ok(()) preserva el flujo de inicialización.
pub fn init_platform_tables(_conn: &Connection) -> SqlResult<()> {
    Ok(())
}
