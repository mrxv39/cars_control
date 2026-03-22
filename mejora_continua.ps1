# mejora_continua.ps1 - Cars Control
# Loop infinito de mejora autonoma con proteccion de produccion

$LogFile = "loop_mejora.log"
$PromptFile = "prompt.txt"
$ContextFile = "CLAUDE_CONTEXT.md"
$MigrationsFile = "MIGRATIONS_PENDING.md"

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Write-Host $line -ForegroundColor Cyan
    Add-Content -Path $LogFile -Value $line
}

function LogOk($msg) {
    Write-Host "[OK] $msg" -ForegroundColor Green
    Add-Content -Path $LogFile -Value "[OK] $msg"
}

function LogWarn($msg) {
    Write-Host "[AVISO] $msg" -ForegroundColor Yellow
    Add-Content -Path $LogFile -Value "[AVISO] $msg"
}

# Verificar que existe el archivo de prompt
if (-not (Test-Path $PromptFile)) {
    Write-Host "ERROR: No se encuentra prompt.txt en este directorio." -ForegroundColor Red
    Write-Host "Asegurate de ejecutar este script desde la raiz del proyecto cars_control"
    exit 1
}

# Verificar que claude esta instalado
try {
    $claudeVersion = claude --version 2>&1
    LogOk "Claude Code encontrado: $claudeVersion"
} catch {
    Write-Host "ERROR: Claude Code no esta instalado." -ForegroundColor Red
    Write-Host "Instalalo con: npm install -g @anthropic-ai/claude-code"
    exit 1
}

# Crear CLAUDE_CONTEXT.md si no existe
if (-not (Test-Path $ContextFile)) {
    $initialContext = @"
# Cars Control - Estado del Loop de Desarrollo

## Proyecto
App de gestion para CodinaCars - compraventa de vehiculos segunda mano
Stack: React 19 + TypeScript + Vite + Tauri 2 + Supabase
Produccion: https://cars-control-ruddy.vercel.app/

## IMPORTANTE - Reglas de seguridad
- Nunca push a main directamente
- Nunca ejecutar SQL en Supabase de produccion sin revision manual
- Cada iteracion crea una rama feature/ separada
- El desarrollador revisa y mergea manualmente

## Ultima iteracion
(ninguna aun - primera ejecucion)

## Features completadas
(ninguna aun)

## Deuda tecnica resuelta
(ninguna aun)

## Migraciones aplicadas en produccion
(ninguna aun)

## Proxima accion sugerida
Empezar por FEATURE 1: Factura de venta en PDF
"@
    Set-Content -Path $ContextFile -Value $initialContext -Encoding UTF8
    LogOk "CLAUDE_CONTEXT.md creado"
}

# Crear MIGRATIONS_PENDING.md si no existe
if (-not (Test-Path $MigrationsFile)) {
    $initialMigrations = @"
# Migraciones Pendientes de Aplicar en Supabase

## INSTRUCCIONES
Antes de mergear cualquier rama feature a main, revisar este archivo.
Si hay migraciones pendientes para esa feature, aplicarlas en:
Supabase Dashboard > SQL Editor
Luego moverlas a la seccion APLICADAS con la fecha.

## PENDIENTES
(ninguna aun)

## APLICADAS
(ninguna aun)
"@
    Set-Content -Path $MigrationsFile -Value $initialMigrations -Encoding UTF8
    LogOk "MIGRATIONS_PENDING.md creado"
}

# Inicio del loop
Log "=============================================="
Log "  Cars Control - Loop de Mejora Continua"
Log "  MODO: Produccion protegida (ramas feature)"
Log "=============================================="
LogWarn "RECORDATORIO: Este loop NUNCA hace push a main."
LogWarn "Cada iteracion crea una rama feature para tu revision."
Write-Host ""

$iteracion = 1

while ($true) {
    Write-Host ""
    Log "----------------------------------------------"
    Log "ITERACION $iteracion - $(Get-Date -Format 'dddd dd/MM/yyyy HH:mm')"
    Log "----------------------------------------------"

    # Verificar que estamos en el repo correcto
    $gitRemote = git remote get-url origin 2>&1
    if ($gitRemote -notlike "*cars_control*") {
        LogWarn "Advertencia: el remote origin no parece ser cars_control"
        LogWarn "Remote detectado: $gitRemote"
        LogWarn "Continua de todas formas en 10 segundos... (Ctrl+C para cancelar)"
        Start-Sleep -Seconds 10
    }

    # Leer el prompt desde archivo
    $prompt = Get-Content -Path $PromptFile -Raw -Encoding UTF8

    # Ejecutar Claude Code
    Log "Ejecutando Claude Code..."
    claude --dangerously-skip-permissions -p $prompt `
        --allowedTools "Read,Write,Edit,Bash" `
        --output-format text 2>&1 | Tee-Object -FilePath $LogFile -Append

    # Verificar que no se hizo push a main accidentalmente
    $currentBranch = git branch --show-current 2>&1
    if ($currentBranch -eq "main") {
        LogWarn "ATENCION: La rama actual es main despues de la iteracion."
        LogWarn "Verificando que no hay cambios sin commitear en main..."
        $gitStatus = git status --porcelain 2>&1
        if ($gitStatus) {
            LogWarn "Hay cambios sin commitear en main. Revisalos manualmente."
        }
    } else {
        LogOk "Rama actual: $currentBranch (correcto, no es main)"
    }

    # Mostrar resumen de la iteracion
    $ramaActual = git branch --show-current 2>&1
    $ultimoCommit = git log --oneline -1 2>&1
    Log "Rama de trabajo: $ramaActual"
    Log "Ultimo commit: $ultimoCommit"

    # Verificar si hay migraciones pendientes
    if (Test-Path $MigrationsFile) {
        $migraciones = Get-Content $MigrationsFile -Raw
        if ($migraciones -match "PENDIENTES\r?\n((?!.*ninguna)[\s\S]*?)(?=\r?\n##|\z)") {
            LogWarn "HAY MIGRACIONES PENDIENTES - Revisar MIGRATIONS_PENDING.md antes de mergear"
        }
    }

    Write-Host ""
    LogOk "Iteracion $iteracion completada."
    Log "Proxima iteracion en 8 segundos... (Ctrl+C para pausar)"
    Write-Host ""

    $iteracion++
    Start-Sleep -Seconds 8
}
