use serde::{Deserialize, Serialize};
use std::path::Path;

/// Result of importing a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportReport {
    pub file_name: String,
    pub records_processed: usize,
    pub records_imported: usize,
    pub errors: Vec<String>,
}

/// Stock vehicle parsed from CSV
#[derive(Debug, Clone, Deserialize)]
pub struct StockRecord {
    #[serde(rename = "Modelo", alias = "modelo", alias = "vehicle", alias = "Vehículo")]
    pub modelo: String,

    #[serde(rename = "Año", alias = "año", alias = "year", default)]
    pub año: String,

    #[serde(rename = "KM", alias = "km", default)]
    pub km: String,

    #[serde(rename = "Precio Compra", alias = "precio_compra", alias = "compra", default)]
    pub precio_compra: String,

    #[serde(rename = "Precio Venta", alias = "precio_venta", alias = "venta", default)]
    pub precio_venta: String,

    #[serde(rename = "Estado", alias = "estado", default)]
    pub estado: String,
}

/// Sales record parsed from CSV
#[derive(Debug, Clone, Deserialize)]
pub struct SalesRecord {
    #[serde(rename = "Vehículo", alias = "vehicle", alias = "modelo")]
    pub vehicle: String,

    #[serde(rename = "Fecha", alias = "date", alias = "fecha")]
    pub fecha: String,

    #[serde(rename = "Precio", alias = "precio_final", alias = "amount")]
    pub precio: String,

    #[serde(rename = "Notas", alias = "notes", default)]
    pub notas: String,
}

/// Parse a stock CSV file
pub fn parse_stock_csv(file_path: &str) -> Result<(Vec<StockRecord>, Vec<String>), String> {
    let path = Path::new(file_path);
    let mut reader = csv::Reader::from_path(path)
        .map_err(|e| format!("Error abriendo archivo: {}", e))?;

    let mut records = Vec::new();
    let mut errors = Vec::new();

    for (row_num, result) in reader.deserialize().enumerate() {
        match result {
            Ok(record) => records.push(record),
            Err(e) => {
                errors.push(format!("Fila {}: {}", row_num + 2, e));
            }
        }
    }

    Ok((records, errors))
}

/// Parse a sales CSV file
pub fn parse_sales_csv(file_path: &str) -> Result<(Vec<SalesRecord>, Vec<String>), String> {
    let path = Path::new(file_path);
    let mut reader = csv::Reader::from_path(path)
        .map_err(|e| format!("Error abriendo archivo: {}", e))?;

    let mut records = Vec::new();
    let mut errors = Vec::new();

    for (row_num, result) in reader.deserialize().enumerate() {
        match result {
            Ok(record) => records.push(record),
            Err(e) => {
                errors.push(format!("Fila {}: {}", row_num + 2, e));
            }
        }
    }

    Ok((records, errors))
}
