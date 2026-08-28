# AI Personal Hub — развёртывание через OpenClaw

Репозиторий: [Dmgromov01/atlas-green-pearl-dawn](https://github.com/Dmgromov01/atlas-green-pearl-dawn)

Хаб — отдельный сайт (`https://hub.gbkz.uk`), не Mini App.
Чат хаба идёт в локальный gateway. Пейджер — `@HubAlertsbot`. Оператор — `@Dmbotmy_bot`.

---

## Промпт агенту OpenClaw на этой машине (скопировать целиком)

```text
Ты OpenClaw на этом мини-ПК. Не пиши хаб заново. Не печатай секреты.

Репо хаба: https://github.com/Dmgromov01/atlas-green-pearl-dawn ветка main (после pull будет изоляция сессий хаба).
Живой хаб: systemd r2d2-hub, порт 8091, снаружи https://hub.gbkz.uk
Шлюз: 127.0.0.1:18789, loopback, auth=token, chatCompletions уже включён. Не трогай bind и не публикуй 18789.

Цель: убрать двойники и сузить радиус взрыва. Код хаба не переписывать.

Сделай по порядку и верни что получилось.

1) Останови старый miniapp
   systemctl stop miniapp && systemctl disable miniapp
   Порт 8080 больше не должен слушать.

2) git pull хаба (main), пересобери только если появились новые коммиты, перезапусти r2d2-hub.
   Watchdog должен бить в http://127.0.0.1:8091/ (не 8080).
   HUB_RESTART_CMD='systemctl restart r2d2-hub'
   Не рестартуй openclaw-gateway, если упал только хаб.

3) Агент hub без tools (семейный чат).
   Создай агента id=hub. Tools выключи: ни exec, ни files, ни github, ни tg-user-tools, ни sessions.send.
   main не трогай — это только @Dmbotmy_bot.
   В .env хаба:
     OPENCLAW_MODEL=openclaw/hub
     OPENCLAW_AGENT_ID=hub
   Перезапусти r2d2-hub. Проверь Настройки → Проверить агента.

4) Бэкап. Поставь ночной cron на scripts/hub-backup.sh из репо хаба:
   каталоги /var/lib/r2d2/pglite и /root/.openclaw (без .env и credentials).
   7 копий в /var/backups/r2d2.

5) Убери дубли cron, если хаб уже показывает то же:
   digest.py / gcal_reader.py / bot_sender.py / ics_generator.py — не должны писать в Telegram параллельно с хабом.
   Оставь: clawpatch-weekly, healthcheck, flight_api, hub-watchdog, backup.

6) Боты не смешивать.
   .env хаба: TELEGRAM_BOT_TOKEN = @HubAlertsbot, TELEGRAM_OWNER_ID=1916536646.
   Токен @Dmbotmy_bot только в OpenClaw. tg-user-tools только у агента main, не у hub.

7) Не делай: новые плагины, открыть 8091/18789, Vercel, Mini App как вход, Docker «для красоты».

Верни списком:
- miniapp выключен? (systemctl is-enabled / is-active)
- watchdog URL
- агент hub создан, какие tools у него
- OPENCLAW_MODEL в env хаба (имя, не секреты)
- куда кладётся бэкап и есть ли первый архив
- какие cron сняты / оставлены
- результат curl http://127.0.0.1:8091/ и пробы «Проверить агента»
```

---

## Снимок машины (27.08.2026)

| Параметр | Значение |
|---|---|
| Хаб | `r2d2-hub` :8091 → https://hub.gbkz.uk |
| Miniapp | :8080, выключить |
| Шлюз | 127.0.0.1:18789, chatCompletions вкл |
| Оператор | агент `main` + `@Dmbotmy_bot` |
| Семья | агент `hub` без tools + сайт хаба |
| Пейджер | `@HubAlertsbot` → 1916536646 |
| База | PGLite `/var/lib/r2d2/pglite` |

---

## Переменные хаба

| Имя | Значение |
|---|---|
| `OPENCLAW_GATEWAY_URL` | `http://127.0.0.1:18789` без `/v1` |
| `OPENCLAW_GATEWAY_TOKEN` | token шлюза |
| `OPENCLAW_MODEL` | `openclaw/hub` после шага 3, до этого `openclaw/default` |
| `OPENCLAW_AGENT_ID` | `hub` |
| `TELEGRAM_BOT_TOKEN` | только `@HubAlertsbot` |
| `TELEGRAM_OWNER_ID` | `1916536646` |
| `PGLITE_DATA_DIR` | `/var/lib/r2d2/pglite` |

Календари: `ICLOUD_*`, `GOOGLE_CALENDAR_*` или Настройки.

---

## Код хаба → шлюз

- `tool_choice: "none"`
- `user` и `x-openclaw-session-key` = `hub:<userId>` — сессия не смешивается с операторским main
- история в запросе: последние 12 реплик

---

## Watchdog и бэкап

```bash
HUB_HEALTH_URL=http://127.0.0.1:8091/
HUB_RESTART_CMD='systemctl restart r2d2-hub'
# cron * * * * * scripts/hub-watchdog.sh
# cron 15 3 * * * scripts/hub-backup.sh
```

---

## Что уже в коде

Погода, задачи, дайджест, переводчик, iCloud/Google, чат OpenClaw, Face ID / PIN / инвайт, админка, watchdog, backup-скрипт.
