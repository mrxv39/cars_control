use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{
    db, ensure_database_migrated, next_record_id, read_collection, sanitize_contact_name,
    sanitize_optional_path, sanitize_text_field, save_leads,
    validate_optional_vehicle_folder_path, Lead,
};
use crate::paths::{clients_file_path, get_db_connection, leads_file_path};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Client {
    pub id: u64,
    pub name: String,
    pub phone: String,
    pub email: String,
    pub dni: String,
    pub notes: String,
    pub vehicle_folder_path: Option<String>,
    pub source_lead_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct ClientInput {
    pub name: String,
    pub phone: String,
    pub email: String,
    pub dni: String,
    pub notes: String,
    pub vehicle_folder_path: Option<String>,
}

pub(crate) fn build_client(
    id: u64,
    input: ClientInput,
    source_lead_id: Option<u64>,
) -> Result<Client, String> {
    Ok(Client {
        id,
        name: sanitize_contact_name(&input.name)?,
        phone: sanitize_text_field(&input.phone),
        email: sanitize_text_field(&input.email),
        dni: sanitize_text_field(&input.dni),
        notes: sanitize_text_field(&input.notes),
        vehicle_folder_path: sanitize_optional_path(input.vehicle_folder_path),
        source_lead_id,
    })
}

pub(crate) fn list_clients_internal(app: &AppHandle) -> Result<Vec<Client>, String> {
    ensure_database_migrated(app)?;

    let conn = get_db_connection(app)?;
    let mut clients = db::load_clients(&conn)
        .map_err(|e| format!("Error al cargar clients: {}", e))?;
    clients.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(clients)
}

pub(crate) fn save_clients(app: &AppHandle, clients: &[Client]) -> Result<(), String> {
    let conn = get_db_connection(app)?;
    for client in clients {
        db::save_client(&conn, client)
            .map_err(|e| format!("Error al guardar client: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_clients(app: AppHandle) -> Result<Vec<Client>, String> {
    list_clients_internal(&app)
}

#[tauri::command]
pub fn create_client(app: AppHandle, input: ClientInput) -> Result<Client, String> {
    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    let next_id = next_record_id(&clients, |client| client.id);
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let client = build_client(
        next_id,
        ClientInput {
            vehicle_folder_path,
            ..input
        },
        None,
    )?;
    clients.push(client.clone());
    save_clients(&app, &clients)?;
    Ok(client)
}

#[tauri::command]
pub fn update_client(app: AppHandle, id: u64, input: ClientInput) -> Result<Client, String> {
    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    let index = clients
        .iter()
        .position(|client| client.id == id)
        .ok_or_else(|| format!("No existe el cliente con id {id}."))?;
    let source_lead_id = clients[index].source_lead_id;
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let updated = build_client(
        id,
        ClientInput {
            vehicle_folder_path,
            ..input
        },
        source_lead_id,
    )?;
    clients[index] = updated.clone();
    save_clients(&app, &clients)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_client(app: AppHandle, id: u64) -> Result<(), String> {
    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    let previous_len = clients.len();
    clients.retain(|client| client.id != id);
    if clients.len() == previous_len {
        return Err(format!("No existe el cliente con id {id}."));
    }

    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    for lead in &mut leads {
        if lead.converted_client_id == Some(id) {
            lead.converted_client_id = None;
        }
    }

    save_clients(&app, &clients)?;
    save_leads(&app, &leads)
}

#[tauri::command]
pub fn convert_lead_to_client(
    app: AppHandle,
    lead_id: u64,
    input: ClientInput,
) -> Result<Client, String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    let lead_index = leads
        .iter()
        .position(|lead| lead.id == lead_id)
        .ok_or_else(|| format!("No existe el lead con id {lead_id}."))?;

    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    let next_id = next_record_id(&clients, |client| client.id);
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let client = build_client(
        next_id,
        ClientInput {
            vehicle_folder_path,
            ..input
        },
        Some(lead_id),
    )?;

    clients.push(client.clone());
    leads[lead_index].converted_client_id = Some(client.id);

    save_clients(&app, &clients)?;
    save_leads(&app, &leads)?;

    Ok(client)
}
