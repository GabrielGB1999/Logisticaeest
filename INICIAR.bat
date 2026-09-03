@echo off
setlocal enabledelayedexpansion
title Logistica EESTN4
color 0A

echo.
echo  ==========================================
echo    LOGISTICA EESTN4 - Iniciador Automatico
echo  ==========================================
echo.

cd /d "%~dp0"

:: ============================================
:: PASO 1: VERIFICAR NODE.JS
:: ============================================
echo  [1/4] Verificando Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Node.js no esta instalado. Intentando instalar automaticamente...
    echo.

    where winget >nul 2>&1
    if %errorlevel% equ 0 (
        echo  Instalando Node.js LTS con winget, espera un momento...
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        echo.

        :: Refrescar PATH desde el registro para esta sesion
        for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul`) do set "SYS_PATH=%%B"
        for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do set "USR_PATH=%%B"
        set "PATH=!SYS_PATH!;!USR_PATH!"

        where node >nul 2>&1
        if !errorlevel! neq 0 (
            echo  [!] Node.js fue instalado pero esta terminal necesita reiniciarse.
            echo  Por favor, cierra esta ventana y vuelve a ejecutar INICIAR.bat
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo  [ERROR] No se pudo instalar automaticamente ^(winget no disponible^).
        echo  Descarga Node.js manualmente desde: https://nodejs.org
        echo.
        start https://nodejs.org
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('node --version 2^>nul') do echo     Node.js %%v encontrado.

:: ============================================
:: PASO 2: VERIFICAR DEPENDENCIAS
:: ============================================
echo.
echo  [2/4] Verificando dependencias...
if not exist "node_modules\" (
    echo  Instalando paquetes npm ^(puede tardar unos minutos la primera vez^)...
    echo.
    npm install
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] Fallo la instalacion de dependencias.
        pause
        exit /b 1
    )
    echo.
    echo  Dependencias instaladas correctamente.
) else (
    :: Verificar si package.json cambio respecto a lo instalado
    for %%F in ("package.json") do set pkg_date=%%~tF
    for %%F in ("node_modules\.package-lock.json") do set lock_date=%%~tF
    if "!pkg_date!" gtr "!lock_date!" (
        echo  Detectados cambios en dependencias. Actualizando...
        npm install
        if !errorlevel! neq 0 (
            echo  [ERROR] Fallo la actualizacion de dependencias.
            pause
            exit /b 1
        )
    ) else (
        echo     Dependencias OK.
    )
)

:: ============================================
:: PASO 3: VERIFICAR CONFIGURACION
:: ============================================
echo.
echo  [3/4] Verificando configuracion...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  Archivo .env creado desde .env.example
    ) else (
        echo  [AVISO] No se encontro .env ni .env.example
    )
) else (
    echo     Configuracion .env OK.
)

:: ============================================
:: PASO 4: COMPILAR FRONTEND
:: ============================================
echo.
echo  [4/4] Verificando frontend compilado...
if not exist "dist\" (
    echo  Compilando frontend ^(primera vez, puede tardar unos minutos^)...
    echo.
    npm run build
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] Fallo la compilacion del frontend.
        pause
        exit /b 1
    )
    echo.
    echo  Frontend compilado correctamente.
) else (
    echo     Frontend ya compilado.
)

:: ============================================
:: INICIAR SERVIDOR Y ABRIR NAVEGADOR
:: ============================================
echo.
echo  ==========================================
echo   TODO LISTO  -  Abriendo aplicacion...
echo  ==========================================
echo.
echo  URL local:  http://localhost:5000
echo.
echo  Para detener el servidor: Ctrl + C
echo  Para volver a iniciar: ejecuta INICIAR.bat
echo.

:: Abrir el navegador despues de 3 segundos (tiempo para que arranque el servidor)
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

node server/index.js

echo.
echo  Servidor detenido.
pause
