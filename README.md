# AI Personal Hub

Семейный хаб: погода, курсы, задачи, календари iCloud и Google, дайджест, переводчик, агент через OpenClaw. Русский интерфейс.

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

Полные шаги, переменные окружения, включение HTTP Chat Completions у OpenClaw и диагностика «агент молчит» — в [OPENCLAW.md](./OPENCLAW.md).

Коротко: хаб лучше поднимать на том же мини-ПК, что и OpenClaw. В конфиге шлюза обязательно `gateway.http.endpoints.chatCompletions.enabled = true`. URL шлюза — `http://127.0.0.1:18789` без `/v1`. Первый открывший сайт становится администратором.
