# EcoGorniy.ru — Система Бронирования и Управления

PWA-приложение для бронирования 4 гостевых домиков. Включает клиентский сайт с корзиной и админ-панель.

## Стек технологий

- **Бэкенд:** Node.js + Express
- **Фронтенд:** Vanilla HTML, CSS, JS (без фреймворков)
- **База данных:** PocketBase
- **Медиа-хранилище:** PocketBase
- **Хостинг:** VPS/Coolify
- **Telegram relay:** Cloudflare Worker

## Установка и запуск

### 1. Клонирование репозитория

```bash
git clone <url-репозитория>
cd cabin-rental-app
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и настройте параметры:

```bash
cp .env.example .env
```

Основные переменные:

| Переменная | Описание |
|---|---|
| `POCKETBASE_URL` | URL инстанса PocketBase |
| `POCKETBASE_ADMIN_EMAIL` | Email администратора PocketBase |
| `POCKETBASE_ADMIN_PASSWORD` | Пароль администратора PocketBase |
| `ADMIN_USERNAME` | Логин админ-панели |
| `ADMIN_PASSWORD` | Пароль админ-панели |
| `COOKIE_SECRET` | Секретная строка для подписи cookie |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота для уведомлений |
| `TELEGRAM_CHAT_ID` | ID чата Telegram для уведомлений |
| `TELEGRAM_WEBHOOK_SECRET` | Подпись webhook; если задан, локальное тестирование недоступно |

### 4. Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу: `http://localhost:3000`

### 5. Запуск для продакшена

```bash
npm start
```

## Структура проекта

```
cabin-rental-app/
├── public/               # Клиентские файлы фронтенда
│   ├── css/              # Стили
│   ├── js/               # Скрипты
│   ├── images/           # Медиа и иконки
│   └── index.html        # Главная страница
├── src/                  # Исходный код бэкенда
│   ├── config/           # Конфигурация (env, pocketbase)
│   ├── middleware/       # Express middleware
│   ├── routes/           # Маршруты API
│   ├── services/         # Бизнес-логика
│   └── utils/            # Вспомогательные утилиты
├── server.js             # Точка входа бэкенда
├── .env.example          # Пример переменных окружения
├── package.json          # Зависимости
├── cloudflare-worker/    # Worker для Telegram-уведомлений
└── README.md             # Документация
```

## Деплой на VPS/Coolify

1. Подключите репозиторий GitHub к Coolify
2. Выберите тип проекта Node.js
3. Скопируйте переменные окружения из `.env.example` в панель настроек
4. Нажмите deploy
5. Healthcheck-энпоинт: `/health`

Для Telegram-уведомлений в продакшене используйте Cloudflare Worker
из папки `cloudflare-worker/`, затем укажите в Coolify `TELEGRAM_RELAY_URL` и
`TELEGRAM_RELAY_SECRET`.

Убедитесь, что PocketBase запущен и миграции (schema) актуальны. 
Эндпоинт готовности бэкенда: `/ready`.

## Тестирование

```bash
npm run check
```

## Безопасность

- Секретные ключи хранятся только в переменных окружения на сервере
- Админ-панель защищена сессионной авторизацией через httpOnly cookie
- Строгая валидация входящих данных на сервере
- Telegram webhook проверяет подпись и принимает запросы только из доверенных сетей
- Медиа-файлы загружаются только администраторами
