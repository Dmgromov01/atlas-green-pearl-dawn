# Personal AI Hub — развёртывание через OpenClaw

Репозиторий: [Dmgromov01/atlas-green-pearl-dawn](https://github.com/Dmgromov01/atlas-green-pearl-dawn)

Это семейный хаб R2D2: погода, курсы, задачи, календарь (iCloud + Google), дайджест, переводчик, чат с AI, Telegram Mini App. Стек: TanStack Start + React 19 + Tailwind v4, Postgres (Neon в проде, PGLite на превью), сессии по Telegram `initData` или PIN.

Ниже — готовый промпт для OpenClaw и пошаговая инструкция.

---

## Промпт для OpenClaw (скопировать целиком)

```text
Разверни веб-приложение Personal AI Hub (семейный хаб R2D2) с GitHub.

Репозиторий: https://github.com/Dmgromov01/atlas-green-pearl-dawn
Ветка: main
Документ: OPENCLAW.md в корне репозитория — следуй ему.

Цель: поднять production-сборку так, чтобы её можно было открыть в браузере и как Telegram Mini App.

Сделай по порядку:

1. Клонируй репозиторий (или git pull, если уже есть).
2. Node 22, npm ci.
3. Не коммить .env, скриншоты, .vercel/output.
4. Собери production: npm run build.
5. Выбери хостинг (предпочтение — тот, что уже есть у меня):
   A) Vercel: привяжи репо, Root Directory = ., Build Command = npm run build, Output = .vercel/output (Nitro preset vercel уже в vite.config).
   B) Тот же мини-ПК, что и OpenClaw: npm run build && npx vite preview --host 0.0.0.0 --port 8080 за reverse-proxy (Caddy/nginx) с HTTPS.
6. Пропиши переменные окружения из OPENCLAW.md § «Переменные». Секреты бери из /root/.openclaw/.env и /root/.openclaw/credentials/, не печатай их в чат.
7. Telegram Mini App: BotFather → /newapp или Edit Bot → Mini App URL = публичный HTTPS URL хаба. TELEGRAM_BOT_TOKEN тот же, что у бота. TELEGRAM_OWNER_ID = мой Telegram user id (первый вход с этим id станет admin).
8. OpenClaw gateway для чата хаба:
   OPENCLAW_GATEWAY_URL = URL шлюза (обычно http://127.0.0.1:18789 на той же машине, снаружи — внутренний адрес, не торчи в интернет без токена)
   OPENCLAW_GATEWAY_TOKEN = токен шлюза
   OPENCLAW_MODEL = модель по умолчанию
9. Календари: iCloud app-specific password и Google OAuth refresh token, если они уже лежат в credentials.
10. База: для Vercel — Neon DATABASE_URL (pooled). Для мини-ПК можно PGLITE_DATA_DIR=/var/lib/r2d2/pglite (данные на диске).
11. После деплоя открой URL, пройди экран «как к вам обращаться / город», поставь PIN в Настройках, проверь погоду, календарь, чат.
12. Верни мне: публичный URL, статус Mini App, какие переменные заданы (имена, не значения), что ещё нужно от меня.

Не публикуй секреты. Не переписывай приложение с нуля — это уже готовый код.
```

---

## Переменные

Секреты только в окружении хоста. В репозиторий не класть.

### Обязательные для Telegram Mini App

| Имя | Зачем |
|---|---|
| `TELEGRAM_BOT_TOKEN` | HMAC `initData`, уведомления о входе |
| `TELEGRAM_OWNER_ID` | Telegram user id владельца → роль admin |
| `AI_KEY_SECRET` | AES-ключ для BYOK пользователей (если нет — берётся bot token) |

### База

| Имя | Зачем |
|---|---|
| `DATABASE_URL` | Neon / Postgres в проде. Пусто = встроенный PGLite |
| `PGLITE_DATA_DIR` | Каталог PGLite на диске мини-ПК (иначе память процесса) |

### OpenClaw (чат хаба)

| Имя | Зачем |
|---|---|
| `OPENCLAW_GATEWAY_URL` или `OPENCLAW_URL` | Шлюз, по умолчанию `http://127.0.0.1:18789` |
| `OPENCLAW_GATEWAY_TOKEN` или `OPENCLAW_TOKEN` | Токен шлюза |
| `OPENCLAW_MODEL` | Модель общего пула и BYOK OpenClaw, по умолчанию `openclaw/default` |
| `OPENAI_MODEL` | Модель своего ключа OpenAI, по умолчанию `gpt-4.1-mini` |
| `ANTHROPIC_MODEL` | Модель своего ключа Anthropic, по умолчанию `claude-sonnet-4-5` |

### iCloud CalDAV (опционально, иначе пользователь вводит в Настройках)

| Имя | Зачем |
|---|---|
| `ICLOUD_APPLE_ID` | Apple ID |
| `ICLOUD_APP_PASSWORD` | Пароль приложения |
| `ICLOUD_PRIMARY_HREF` | href личного календаря |
| `ICLOUD_FAMILY_HREF` | href календаря «Семья» |

### Google Calendar (опционально, иначе OAuth в Настройках)

| Имя | Зачем |
|---|---|
| `GOOGLE_CALENDAR_CLIENT_ID` | OAuth client |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | OAuth secret |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` | refresh token |
| `GOOGLE_CALENDAR_PRIMARY_ID` | id личного календаря, обычно `primary` |
| `GOOGLE_CALENDAR_FAMILY_ID` | id семейного календаря |

### Прочее

| Имя | Зачем |
|---|---|
| `SESSION_TTL_SECONDS` | TTL сессии, по умолчанию 7 дней |
| `XAI_API_KEY` | Только если нужен xAI для дайджеста (не обязателен, если чат идёт через OpenClaw) |

---

## Локальная / мини-ПК сборка

```bash
git clone https://github.com/Dmgromov01/atlas-green-pearl-dawn.git
cd atlas-green-pearl-dawn
git checkout main
npm ci
# положи .env рядом, не коммить
npm run build
# прод-превью (после сборки):
npx vite preview --host 0.0.0.0 --port 8080
```

Перед reverse-proxy нужен HTTPS. Mini App Telegram не откроет голый HTTP, кроме localhost.

Миграции Postgres: `npm run build` уже вызывает `npm run db:migrate`. На PGLite схема поднимается при старте.

---

## Telegram Mini App

1. BotFather → бот → Mini App URL = `https://<ваш-домен>/`
2. Тот же бот, тот же `TELEGRAM_BOT_TOKEN`
3. Первый вход с `TELEGRAM_OWNER_ID` получает admin (пользователи, AI, аудит)
4. В Mini App: экран имени и города → хаб. PIN — в Настройках, затем экран кода при блокировке
5. Чат хаба бьёт в OpenClaw gateway; без токена шлюза общий пул AI не заведётся (свой ключ BYOK можно в Настройках)

---

## Что уже сделано в коде (аудит)

Смотри коммиты `main`:

- `d2bfb07` — экспорт хаба из Grok (погода, курсы, задачи, дайджест, переводчик, Telegram boot)
- `e2f6765` — запись в iCloud «Семья», live-синк, погода
- `4371940` — iCloud: список / создать / цвет / шаринг / публичная ссылка / удаление
- `44085c1` — то же для Google Calendar
- следующий коммит — экран входа восстановлен, стрелка «Пароли» как у остальных карточек, радиус виджета погоды как у карточек, этот файл

Календари, PIN, BYOK, админка — в приложении. OpenClaw только поднимает хостинг, env и Mini App URL.
