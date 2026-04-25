use std::{
    fs,
    path::{Path, PathBuf},
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{
    db, ensure_unique_vehicle_path, read_collection, sanitize_text_field, sanitize_vehicle_name,
    save_clients, save_leads, validate_vehicle_folder, write_collection, Client, Lead,
};
use crate::paths::{
    app_stock_dir, canonical_stock_dir, clients_file_path, get_db_connection, leads_file_path,
    vehicle_ads_file_path,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StockVehicle {
    pub name: String,
    pub folder_path: String,
    pub ad_info: Option<VehicleAdInfo>,
    #[serde(default)]
    pub precio_compra: Option<f64>,
    #[serde(default)]
    pub precio_venta: Option<f64>,
    #[serde(default)]
    pub km: Option<u32>,
    #[serde(default)]
    pub anio: Option<u16>,
    #[serde(default)]
    pub estado: String, // "disponible", "reservado", "vendido"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct VehicleAdInfo {
    pub url: String,
    pub status: String,
    pub date: String,
}

#[derive(Debug, Deserialize)]
pub struct VehicleAdInput {
    pub url: String,
    pub status: String,
    pub date: String,
}

pub(crate) fn stock_vehicle_from_path(path: &Path) -> Result<StockVehicle, String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            format!(
                "No se pudo obtener el nombre de la carpeta {}",
                path.display()
            )
        })?;

    Ok(StockVehicle {
        name,
        folder_path: path.to_string_lossy().to_string(),
        ad_info: None,
        precio_compra: None,
        precio_venta: None,
        km: None,
        anio: None,
        estado: "disponible".to_string(),
    })
}

fn read_vehicle_ads_map(
    app: &AppHandle,
) -> Result<std::collections::BTreeMap<String, VehicleAdInfo>, String> {
    let items = read_collection::<(String, VehicleAdInfo)>(&vehicle_ads_file_path(app)?)?;
    Ok(items.into_iter().collect())
}

fn save_vehicle_ads_map(
    app: &AppHandle,
    map: &std::collections::BTreeMap<String, VehicleAdInfo>,
) -> Result<(), String> {
    let items = map
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<Vec<_>>();
    write_collection(&vehicle_ads_file_path(app)?, &items)
}

fn rewrite_vehicle_reference_in_contacts(
    app: &AppHandle,
    old_path: &str,
    new_path: Option<&str>,
) -> Result<(), String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(app)?)?;
    let mut clients = read_collection::<Client>(&clients_file_path(app)?)?;

    for lead in &mut leads {
        if lead.vehicle_folder_path.as_deref() == Some(old_path) {
            lead.vehicle_folder_path = new_path.map(ToOwned::to_owned);
        }
    }

    for client in &mut clients {
        if client.vehicle_folder_path.as_deref() == Some(old_path) {
            client.vehicle_folder_path = new_path.map(ToOwned::to_owned);
        }
    }

    save_leads(app, &leads)?;
    save_clients(app, &clients)
}

pub(crate) fn list_stock(app: &AppHandle) -> Result<(String, Vec<StockVehicle>), String> {
    let stock_dir = app_stock_dir(app)?;
    let vehicle_ads = read_vehicle_ads_map(app)?;

    let conn = get_db_connection(app)?;
    let db_vehicles = db::load_vehicles(&conn)
        .map_err(|e| format!("Error al cargar vehiculos de BD: {}", e))?;
    let db_map: std::collections::HashMap<String, StockVehicle> = db_vehicles
        .into_iter()
        .map(|v| (v.folder_path.clone(), v))
        .collect();

    let mut vehicles = Vec::new();

    if let Ok(entries) = fs::read_dir(&stock_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let folder_path = path.to_string_lossy().to_string();
                if let Some(db_vehicle) = db_map.get(&folder_path) {
                    let mut vehicle = db_vehicle.clone();
                    if vehicle.ad_info.is_none() {
                        vehicle.ad_info = vehicle_ads.get(&folder_path).cloned();
                    }
                    if vehicle.estado != "vendido" {
                        vehicles.push(vehicle);
                    }
                } else {
                    let mut vehicle = stock_vehicle_from_path(&path)?;
                    vehicle.ad_info = vehicle_ads.get(&vehicle.folder_path).cloned();
                    vehicles.push(vehicle);
                }
            }
        }
    }

    vehicles.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    Ok((stock_dir.to_string_lossy().to_string(), vehicles))
}

fn first_jpeg_in_dir(dir: &Path) -> Result<Option<PathBuf>, String> {
    let mut dirs = vec![dir.to_path_buf()];

    while let Some(current_dir) = dirs.pop() {
        let mut child_dirs = Vec::new();
        let mut image_files = Vec::new();
        let entries = fs::read_dir(&current_dir).map_err(|error| {
            format!(
                "No se pudo leer la carpeta {}: {error}",
                current_dir.display()
            )
        })?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                child_dirs.push(path);
                continue;
            }

            let extension = path.extension().and_then(|value| value.to_str());
            if matches!(
                extension,
                Some("jpg") | Some("jpeg") | Some("JPG") | Some("JPEG")
            ) {
                image_files.push(path);
            }
        }

        child_dirs.sort();
        dirs.extend(child_dirs.into_iter().rev());

        image_files.sort();
        if let Some(first_image) = image_files.into_iter().next() {
            return Ok(Some(first_image));
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn get_vehicle_ad(app: AppHandle, folder_path: String) -> Result<Option<VehicleAdInfo>, String> {
    get_vehicle_ad_for_path(&app, &folder_path)
}

fn get_vehicle_ad_for_path(
    app: &AppHandle,
    folder_path: &str,
) -> Result<Option<VehicleAdInfo>, String> {
    let vehicle_folder = validate_vehicle_folder(app, folder_path)?;
    let ads = read_vehicle_ads_map(app)?;
    Ok(ads
        .get(&vehicle_folder.to_string_lossy().to_string())
        .cloned())
}

#[tauri::command]
pub fn get_stock_folder_path(app: AppHandle) -> Result<String, String> {
    app_stock_dir(&app).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_vehicle(app: AppHandle, name: String) -> Result<StockVehicle, String> {
    let stock_dir = app_stock_dir(&app)?;
    let sanitized_name = sanitize_vehicle_name(&name)?;
    let vehicle_path = ensure_unique_vehicle_path(&stock_dir, &sanitized_name, None)?;

    fs::create_dir_all(&vehicle_path).map_err(|error| {
        format!(
            "No se pudo crear la carpeta {}: {error}",
            vehicle_path.display()
        )
    })?;

    stock_vehicle_from_path(&vehicle_path)
}

#[tauri::command]
pub fn rename_vehicle(
    app: AppHandle,
    folder_path: String,
    new_name: String,
) -> Result<StockVehicle, String> {
    let stock_dir = canonical_stock_dir(&app)?;
    let current_folder = validate_vehicle_folder(&app, &folder_path)?;
    let current_folder_string = current_folder.to_string_lossy().to_string();
    let sanitized_name = sanitize_vehicle_name(&new_name)?;
    let target_path =
        ensure_unique_vehicle_path(&stock_dir, &sanitized_name, Some(&current_folder))?;

    if target_path != current_folder {
        fs::rename(&current_folder, &target_path).map_err(|error| {
            format!(
                "No se pudo renombrar la carpeta {} a {}: {error}",
                current_folder.display(),
                target_path.display()
            )
        })?;

        let mut ads = read_vehicle_ads_map(&app)?;
        if let Some(ad_info) = ads.remove(&current_folder_string) {
            ads.insert(target_path.to_string_lossy().to_string(), ad_info);
            save_vehicle_ads_map(&app, &ads)?;
        }
        rewrite_vehicle_reference_in_contacts(
            &app,
            &current_folder_string,
            Some(&target_path.to_string_lossy()),
        )?;
    }

    let mut vehicle = stock_vehicle_from_path(&target_path)?;
    vehicle.ad_info = get_vehicle_ad_for_path(&app, &vehicle.folder_path)?;
    Ok(vehicle)
}

#[tauri::command]
pub fn delete_vehicle(app: AppHandle, folder_path: String) -> Result<(), String> {
    let current_folder = validate_vehicle_folder(&app, &folder_path)?;
    let current_folder_string = current_folder.to_string_lossy().to_string();
    fs::remove_dir_all(&current_folder).map_err(|error| {
        format!(
            "No se pudo eliminar la carpeta {}: {error}",
            current_folder.display()
        )
    })?;

    let mut ads = read_vehicle_ads_map(&app)?;
    if ads.remove(&current_folder_string).is_some() {
        save_vehicle_ads_map(&app, &ads)?;
    }
    rewrite_vehicle_reference_in_contacts(&app, &current_folder_string, None)
}

#[tauri::command]
pub fn set_vehicle_ad(
    app: AppHandle,
    folder_path: String,
    input: VehicleAdInput,
) -> Result<Option<VehicleAdInfo>, String> {
    let vehicle_folder = validate_vehicle_folder(&app, &folder_path)?;
    let vehicle_folder = vehicle_folder.to_string_lossy().to_string();
    let mut ads = read_vehicle_ads_map(&app)?;

    let ad_info = VehicleAdInfo {
        url: sanitize_text_field(&input.url),
        status: sanitize_text_field(&input.status),
        date: sanitize_text_field(&input.date),
    };

    if ad_info.url.is_empty() && ad_info.status.is_empty() && ad_info.date.is_empty() {
        ads.remove(&vehicle_folder);
        save_vehicle_ads_map(&app, &ads)?;
        return Ok(None);
    }

    ads.insert(vehicle_folder, ad_info.clone());
    save_vehicle_ads_map(&app, &ads)?;
    Ok(Some(ad_info))
}

#[tauri::command]
pub fn get_vehicle_thumbnail(app: AppHandle, folder_path: String) -> Result<Option<String>, String> {
    let folder = validate_vehicle_folder(&app, &folder_path)?;

    let Some(image_path) = first_jpeg_in_dir(&folder)? else {
        return Ok(None);
    };

    let image_bytes =
        fs::read(&image_path).map_err(|error| format!("No se pudo leer la imagen: {error}"))?;

    Ok(Some(format!(
        "data:image/jpeg;base64,{}",
        STANDARD.encode(image_bytes)
    )))
}
