@echo off
chcp 65001 > nul
title Платформа аренды (Rental Platform)

echo.
echo ======================================================================
echo    🏠 Запуск Универсальной Платформы Аренды Домиков
echo ======================================================================
echo.

if not exist ".env" (
    echo [1/3] Создание файла конфигурации .env из шаблона...
    copy .env.example .env > nul
    echo [✓] Файл .env готов (логин: admin, пароль: admin)
)

if not exist "node_modules\" (
    echo [2/3] Первая установка: скачивание библиотек Node.js (займет 15-30 сек)...
    call npm install
    echo [✓] Библиотеки установлены!
)

echo [3/3] Запуск сервера и базы данных...
echo.
call npm start

pause
