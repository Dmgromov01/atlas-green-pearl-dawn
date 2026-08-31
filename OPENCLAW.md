# AI Personal Hub — live contract

- Repo: `Dmgromov01/atlas-green-pearl-dawn`, main.
- Site: `https://hub.gbkz.uk`; `r2d2-hub` запускает `.output/server/index.mjs` на `127.0.0.1:8091`.
- Gateway: `http://127.0.0.1:18789` без `/v1`; не менять bind и не публиковать порт.
- Auth: Face ID + PIN + одноразовый инвайт, не Mini App/HMAC initData.
- Чат: `OPENCLAW_AGENT_ID=hub`, `OPENCLAW_MODEL=openclaw/hub`, `hub:<userId>`, `tool_choice: none`, hub tools off.
- Оператор: `@Dmbotmy_bot` → main; пейджер: `@HubAlertsbot`.
- Calendar UI: Google OAuth хаба. iCloud dormant; `hub_icloud` не drop.
- Watchdog: `/healthz`; backup: `/var/backups/r2d2`, 7 копий без `.env`/credentials.

Обновление: проверить status/RAM/probes → `npm ci`, typecheck, test, build → restart `r2d2-hub` → проверить `/`, `/healthz`, `/readyz`.
Не возвращать Mini App, `:8080`, vite preview, Vercel, второй gateway или tools hub.
