# Контракт состояния (`.app-build/`)

Единственный источник правды о прогрессе. Оркестратор читает его на
старте каждой сессии и пишет — на каждом переходе. Субагенты стейт не
трогают.

## Layout

```
<PROJECT_ROOT>/.app-build/
├── state.json                 # машина (схема ниже)
├── decisions.md               # журнал договорённостей D-xxx
└── artifacts/
    ├── modules-registry.md    # таблица «экран → модуль → маршрут → доступ → природа»
    ├── design-system.md       # реестр DS: токены, примитивы, shared v1
    ├── refactor/
    │   └── report-<n>.md      # отчёты канонизации по циклам
    └── modules/
        └── <module-id>/
            ├── plan.md        # план-договор модуля (фаза module-plan)
            └── types.md       # типы для types-first (домен/сервис/vm)
```

`state.json` и `decisions.md` не содержат кода — только факты процесса.

## Схема state.json (stateVersion 3)

```jsonc
{
  "stateVersion": 3,
  "phase": "design-system",          // текущая фаза реестра SKILL.md §D
  "sessionMode": "auto",             // auto | step | pick (последний выбор)
  "source": {                        // прототип (фиксируется в intake)
    "type": "html",
    "ref": "prototype/index.html"
  },
  "projectRoot": ".",
  "drivers": {                       // L2-варианты по семействам
    "styling": "tailwind",           // → references/drivers/styling/*
    "adaptivity": "prototype-canon", // → references/drivers/adaptivity/*
    "uiPolish": "l1-standard"        // уровень полировки драфта →
                                     // skills/components/references/polish-levels.md
  },
  "shell": {                         // решения shell-decisions (копия D-фактов)
    "routing": true,                 // url-роутинг с deep links
    "auth": "login",                 // "none" | "login" | "login+roles"
    "roles": ["client", "partner"],
    "pwa": false,
    "startModule": "feed"
  },
  "modules": {
    "queue": ["feed", "requests"],   // порядок = порядок батчей
    "batchSize": 3,
    "items": {
      "requests": {
        "status": "in_progress",     // planned | in_progress | review | done
        "subphase": "views",         // plan | types | service | views | glue | review
        "agents": 2                  // уровень параллелизма модуля
      }
    }
  },
  "refactorCycle": 2,                // номер последнего цикла refactor
  "decisions": { "lastId": 7 },      // счётчик D-записей
  "stale": []                        // id артефактов/решений к пересмотру
}
```

Правила записи:

- переход фазы атомарен: артефакт записан → state.json обновлён;
- неизвестные ключи не удалять (forward-compat), новые — только через
  миграцию с bump `stateVersion`;
- `stale[]` очищается только выполненными invalidate-правилами фаз.

## decisions.md — формат D-записи

```markdown
### D-007 — Подтверждение e-mail при регистрации
- Скоуп: shell / модуль auth
- Фаза: shell-decisions
- Вопрос: нужен ли двухшаговый e-mail-флоу?
- Решение: да, мастер из двух шагов
- Последствия: auth получает subphase wizard; событие signup.completed;
  consumers: skeleton, module:auth
- Статус: принят 2026-09-01
```

Требования:

- один вопрос — одна запись; id сквозные, не переиспользуются;
- «Последствия» обязаны перечислять consumers — по ним строится `stale`
  при переоткрытии;
- статус: `принят` | `пересматривается` | `отменён` (отменённая запись
  остаётся в журнале, не удаляется);
- дефолтные ответы тоже фиксируются (источник: «дефолт фазы»), иначе
  регенерация разъедется с прошлым прогоном.

## Переоткрытие (reopen → stale)

1. В journal: у D-записи статус → `пересматривается`, пишется новая
   D-запись с решением и ссылкой `supersedes: D-007`.
2. В state.json: consumers старой записи → `stale[]`.
3. Фазы при входе обязаны проверить: их артефакт в `stale[]` → сначала
   invalidate-правила фазы (обычно: перегенерировать артефакт, не трогая
   утверждённые D-записи), потом работа.

## Миграции

| Версия | Изменение | Миграция |
|---|---|---|
| 1 | базовая схема | — |
| 2 | `drivers.adaptivity` (мобильная адаптация десктопного прототипа) | `drivers.adaptivity = "prototype-canon"` (дефолт семейства; не спрашивать) |
| 3 | `drivers.uiPolish` (уровень полировки вёрстки драфта; L2 — только поздний проход скиллом components) | `drivers.uiPolish = "l1-standard"` (дефолт семейства; не спрашивать) |

Правило: любое изменение схемы = новая строка таблицы + bump в примере
выше. Оркестратор при несовпадении версий применяет миграции по порядку.
