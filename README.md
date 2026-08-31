# AI Personal Hub

Семейный хаб: погода, задачи, Google Calendar, дайджест, переводчик,
напоминания, агент через OpenClaw. Русский интерфейс.
Сайт: https://hub.gbkz.uk

Канон деплоя: OPENCLAW.md
Канон инфры: /root/openclaw/STATE.md

## Стек
TanStack Start · React 19 · Tailwind v4 · Zustand · PGLite
Прод: Nitro node-server, не vite preview и не Vercel.

## Прод на hiplet
systemd r2d2-hub → node .output/server/index.mjs
127.0.0.1:8091 ← nginx ← https://hub.gbkz.uk
Probes: /healthz /readyz
Auth: Face ID + PIN + одноразовый инвайт. Не Mini App, не Telegram initData.

## Агент
Чат сайта → OpenClaw agent hub, session hub:<userId>, tool_choice none,
tools.allow=[], модель openclaw/hub.
Оператор: @Dmbotmy_bot → main. Пейджер: @HubAlertsbot. Токены не смешивать.
Gateway: http://127.0.0.1:18789 без /v1.

## Календарь
Google OAuth хаба. iCloud dormant, hub_icloud не drop.

## Проверки (не прод-запуск)
npm run typecheck
npm test
Сборка: npm run build — только когда есть отдельное ТЗ на релиз.
Прод поднимает systemd, не npm run dev.
