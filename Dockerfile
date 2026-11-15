# ==============================================================================
# 🌲 EcoGorniy Cabin Rental — Production Dockerfile
# ==============================================================================
FROM node:20-bookworm-slim

# Рабочая директория
WORKDIR /app

# Окружение Node.js
ENV NODE_ENV=production
ENV PORT=3000

# Установка зависимостей (только production)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild sharp

# Копирование исходных файлов приложения
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/ ./scripts/

# Создание пользователя без root-прав для безопасности
RUN chown -R node:node /app
USER node

# Открываем порт
EXPOSE 3000

# Проверка работоспособности контейнера
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Точка входа
CMD ["node", "src/server.js"]
