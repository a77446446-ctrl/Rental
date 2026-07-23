# EcoGorniy.ru — Аренда домиков у озера

PWA-приложение для бронирования 4 премиальных домиков около озера в лесной чаще.

## Стек технологий

- **Бэкенд:** Node.js + Express
- **Фронтенд:** Vanilla HTML, CSS, JS (без фреймворков)
- **База данных:** Supabase PostgreSQL
- **Хранилище файлов:** Supabase Storage
- **Деплой:** VPS/Coolify
- **Telegram relay:** Cloudflare Worker

## Установка и запуск

### 1. Клонировать репозиторий

```bash
git clone <url-репозитория>
cd cabin-rental-app
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Настроить переменные окружения

Скопируйте файл `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

Обязательные переменные:

| Переменная | Описание |
|---|---|
| `SUPABASE_URL` | URL вашего проекта Supabase |
| `SUPABASE_ANON_KEY` | Публичный (anon) ключ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверный ключ Supabase (не публиковать!) |
| `ADMIN_USERNAME` | Логин администратора |
| `ADMIN_PASSWORD` | Пароль администратора |
| `COOKIE_SECRET` | Секретная строка для подписи cookie |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота для уведомлений |
| `TELEGRAM_CHAT_ID` | ID чата Telegram для уведомлений |
| `TELEGRAM_WEBHOOK_SECRET` | Необязательный секрет webhook; если пусто, безопасно формируется из токена бота и `COOKIE_SECRET` |

### 4. Запустить в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу: `http://localhost:3000`

### 5. Запустить для продакшена

```bash
npm start
```

## Структура проекта

```
cabin-rental-app/
├── public/               # Статические файлы фронтенда
│   ├── css/              # Стили
│   ├── js/               # Клиентские скрипты
│   ├── images/           # Изображения и иконки
│   └── index.html        # Главная страница
├── src/                  # Серверный код
│   ├── config/           # Конфигурация (env, supabase)
│   ├── middleware/        # Express middleware
│   ├── routes/           # Маршруты API
│   ├── services/         # Бизнес-логика
│   ├── sql/              # SQL-скрипты миграций
│   ├── utils/            # Вспомогательные утилиты
│   └── server.js         # Точка входа
├── .env.example          # Пример переменных окружения
├── package.json          # Зависимости
├── cloudflare-worker/    # Бесплатный relay для Telegram-уведомлений
└── README.md             # Документация
```

## Деплой на VPS/Coolify

1. Подключите репозиторий GitHub в Coolify
2. Выберите приложение Node.js
3. Добавьте переменные окружения из `.env.example` в настройках сервиса
4. Сделайте deploy приложения
5. Healthcheck-эндпоинт: `/health`

Для Telegram-уведомлений с российских VPS используйте бесплатный Cloudflare Worker
из папки `cloudflare-worker/`, затем добавьте в Coolify `TELEGRAM_RELAY_URL` и
`TELEGRAM_RELAY_SECRET`.

Перед развертыванием стабилизированной версии примените миграции `src/sql/001...006`
в Supabase SQL Editor и выполните контрольный список из `STABILITY_DEPLOYMENT.md`.
Эндпоинт готовности базы и обязательной миграции: `/ready`.

## Проверки

```bash
npm run check
```

При push и pull request тот же набор тестов и линтер запускается в GitHub Actions,
после чего выполняется аудит production-зависимостей с уровнем `high`.

## Безопасность

- Секретные ключи хранятся только в переменных окружения на сервере
- Фронтенд не имеет доступа к `SUPABASE_SERVICE_ROLE_KEY`
- Админ-панель защищена серверной авторизацией через httpOnly cookie
- Итоговая стоимость бронирования рассчитывается исключительно на сервере
- Включена защита от перебора запросов (Rate Limiting)
- Все входящие данные проходят серверную валидацию
- Telegram webhook подписан секретом и принимает ответы только из настроенного чата
- Медиафайлы проверяются по фактической сигнатуре, а публичные загрузки ограничены

## Лицензия

Частный проект. Все права защищены.
