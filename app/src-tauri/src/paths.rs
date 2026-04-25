use std::{
    fs,
    path::{Path, PathBuf},
};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::db;

pub(crate) const DATA_DIR: &str = "data";
pub(crate) const STOCK_DIR: &str = "stock";
pub(crate) const BACKUPS_DIR: &str = "backups";
pub(crate) const DB_FILE: &str = "app.db";
pub(crate) const LEADS_FILE: &str = "leads.json";
pub(crate) const CLIENTS_FILE: &str = "clients.json";
pub(crate) const VEHICLE_ADS_FILE: &str = "vehicle_ads.json";

pub(crate) fn app_data_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("No se pudo obtener el directorio de datos: {error}"))?;

    let data_dir = app_data_dir.join(DATA_DIR);
    fs::create_dir_all(&data_dir).map_err(|error| {
        format!(
            "No se pudo crear la carpeta de datos {}: {error}",
            data_dir.display()
        )
    })?;

    Ok(data_dir)
}

pub(crate) fn project_root_dir() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| "No se pudo resolver la raíz del proyecto.".to_string())
}

pub(crate) fn docs_legacy_dir() -> Result<PathBuf, String> {
    Ok(project_root_dir()?.join("docs_legacy"))
}

pub(crate) fn app_stock_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let stock_dir = app_data_root_dir(app)?.join(STOCK_DIR);
    fs::create_dir_all(&stock_dir)
        .map_err(|error| format!("No se pudo crear la carpeta de stock: {error}"))?;

    Ok(stock_dir)
}

pub(crate) fn canonical_stock_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let stock_dir = app_stock_dir(app)?;
    stock_dir.canonicalize().map_err(|error| {
        format!(
            "No se pudo resolver la carpeta de stock {}: {error}",
            stock_dir.display()
        )
    })
}

pub(crate) fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root_dir(app)?.join(DB_FILE))
}

pub(crate) fn get_db_connection(app: &AppHandle) -> Result<Connection, String> {
    let db_file = db_path(app)?;
    let conn = Connection::open(&db_file)
        .map_err(|error| format!("No se pudo abrir la base de datos: {error}"))?;
    db::init_db(&conn)
        .map_err(|error| format!("No se pudo inicializar la base de datos: {error}"))?;
    Ok(conn)
}

pub(crate) fn leads_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root_dir(app)?.join(LEADS_FILE))
}

pub(crate) fn clients_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root_dir(app)?.join(CLIENTS_FILE))
}

pub(crate) fn vehicle_ads_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root_dir(app)?.join(VEHICLE_ADS_FILE))
}

pub(crate) fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let backups_dir = app_data_root_dir(app)?.join(BACKUPS_DIR);
    fs::create_dir_all(&backups_dir).map_err(|error| {
        format!(
            "No se pudo crear la carpeta de copias {}: {error}",
            backups_dir.display()
        )
    })?;
    Ok(backups_dir)
}
