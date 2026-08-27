# AI Personal Hub — развёртывание через OpenClaw

Репозиторий: [Dmgromov01/atlas-green-pearl-dawn](https://github.com/Dmgromov01/atlas-green-pearl-dawn)

Семейный хаб: погода, курсы, задачи, календарь (iCloud + Google), дайджест, переводчик, агент через OpenClaw.

Ниже — готовый промпт для OpenClaw и пошаговая инструкция.

---

## Промпт для OpenClaw (скопировать целиком)

```text
Разверни веб-приложение AI Personal Hub с GitHub.

Репозиторий: https://github.com/Dmgromov01/atlas-green-pearl-dawn
Ветка: main
Документ: OPENCLAW.md в корне репозитория — следуй ему целиком, особенно § «OpenClaw gateway».

Цель: поднять production-сборку так, чтобы её можно было открыть в браузере и с экрана Домой как отдельное приложение. Чат хаба должен отвечать через локальный OpenClaw gateway.

Сделай по порядку:

1. Клонируй репозиторий (или git pull, если уже есть).
2. Node 22, npm ci.
3. Не коммить .env, скриншоты, .vercel/output, artifacts, attachments.
4. Собери production: npm run build.
5. Хостинг — предпочтительно тот же мини-ПК, что и OpenClaw:
   B) Мини-ПК: npm run build && npx vite preview --host 0.0.0.0 --port 8080 за reverse-proxy (Caddy/nginx) с HTTPS.
   A) Vercel только если gateway доступен с серверов Vercel по private URL (LAN/Tailscale). 127.0.0.1 с Vercel НЕ работает.
6. Пропиши переменные из OPENCLAW.md § «Переменные». Секреты бери из /root/.openclaw/.env и /root/.openclaw/credentials/, не печатай их в чат.
7. Хаб — отдельный сайт, не Mini App. С экрана Домой открывается сам. TELEGRAM_BOT_TOKEN и TELEGRAM_OWNER_ID нужны только если бот шлёт напоминания (не для входа в хаб).
8. OpenClaw gateway для чата хаба — обязательно:
   OPENCLAW_GATEWAY_URL = http://127.0.0.1:18789
     только host:port, БЕЗ суффикса /v1 (код сам бьёт в /v1/chat/completions).
     127.0.0.1 работает ТОЛЬКО если процесс хаба на той же машине, что и gateway.
   OPENCLAW_GATEWAY_TOKEN = gateway.auth.token
   OPENCLAW_MODEL = openclaw/default
     это id агента OpenClaw, не gpt-4.1 и не grok-4.5.
   Включи HTTP Chat Completions (иначе хаб получит 404):
     gateway.http.endpoints.chatCompletions.enabled = true
   Порт 18789 не публикуй в интернет даже с токеном: токен = права оператора.
9. Календари: iCloud app-specific password и Google OAuth refresh token, если они уже лежат в credentials.
10. База: для Vercel — Neon DATABASE_URL (pooled). Для мини-ПК можно PGLITE_DATA_DIR=/var/lib/r2d2/pglite.
11. После деплоя открой URL ПЕРВЫМ (первый посетитель становится admin), укажи имя, поставь PIN в Настройках.
    Настройки → AI-доступ → «Проверить агента». Затем чат: «Что у меня сегодня?».
12. Верни мне: публичный URL, какие переменные заданы (имена, не значения), результат проверки агента, что ещё нужно от меня.

Не публикуй секреты. Не переписывай приложение с нуля — это уже готовый код.
```

---

## Переменные

Секреты только в окружении хоста. В репозиторий не класть.

### Telegram-бот (необязательно, только напоминания)

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
| `OPENCLAW_GATEWAY_URL` или `OPENCLAW_URL` | Origin шлюза, по умолчанию `http://127.0.0.1:18789`. Без `/v1` |
| `OPENCLAW_GATEWAY_TOKEN` или `OPENCLAW_TOKEN` | Токен шлюза (owner/operator) |
| `OPENCLAW_MODEL` | Id агента, по умолчанию `openclaw/default` |
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
| `XAI_API_KEY` | Только дайджест новостей. Чат через OpenClaw этот ключ не использует |

---

## OpenClaw gateway (чат хаба) — обязательно

Эндпоинт `POST /v1/chat/completions` в OpenClaw **выключен по умолчанию**. Без этого «Проверить агента» и чат отвечают 404.

В конфиге OpenClaw:

```json5
{
  gateway: {
    http: {
      endpoints: {
        chatCompletions: { enabled: true }
      }
    }
  }
}
```

Перезапусти gateway после правки.

### URL

| Где крутится хаб | `OPENCLAW_GATEWAY_URL` |
|---|---|
| Тот же мини-ПК, что и OpenClaw | `http://127.0.0.1:18789` (это default в коде) |
| Vercel / внешний PaaS | Не `127.0.0.1`. Либо хаб на мини-ПК, либо private URL (LAN / Tailscale), например `http://100.x.y.z:18789` |
| Не класть | суффикс `/v1` — код сам добавляет `/v1/chat/completions` |

`OPENCLAW_MODEL` — агент (`openclaw/default` или `openclaw/<id>`), не `gpt-4o` / `grok-4.5`.

Для семьи лучше отдельный агент без tools (`openclaw/hub`) и `OPENCLAW_MODEL=openclaw/hub`. Хаб и так шлёт `tool_choice: "none"`.

### Проверка с мини-ПК

```bash
curl -sS http://127.0.0.1:18789/v1/models \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN"

curl -sS http://127.0.0.1:18789/v1/chat/completions \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"openclaw/default","messages":[{"role":"user","content":"ping"}]}'
```

В хабе: Настройки → AI-доступ → «Проверить агента». Должно быть «Шлюз отвечает · openclaw».

### Безопасность

- Не публикуй `:18789` в интернет. Только loopback, tailnet или SSH-туннель.
- `OPENCLAW_GATEWAY_TOKEN` — полные права оператора шлюза, не per-user ключ чата.
- BYOK «Свой шлюз» принимает только публичный HTTPS. Локальный OpenClaw настраивается через env, не через форму.
- Первый открывший URL становится администратором и получает общий пул.

### Почему агент молчит

1. Не включён `gateway.http.endpoints.chatCompletions.enabled`.
2. Хаб на Vercel, а URL шлюза `127.0.0.1`.
3. Нет `OPENCLAW_GATEWAY_TOKEN`.
4. В Настройках режим «Выкл», а не «Общий пул» / «Мой ключ».
5. В `OPENCLAW_GATEWAY_URL` ошибочно дописали `/v1`.
6. `OPENCLAW_MODEL` — имя провайдерской модели, а не агента.

### Дайджест ≠ чат

Чат идёт в OpenClaw. Сводка дайджеста (`XAI_API_KEY`) — отдельно, в xAI. Без этого ключа дайджест остаётся обычной выжимкой из заголовков, чат при этом может работать.

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

Перед reverse-proxy нужен HTTPS.

Миграции Postgres: `npm run build` уже вызывает `npm run db:migrate`. На PGLite схема поднимается при старте.

---

## Отдельный сайт

1. Публичный URL: `https://<ваш-домен>/`
2. С iPhone: Поделиться → На экран «Домой»
3. Первый экран — только имя. Город берётся из геолокации (можно сменить в Настройках)
4. PIN — в Настройках
5. Первый посетитель = admin. Чат бьёт в OpenClaw; без токена шлюза общий пул не заведётся (свой ключ BYOK можно в Настройках)

---

## Что уже сделано в коде

- Погода, курсы, задачи, дайджест, переводчик, календари iCloud и Google
- Отдельный сайт с иконкой на экран Домой (не Telegram Mini App)
- Агент: OpenClaw `/v1/chat/completions`, BYOK, квоты, действия «добавь задачу/событие»
- PIN, семейный шаринг, админка
