---
name: deploy
description: Host and deploy a shell-kit application — pick a hosting platform, set up basic CI/CD (GitHub Actions on push to master plus manual dispatch, or agent-driven rsync), run deploys, and provision a server over SSH (check existing nginx and hand over instructions, or write an nginx config from scratch and start it). Use when the user says "задеплой", "захостить", "нужно захостить", "выложить сайт/приложение", "настроить CI/CD", "настроить деплой", "деплой на сервер", "host", "deploy", when a deploy is already configured (run it and verify the URL), or when a server/nginx must be set up (ask for SSH access, inspect nginx, generate config).
---

# /deploy

Хостинг и CI/CD проекта. Два режима, маршрут выбирает проба — ничего
не спрашивать, пока не известно, что уже настроено:

- **deploy-now** — «задеплой»: деплой настроен → запустить (workflow
  или ручной rsync) и проверить URL;
- **setup** — «нужно захостить»: не настроено → гейт «куда и как» →
  конфигурация CI/CD и сервера → первый деплой → проверка.

## A. probe — всегда первым

1. **Память проекта**: MEMORY.md, раздел «Деплой» — факты (сервер,
   ssh-алиас, путь на сервере, base, workflow, URL); PROJECT.md —
   нюансы и запреты.
2. **ФС**: `.github/workflows/*deploy*`, deploy-скрипты в
   package.json, nginx-конфиги/Dockerfile в проекте,
   `docs/production.md` — прод-скорборд (если есть).
3. **Инструменты**: `gh auth status` (для GitHub-целей), ssh-алиасы
   (`~/.ssh/config`) и доступность сервера (`ssh <alias> 'echo ok'`).
4. Маршрут: деплой настроен → §B; нет → §C.

## B. deploy-now

- **Прод-гейт (мягкий)**: свежий `docs/production.md` с 🔴-блокерами →
  показать их **предупреждением** до запуска (скорборд — скилл
  `production`); решение за человеком, деплой не блокируется.
  Скорборда нет / старый — молча не считать готовым, просто деплоить.
- **CI**: `gh workflow run <name>` (или ждём ран от push) →
  `gh run watch` до завершения.
- **Ручной**: сборка → rsync командой из MEMORY.md (раздел «Деплой»).
- **verify**: URL отвечает (`curl -sI`); для SPA — главная **и
  глубокая ссылка** (проверка роутер-fallback); один хешированный
  asset из бандла — 200.
- Сбой — показать лог раннера / вывод rsync, не ретраить молча.

## C. setup (содержательный гейт)

- **Куда?** `<!-- L2: drivers.target -->`
  - есть сервер / ssh-алиас → **ssh-nginx** (дефолт платформы;
    драйвер `references/targets/ssh-nginx.md`);
  - сервера нет, статики достаточно → **static-host** (GitHub Pages;
    драйвер `references/targets/static-host.md`);
  - нужен бэкенд/WS → честно: вне каркаса статического деплоя,
    вопрос заказчику (стратегии api/transport проекта).
- **Триггер CI**: push в master (авто) + `workflow_dispatch` (ручной)
  — дефолт оба. «Агент сам деплоит» = режим deploy-now ручным путём
  (без CI); выбранный путь фиксируется в MEMORY.md.
- **Путь**: поддомен (`base=/`) vs sub-path (`--base=/<name>/` у
  сборки). Дефолт: как решит владелец сервера; для shared-сервера —
  sub-path.

## D. Реализация по драйверу

`references/targets/<driver>.md` — серверная часть (nginx: инструкции
для админа / конфиг с нуля) и CI (workflow, секреты).

## E. verify + фиксация

- Первый деплой прогнан; URL живой, включая глубокую ссылку SPA.
- Факты → MEMORY.md, раздел «Деплой»: сервер, ssh-алиас, путь на
  сервере, base, workflow-файл, URL, команда ручного деплоя.
- Секреты — только через `gh secret set` / окружение раннера; в репо
  ничего секретного.

## F. Правила безопасности

- На сервер — только через ssh-доступ, подтверждённый пользователем;
  деструктивное (перезапись конфига, рестарт сервиса, `--delete` у
  rsync) — с явного согласия.
- Перед правкой чужого nginx-конфига — бэкап (`cp x x.bak`), после —
  `nginx -t` и reload; чужие server-блоки не трогать.
- Пароли/ключи не логировать, не коммитить, не угадывать: нет доступа
  к серверу — скинуть инструкции, а не подбирать.
