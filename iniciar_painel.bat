@echo off
chcp 65001 >nul
echo Iniciando API do Painel de Convenios (porta 8010)...
start "API Painel Convenios" /min cmd /k "cd /d "%~dp0api" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8010"

echo Iniciando Frontend do Painel de Convenios (porta 5180)...
start "Web Painel Convenios" /min cmd /k "cd /d "%~dp0web" && npm run dev"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5180"
echo Painel aberto em http://localhost:5180
