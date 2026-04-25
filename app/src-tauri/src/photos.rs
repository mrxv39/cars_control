use std::fs;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::validate_vehicle_folder;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VehiclePhoto {
    file_name: String,
    data_url: String,
}

#[tauri::command]
pub fn list_vehicle_photos(app: AppHandle, folder_path: String) -> Result<Vec<VehiclePhoto>, String> {
    let folder = validate_vehicle_folder(&app, &folder_path)?;

    let mut photos = Vec::new();
    let entries = fs::read_dir(&folder)
        .map_err(|e| format!("No se pudo leer la carpeta: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path.extension().and_then(|v| v.to_str()).unwrap_or("").to_lowercase();
        if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp") {
            let bytes = fs::read(&path)
                .map_err(|e| format!("No se pudo leer la imagen: {e}"))?;
            let mime = match ext.as_str() {
                "png" => "image/png",
                "webp" => "image/webp",
                _ => "image/jpeg",
            };
            let file_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            photos.push(VehiclePhoto {
                file_name,
                data_url: format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)),
            });
        }
    }

    photos.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    Ok(photos)
}

#[tauri::command]
pub fn save_vehicle_photo(app: AppHandle, folder_path: String, photo_data: String, file_name: String) -> Result<(), String> {
    let folder = validate_vehicle_folder(&app, &folder_path)?;

    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("Nombre de archivo no válido.".to_string());
    }

    let allowed_extensions = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
    let has_valid_ext = file_name.rsplit('.').next()
        .map(|ext| allowed_extensions.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false);
    if !has_valid_ext {
        return Err("Extensión de archivo no permitida. Use: jpg, jpeg, png, webp, gif, bmp.".to_string());
    }

    let base64_data = photo_data
        .split(',')
        .nth(1)
        .unwrap_or(&photo_data);

    let bytes = STANDARD.decode(base64_data)
        .map_err(|e| format!("No se pudo decodificar la imagen: {e}"))?;

    if bytes.len() > 10 * 1024 * 1024 {
        return Err("La imagen excede el tamaño máximo de 10MB.".to_string());
    }

    let dest = folder.join(&file_name);
    fs::write(&dest, &bytes)
        .map_err(|e| format!("No se pudo guardar la imagen: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn delete_vehicle_photo(app: AppHandle, folder_path: String, file_name: String) -> Result<(), String> {
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("Nombre de archivo no válido.".to_string());
    }

    let folder = validate_vehicle_folder(&app, &folder_path)?;
    let path = folder.join(&file_name);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("No se pudo eliminar la foto: {e}"))?;
    }
    Ok(())
}
