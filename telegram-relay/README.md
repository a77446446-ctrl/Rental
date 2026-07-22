# EcoGorniy Telegram Relay

Закрытый ретранслятор уведомлений для Railway. Принимает только запросы с общим секретом и пересылает их в официальный Telegram Bot API.

## Переменные Railway

- `TELEGRAM_BOT_TOKEN` — токен бота из BotFather.
- `TELEGRAM_RELAY_SECRET` — случайная строка длиной не менее 32 символов.

Сервис слушает выданный Railway порт `PORT`. Healthcheck: `/health`.

## Переменные основного приложения в Coolify

- `TELEGRAM_RELAY_URL=https://имя-сервиса.up.railway.app`
- `TELEGRAM_RELAY_SECRET=тот_же_секрет`

Токен и секрет нельзя добавлять в Git или клиентский JavaScript.
