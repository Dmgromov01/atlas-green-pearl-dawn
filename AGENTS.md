# AI Personal Hub / r2d2-hub

Живой семейный сайт https://hub.gbkz.uk на hiplet.
Это не Grok App Builder и не Telegram Mini App.

Канон инфры: /root/openclaw/STATE.md
Канон деплоя: OPENCLAW.md
Канон скилла: /root/openclaw/skills/r2d2-hub/SKILL.md

## Runtime
- systemd unit: r2d2-hub
- ExecStart: node /root/atlas-green-pearl-dawn/.output/server/index.mjs
- Bind: 127.0.0.1:8091 (не 8080, не 0.0.0.0)
- Снаружи: nginx → https://hub.gbkz.uk
- Probes: /healthz /readyz
- База: PGLite /var/lib/r2d2/pglite. Не мигрировать без отдельного ТЗ.
- startup.sh на hiplet = no-op (exit 0). Прод поднимает systemd.

## Auth и чат
- Вход: Face ID основной, PIN запасной, семья по одноразовому инвайту.
- Не принимать Telegram WebApp credentials и не возвращать Mini App.
- Чат сайта → OpenClaw agent hub, session hub:<userId>, tool_choice none.
- Агент hub: tools.allow=[]. Не включать tools.
- Модель чата хаба: openclaw/hub. Оператор Telegram: @Dmbotmy_bot → main.
- Пейджер: @HubAlertsbot. Токены не смешивать.

## Календарь
- UI хаба: Google OAuth/PGLite.
- iCloud UI и автосинк выключены. CalDAV-код и таблица hub_icloud dormant.
- Не DROP hub_icloud. Не возвращать iCloud UI.

## Запреты на hiplet
- Не слушать :8080. Не vite preview. Не Vercel preset как прод.
- Не возвращать legacy PWA bridge и public/__grok.
- Не возвращать Mini App и его legacy routing/service.
- Не открывать 8091/18789 на WAN. Не второй gateway.
- Не рестартить openclaw-gateway из Telegram.
- Не добавлять фичи без отдельного ТЗ со списком файлов.
- Не удалять better-auth/migrations/auth без карты зависимостей (это не это ТЗ).
- Не коммитить .env, .output, .vercel/output, секреты.

## Стек (факт, не sandbox-инструкция)
TanStack Start, React 19, Vite 8, Tailwind 4, Nitro node-server, PGLite.
Правки продукта — только по отдельному ТЗ.
