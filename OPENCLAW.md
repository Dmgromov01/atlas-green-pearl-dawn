# AI Personal Hub — развёртывание через OpenClaw

Репозиторий: [Dmgromov01/atlas-green-pearl-dawn](https://github.com/Dmgromov01/atlas-green-pearl-dawn)

Семейный хаб: погода, курсы, задачи, календарь (iCloud + Google), дайджест, переводчик, агент через OpenClaw.

Хаб — отдельный сайт (иконка на экран Домой), не Telegram Mini App.

---

## Снимок этой машины (27.08.2026)

Секреты сюда не писать.

| Параметр | Значение |
|---|---|
| Агент | один, `main`, с tools |
| Модель хаба | `openclaw/default` (= `main`) |
| chatCompletions | включён, 200 |
| Шлюз | `127.0.0.1:18789`, loopback, auth=token |
| Владелец Telegram | `1916536646` |
| Бот хаба (пейджер) | `@HubAlertsbot` (id `8915951913`) |
| Бот OpenClaw (канал) | `@Dmbotmy_bot` (id `8675950544`) |

Токены ботов **не смешивать**. Если в `.env` хаба лежит токен `@Dmbotmy_bot` — заменить на `@HubAlertsbot`.

---

## Промпт для OpenClaw (скопировать целиком)

```text
Разверни на ЭТОМ мини-ПК веб-приложение AI Personal Hub из GitHub. Не пиши приложение заново.

Репозиторий: https://github.com/Dmgromov01/atlas-green-pearl-dawn
Ветка: main
Документ: OPENCLAW.md — следуй ему целиком.

Что это
Семейный хаб: погода, курсы, задачи, календари iCloud/Google, дайджест, переводчик, чат с агентом.
Отдельный сайт с иконкой на экран Домой. НЕ Telegram Mini App и НЕ канал OpenClaw.

Что уже работает на этой машине (не ломай)
- OpenClaw gateway слушает ТОЛЬКО 127.0.0.1:18789 (и [::1]), bind=loopback, auth=token.
- gateway.http.endpoints.chatCompletions.enabled = true, проверка дала 200.
- Агент один: main (полный, с tools). Отдельного hub-агента не создавай.
- Telegram-канал OpenClaw: бот @Dmbotmy_bot (id 8675950544). Это операторский чат. НЕ используй его токен в хабе. Конфиг канала OpenClaw не меняй.

Боты — разделить
- Хаб шлёт пейджер через ДРУГОГО бота: @HubAlertsbot (id 8915951913).
- TELEGRAM_BOT_TOKEN в .env хаба = токен @HubAlertsbot. Если там сейчас токен @Dmbotmy_bot — замени.
- TELEGRAM_OWNER_ID=1916536646 (человек, не бот).
- Не печатай токены и не коммить .env.

Сделай по порядку
1. git clone или git pull, ветка main.
2. Node 22, npm ci.
3. Не коммить .env, screenshots, .vercel/output, artifacts, attachments, .grok/preview.log.
4. .env хаба рядом с проектом:
   OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
   OPENCLAW_GATEWAY_TOKEN=<gateway.auth.token, не печатать>
   OPENCLAW_MODEL=openclaw/default
   TELEGRAM_BOT_TOKEN=<токен @HubAlertsbot>
   TELEGRAM_OWNER_ID=1916536646
   PGLITE_DATA_DIR=/var/lib/r2d2/pglite
   Календари — из /root/.openclaw/credentials/, если лежат.
5. npm run build
6. Только эта машина, не Vercel:
   npx vite preview --host 127.0.0.1 --port 8080
   Снаружи Caddy/nginx с HTTPS. Не публикуй :18789 и :8080 без TLS.
7. systemd-сервис preview после ребута. Gateway не рестартуй без нужды.
8. Поставь cron/timer на scripts/hub-watchdog.sh раз в минуту:
   HUB_HEALTH_URL=http://127.0.0.1:8080/
   HUB_RESTART_CMD='команда рестарта preview'
9. Проверка: /v1/models на шлюз; открой HTTPS URL ПЕРВЫМ; имя + PIN; Настройки → AI-доступ → Проверить агента; чат «Что у меня сегодня?»; алерт в @HubAlertsbot на 1916536646, не в @Dmbotmy_bot.

Верни: HTTPS URL, имена переменных, каким ботом уходят алерты, результат проверки агента.

Запрещено: переписывать приложение, Mini App как вход, публиковать 18789, токен OpenClaw-бота в хаб, Vercel + 127.0.0.1, секреты в чат.
```

---

## Переменные

Секреты только в окружении хоста. В репозиторий не класть.

### Telegram — два разных бота

| Имя | Зачем |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Только `@HubAlertsbot`. Напоминания, вход, падение. Не токен `@Dmbotmy_bot` |
| `TELEGRAM_OWNER_ID` | Chat id владельца `1916536646`. Не логин и не id бота |
| `AI_KEY_SECRET` | AES-ключ для BYOK (если нет — берётся bot token хаба) |

`TELEGRAM_OWNER_ID` больше не выдаёт роль admin. Admin = первый, кто открыл пустой хаб и задал имя.

### База

| Имя | Зачем |
|---|---|
| `DATABASE_URL` | Neon / Postgres в проде. Пусто = PGLite |
| `PGLITE_DATA_DIR` | Каталог PGLite на диске. Рекомендуется `/var/lib/r2d2/pglite` |

### OpenClaw (чат хаба)

| Имя | Зачем |
|---|---|
| `OPENCLAW_GATEWAY_URL` | `http://127.0.0.1:18789`. Без `/v1` |
| `OPENCLAW_GATEWAY_TOKEN` | `gateway.auth.token` |
| `OPENCLAW_MODEL` | `openclaw/default` |
| `OPENAI_MODEL` / `ANTHROPIC_MODEL` | только BYOK |

### iCloud / Google Calendar

Как раньше: из env или вручную в Настройках. Имена: `ICLOUD_*`, `GOOGLE_CALENDAR_*`.

### Прочее

| Имя | Зачем |
|---|---|
| `SESSION_TTL_SECONDS` | TTL сессии, по умолчанию 7 дней |
| `XAI_API_KEY` | Только дайджест новостей |
| `HUB_SETUP_TOKEN` | Одноразовый перехват owner, когда код этого потока появится |

---

## OpenClaw gateway

Эндпоинт `POST /v1/chat/completions` на этой машине **уже включён**. Не выключать.

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

`OPENCLAW_MODEL=openclaw/default` — это агент `main`. Отдельного агента без tools пока не нужно: хаб шлёт `tool_choice: "none"`.

Порт `18789` наружу не публиковать. Токен шлюза = права оператора.

### Проверка

```bash
curl -sS http://127.0.0.1:18789/v1/models \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN"
```

В хабе: Настройки → AI-доступ → «Проверить агента».

### Почему агент молчит

1. Выключен chatCompletions.
2. Хаб не на этой машине, а URL `127.0.0.1`.
3. Нет `OPENCLAW_GATEWAY_TOKEN`.
4. В Настройках режим «Выкл».
5. В URL шлюза дописали `/v1`.
6. `OPENCLAW_MODEL` — имя модели провайдера, а не агента.

Чат ≠ дайджест. Дайджест может жить без `XAI_API_KEY`.

---

## Watchdog

`scripts/hub-watchdog.sh` — раз в 30–60 секунд проверяет `HUB_HEALTH_URL`. Если down — `HUB_RESTART_CMD` и одно сообщение в `@HubAlertsbot` (антишторм 10 минут). Не пересобирает приложение.

```bash
chmod +x scripts/hub-watchdog.sh
# пример cron:
# * * * * * HUB_HEALTH_URL=http://127.0.0.1:8080/ HUB_RESTART_CMD='systemctl restart hub' /opt/hub/scripts/hub-watchdog.sh
```

---

## Сборка на мини-ПК

```bash
git clone https://github.com/Dmgromov01/atlas-green-pearl-dawn.git
cd atlas-green-pearl-dawn
git checkout main
npm ci
# .env рядом, не коммитить
npm run build
npx vite preview --host 127.0.0.1 --port 8080
```

Перед reverse-proxy — HTTPS. Миграции: `npm run build` уже зовёт `db:migrate`.

---

## Отдельный сайт

1. `https://<домен>/`
2. iPhone: Поделиться → На экран «Домой»
3. Первый экран — имя. Город из геолокации
4. PIN — в Настройках
5. Первый посетитель = admin. Чат — OpenClaw

---

## Что уже в коде

- Погода, курсы, задачи, дайджест, переводчик, календари iCloud и Google
- Отдельный сайт, не Mini App
- Агент OpenClaw, BYOK, квоты, «добавь задачу/событие»
- PIN, семейный шаринг, админка
- Watchdog-скрипт для мини-ПК
