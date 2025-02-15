# Используем официальный образ Node.js
FROM node:20

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json (если он есть) в контейнер
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь код приложения в контейнер
COPY . .

EXPOSE 3000

# Запускаем приложение
CMD ["node", "app.js"]
