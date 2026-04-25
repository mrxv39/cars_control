use tauri::AppHandle;

use crate::db;
use crate::paths::get_db_connection;
use crate::{PurchaseRecord, SalesRecord};

#[tauri::command]
pub fn get_sales_records(app: AppHandle) -> Result<Vec<SalesRecord>, String> {
    let conn = get_db_connection(&app)?;
    db::get_sales_records(&conn)
        .map_err(|error| format!("No se pudo cargar los registros de venta: {error}"))
}

#[tauri::command]
pub fn add_sales_record(
    app: AppHandle,
    vehicle_folder_path: String,
    client_id: Option<u64>,
    lead_id: Option<u64>,
    price_final: f64,
    notes: String,
) -> Result<SalesRecord, String> {
    let conn = get_db_connection(&app)?;
    db::add_sales_record(&conn, &vehicle_folder_path, client_id, lead_id, price_final, &notes)
        .map_err(|error| format!("No se pudo registrar la venta: {error}"))
}

#[tauri::command]
pub fn delete_sales_record(app: AppHandle, record_id: u64) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    db::delete_sales_record(&conn, record_id)
        .map_err(|error| format!("No se pudo eliminar el registro de venta: {error}"))
}

#[tauri::command]
pub fn get_purchase_records(app: AppHandle) -> Result<Vec<PurchaseRecord>, String> {
    let conn = get_db_connection(&app)?;
    db::get_purchase_records(&conn)
        .map_err(|error| format!("No se pudo cargar los registros de compra: {error}"))
}

#[tauri::command]
pub fn add_purchase_record(
    app: AppHandle,
    expense_type: String,
    vehicle_folder_path: String,
    vehicle_name: String,
    plate: String,
    supplier_name: String,
    purchase_date: String,
    purchase_price: f64,
    invoice_number: String,
    payment_method: String,
    notes: String,
    source_file: String,
) -> Result<PurchaseRecord, String> {
    if invoice_number.trim().is_empty() {
        return Err("El numero de factura es obligatorio para registrar una compra.".to_string());
    }
    let conn = get_db_connection(&app)?;
    db::add_purchase_record(
        &conn,
        &expense_type,
        &vehicle_folder_path,
        &vehicle_name,
        &plate,
        &supplier_name,
        &purchase_date,
        purchase_price,
        &invoice_number,
        &payment_method,
        &notes,
        &source_file,
    )
    .map_err(|error| format!("No se pudo registrar la compra: {error}"))
}

#[tauri::command]
pub fn delete_purchase_record(app: AppHandle, record_id: u64) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    db::delete_purchase_record(&conn, record_id)
        .map_err(|error| format!("No se pudo eliminar el registro de compra: {error}"))
}
