# Моя домашняя библиотека

Веб-приложение для учёта книг в домашней библиотеке: каталогизация, поиск,
учёт выдачи книг знакомым. Frontend — HTML/CSS/JavaScript без фреймворков.
База данных — Firebase Firestore. Хостинг — GitHub Pages, автодеплой —
GitHub Actions.

## Структура проекта

```
index.html                     — разметка приложения
css/style.css                  — стили (пастельная цветовая гамма)
js/firebase-config.js          — конфигурация Firebase (вставить свои ключи)
js/app.js                      — логика приложения (авторизация, Firestore, ISBN)
firestore.rules                — правила безопасности Firestore
.github/workflows/deploy.yml   — автодеплой на GitHub Pages
```

## Настройка

Подробная пошаговая инструкция — в сообщении чата, где был передан этот файл.
Коротко:

1. Создать проект в Firebase, включить Authentication (Email/Password) и
   Firestore Database.
2. Вставить конфигурацию проекта в `js/firebase-config.js`.
3. Вставить содержимое `firestore.rules` в Firebase Console → Firestore →
   Rules.
4. Создать одного пользователя вручную в Authentication → Users.
5. Залить проект в репозиторий на GitHub, включить GitHub Pages с
   источником "GitHub Actions" в настройках репозитория.
6. При каждом push в ветку `main` сайт будет пересобираться и публиковаться
   автоматически.
