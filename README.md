# AI Personal Hub

Семейный хаб: погода, задачи, календари iCloud и Google, дайджест, переводчик, агент через OpenClaw. Русский интерфейс.

Репозиторий: [Dmgromov01/atlas-green-pearl-dawn](https://github.com/Dmgromov01/atlas-green-pearl-dawn)

## Стек

TanStack Start · React 19 · Tailwind v4 · Zustand · Postgres (Neon или PGLite)

## Запуск

```bash
npm ci
npm run dev
```

Сборка: `npm run build`. Проверки: `npm run typecheck` и `npm test`.

## Развёртывание и агент

Полные шаги — в [OPENCLAW.md](./OPENCLAW.md).

Коротко:

- Хаб — отдельный сайт (экран Домой), не Telegram Mini App.
- Чат в приложении идёт в локальный OpenClaw: `OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789` без `/v1`, модель `openclaw/default`.
- В шлюзе должно быть `gateway.http.endpoints.chatCompletions.enabled = true`.
- Пейджер хаба — бот `@HubAlertsbot`. Канал OpenClaw — `@Dmbotmy_bot`. Токены не смешивать.
- Первый открывший сайт становится владельцем: Face ID — основной вход, PIN — запасной. Семья — только по одноразовому инвайту.
- Watchdog: `scripts/hub-watchdog.sh`.
