@echo off
title Logistica EESTN4
color 0A
echo.
echo  =========================================
echo   Logistica EESTN4 - Servidor de Red
echo  =========================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo  Instalando dependencias...
    npm install
    echo.
)

if not exist ".env" (
    echo  Creando archivo .env...
    copy .env.example .env >nul
    echo  ATENCION: Edita .env y cambia JWT_SECRET antes de usar en produccion.
    echo.
)

echo  Iniciando servidor...
echo  Para detenerlo: Ctrl + C
echo.
node server/index.js

pause
