# MEMORY — shell-kit

## Суть

Публичный npm-пакет (git-зависимость `git+https://github.com/Termin89/shell-kit.git#<тег>`):
ядро модульных React-приложений — слои core / service / react / ui / router /
queries (+ стили `shell-kit/ui/styles.css`) и платформенные скиллы
`skills/` (доставляются пакетом в `node_modules/shell-kit/skills/`).
Потребители — репозитории проектов (u-kon, partner-portal), каждый со своим
MEMORY.md и приватным контекстом.

## Публичность (2026-09-30)

- Репозиторий публичный. Перед открытием история схлопнута в один коммит
  `37f4f7c` (orphan, автор — GitHub noreply `20210888+Termin89@users.noreply.github.com`):
  в старой истории оставались код вынесенных проектов (`projects/`, 625
  файлов) и личный e-mail автора — наружу не отдаём.
- Тег `v0.1.0` перетегнут (аннотированный) на `37f4f7c`, master и тег
  запушены force. Потребители обновили package-lock на новый хеш тега.
- Скан перед открытием: токенов/ключей в дереве и истории нет.
- Старые коммиты GitHub временно отдаёт по прямому SHA (dangling) — из
  UI/веток/тегов недостижимы, ждать GC.

## Правила публичного репо

- Не коммитить приватный контекст: детали серверов/секретов/клиентов,
  личные заметки — в MEMORY потребителей (приватные репо), не сюда.
- Авторство коммитов — noreply GitHub (`20210888+Termin89@users.noreply.github.com`),
  не личный e-mail.
- Релизы — теги `vN.N.N`; после тега потребители подтягивают обновление
  `npm update shell-kit` (пиннинг хеша тега в их package-lock).

## Грабли npm git-зависимостей (выяснено 2026-09-30)

npm (pacote) для github-git-deps сначала пробует https, при отсутствии
кредов откатывается на ssh (`git ls-remote ssh://git@github.com/...`) —
на CI-раннере без ключей это publickey failure, независимо от формы спеки
(`github:`/`git+https`/`git+ssh`) и git-insteadOf. Публичный репозиторий
решает вопрос целиком (https-клон анонимен). Локальный git 2.14 игнорирует
`GIT_CONFIG_GLOBAL` (появился в 2.32) — ловить эксперименты по рерайтам
URL только на свежем git.

## Карта репозитория

- `src/{core,service,react,ui,router,queries}/` — слои ядра (readme.md в
  слоях), `src/demo/` — витрина.
- `skills/` — платформенные скиллы (feature / improvements / module-pass /
  production / deploy / service / storybook / prototype-to-app / …).
- `.github/workflows/ci.yml` — линт + типы + сборка lib/demo + валидация
  плагина + pack --dry-run.
- Карта и статус пакета — README.md / MAP.md / PLAN.md (корень).
