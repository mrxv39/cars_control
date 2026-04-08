# Helper para ejecutar el importador de zip stock.
# Pide la legacy service_role JWT por consola y lanza el script.
#
# Uso (en PowerShell, desde C:\Users\Usuario\Desktop\proyectos\cars_control):
#     .\scripts\run_import.ps1
# o, sin --limit (importa los 14):
#     .\scripts\run_import.ps1 -All

param(
    [switch]$All
)

$plan = "C:/Users/Usuario/Downloads/plan_import_stock.json"
$out  = "C:/Users/Usuario/Downloads/import_stock.sql"

Write-Host ""
Write-Host "Pega la legacy service_role JWT (texto largo eyJhbGc...) y pulsa Enter."
Write-Host "No se mostrara en pantalla."
$secure = Read-Host -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$key = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if (-not $key -or $key.Length -lt 50) {
    Write-Host "ERROR: la key esta vacia o es demasiado corta." -ForegroundColor Red
    exit 1
}

$env:SUPABASE_SERVICE_ROLE_KEY = $key

if ($All) {
    Write-Host "Ejecutando importacion COMPLETA (14 coches)..."
    python scripts\import_zip_stock.py $plan --out $out
} else {
    Write-Host "Ejecutando importacion de prueba (1 coche)..."
    python scripts\import_zip_stock.py $plan --out $out --limit 1
}
