@echo off
setlocal enabledelayedexpansion

cls
echo ========================================
echo Abriendo Cars Control en modo desarrollo
echo ========================================
echo.
echo Puerto: 5173
echo Log guardado en: app-dev.log
echo.
echo Iniciando compilacion...
echo ========================================
echo.

cd /d "%~dp0app"

REM Ejecutar y guardar en log
npm run tauri dev > ..\app-dev.log 2>&1

if errorlevel 1 (
    cls
    echo.
    echo ERROR DETECTADO
    echo ========================================
    echo.
    echo Lee el archivo: app-dev.log
    echo.
    type ..\app-dev.log | more
    echo.
    pause
) else (
    echo.
    echo Aplicacion cerrada exitosamente
    pause
)
