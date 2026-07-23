# Cloudflare Telegram relay

Бесплатный ретранслятор Telegram-уведомлений для `eco-gorniy.ru`.
Основное приложение отправляет запрос на Cloudflare Worker, а Worker уже отправляет сообщение в официальный Telegram Bot API.

## Переменные Worker

- `TELEGRAM_BOT_TOKEN` — токен Telegram-бота.
- `TELEGRAM_RELAY_SECRET` — случайная строка длиной не менее 32 символов.

Healthcheck: `/health`.

## Переменные основного приложения в Coolify

- `TELEGRAM_RELAY_URL=https://адрес-worker.workers.dev`
- `TELEGRAM_RELAY_SECRET=тот_же_секрет`

`TELEGRAM_CHAT_ID` остаётся в основном приложении. Токен бота можно оставить и там тоже, но при наличии `TELEGRAM_RELAY_URL` уведомления о бронировании пойдут через Worker.

## Деплой

1. Создайте Worker в Cloudflare.
2. Загрузите код из `cloudflare-worker/src/worker.mjs`.
3. Добавьте переменные `TELEGRAM_BOT_TOKEN` и `TELEGRAM_RELAY_SECRET`.
4. Скопируйте URL Worker в `TELEGRAM_RELAY_URL` основного приложения.
5. Сделайте redeploy приложения в Coolify.
