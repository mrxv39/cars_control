use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{
    db, ensure_database_migrated, next_record_id, read_collection, sanitize_contact_name,
    sanitize_optional_path, sanitize_text_field, save_clients,
    validate_optional_vehicle_folder_path, Client, LeadNote,
};
use crate::paths::{clients_file_path, get_db_connection, leads_file_path};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Lead {
    pub id: u64,
    pub name: String,
    pub phone: String,
    pub email: String,
    pub notes: String,
    pub vehicle_interest: String,
    pub vehicle_folder_path: Option<String>,
    pub converted_client_id: Option<u64>,
    #[serde(default)]
    pub estado: String, // "nuevo", "contactado", "negociando", "cerrado", "perdido"
    #[serde(default)]
    pub fecha_contacto: Option<String>,
    #[serde(default)]
    pub canal: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LeadInput {
    pub name: String,
    pub phone: String,
    pub email: String,
    pub notes: String,
    pub vehicle_interest: String,
    pub vehicle_folder_path: Option<String>,
    #[serde(default)]
    pub estado: Option<String>,
    #[serde(default)]
    pub fecha_contacto: Option<String>,
    #[serde(default)]
    pub canal: Option<String>,
}

pub(crate) fn build_lead(
    id: u64,
    input: LeadInput,
    converted_client_id: Option<u64>,
) -> Result<Lead, String> {
    Ok(Lead {
        id,
        name: sanitize_contact_name(&input.name)?,
        phone: sanitize_text_field(&input.phone),
        email: sanitize_text_field(&input.email),
        notes: sanitize_text_field(&input.notes),
        vehicle_interest: sanitize_text_field(&input.vehicle_interest),
        vehicle_folder_path: sanitize_optional_path(input.vehicle_folder_path),
        converted_client_id,
        estado: input.estado.unwrap_or_else(|| "nuevo".to_string()),
        fecha_contacto: input.fecha_contacto,
        canal: input.canal,
    })
}

pub(crate) fn list_leads_internal(app: &AppHandle) -> Result<Vec<Lead>, String> {
    ensure_database_migrated(app)?;

    let conn = get_db_connection(app)?;
    let mut leads = db::load_leads(&conn)
        .map_err(|e| format!("Error al cargar leads: {}", e))?;
    leads.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(leads)
}

pub(crate) fn save_leads(app: &AppHandle, leads: &[Lead]) -> Result<(), String> {
    let conn = get_db_connection(app)?;
    for lead in leads {
        db::save_lead(&conn, lead)
            .map_err(|e| format!("Error al guardar lead: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_leads(app: AppHandle) -> Result<Vec<Lead>, String> {
    list_leads_internal(&app)
}

#[tauri::command]
pub fn create_lead(app: AppHandle, input: LeadInput) -> Result<Lead, String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    let next_id = next_record_id(&leads, |lead| lead.id);
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let lead = build_lead(
        next_id,
        LeadInput {
            vehicle_folder_path,
            ..input
        },
        None,
    )?;
    leads.push(lead.clone());
    save_leads(&app, &leads)?;
    Ok(lead)
}

#[tauri::command]
pub fn update_lead(app: AppHandle, id: u64, input: LeadInput) -> Result<Lead, String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    let index = leads
        .iter()
        .position(|lead| lead.id == id)
        .ok_or_else(|| format!("No existe el lead con id {id}."))?;
    let converted_client_id = leads[index].converted_client_id;
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let updated = build_lead(
        id,
        LeadInput {
            vehicle_folder_path,
            ..input
        },
        converted_client_id,
    )?;
    leads[index] = updated.clone();
    save_leads(&app, &leads)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_lead(app: AppHandle, id: u64) -> Result<(), String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    let previous_len = leads.len();
    leads.retain(|lead| lead.id != id);
    if leads.len() == previous_len {
        return Err(format!("No existe el lead con id {id}."));
    }

    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    for client in &mut clients {
        if client.source_lead_id == Some(id) {
            client.source_lead_id = None;
        }
    }

    save_leads(&app, &leads)?;
    save_clients(&app, &clients)
}

#[tauri::command]
pub fn get_lead_notes(app: AppHandle, lead_id: u64) -> Result<Vec<LeadNote>, String> {
    let conn = get_db_connection(&app)?;
    db::get_lead_notes(&conn, lead_id)
        .map_err(|error| format!("No se pudo cargar las notas del lead: {error}"))
}

#[tauri::command]
pub fn add_lead_note(app: AppHandle, lead_id: u64, content: String) -> Result<LeadNote, String> {
    let conn = get_db_connection(&app)?;
    db::add_lead_note(&conn, lead_id, &content)
        .map_err(|error| format!("No se pudo añadir la nota: {error}"))
}

#[tauri::command]
pub fn delete_lead_note(app: AppHandle, note_id: u64) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    db::delete_lead_note(&conn, note_id)
        .map_err(|error| format!("No se pudo eliminar la nota: {error}"))
}
