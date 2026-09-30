---
name: doc-sync
description: Re-evaluate existing product docs against code reality — for each doc of the product-docs family read its product-docs header, git-diff the sources since the verified marker, re-analyze only the touched areas (code is the single source of truth), patch facts directly, gate judgments via questions, then bump the marker. Use when the user says documentation drifted after rework ("переоцени документацию", "доки отстали от кода", "синхронизируй доки с кодом", "проверь актуальность product docs", "обнови обзор после доработки", "doc drift"), after an /improvements or /feature stage touched documented areas, or before a demo/report to make sure the product story matches the build. Creating the docs family from scratch is /product-analysis; the doc contract lives in skills/product-analysis/references/doc-contract.md.
---

# /doc-sync

Переоценка реалий: код изменился — проверить доки семейства product-docs
(`docs/modules/`, контракт —
`skills/product-analysis/references/doc-contract.md`) и привести их к
действительности. Создание доков с нуля — `product-analysis`; этот
скилл работает только с тем, что уже есть.

Принцип эпистемологии: **analysis может верить докам, sync — только
коду.** Перечитывание доков консервирует дрейф («доки-из-доков»);
источник истины — git-диф источников и текущий код.

## A. Фазы (стейт-машина)

### 1. detect — инвентаризация и диф

- Найти доки семейства: `grep -rl "product-docs:" docs/modules/`.
  Охват из запроса: все | конкретная дока/модуль | доки с `stale=true`.
- Для каждой доки распарсить хедер: `sources`, `verified` (дата · sha),
  `stale`.
- Диф: `git diff --name-only <verified-sha>..HEAD -- <sources>` плюс
  незакоммиченное: `git status --short -- <sources>`.
- Классификация доки:
  - **clean** — источники не менялись → пропустить;
  - **drift** — файлы менялись → кандидат на реанализ;
  - **scope-grew** — появились файлы в областях доки вне её `sources`
    (новая страница/сервис) → предложить расширить глоубы через гейт;
  - **stale** — помечена вручную → реанализ независимо от дифа.
- Дока без хедера — легаси: предложить product-analysis (установка
  контракта) или добавить хедер с `stale=true` и полным прогоном.

### 2. scope — границы реанализа

- drift → **один Explore-агент на доку** по её `sources`: что из
  зафиксированных фактов изменилось (маршруты, поля, статусы, лимиты,
  матрицы, экраны). Промпт: сравнить код с конкретными секциями доки,
  вернуть список расхождений с путями к файлам.
- Фильтр шума — не продуктовое изменение, пропускать с пояснением в
  отчёте: пересевы `schemaVersion` (пересев LS мока), форматирование,
  переименования без смены поведения, правки `docs/**`, изменения
  сборки/инфраструктуры.

### 3. patch — правка фактов

- **Факты правит сам**: маршруты, поля, статусы, лимиты/квоты, матрицы
  доступов, состав экранов — по секциям контракта, хирургически, не
  переписывая доку целиком.
- **Суждения не трогает молча**: приоритизация, сквозные выводы,
  «главный кандидат на доработку», интерпретации кейсов — собрать в
  таблицу «реальность → предлагаемая правка доки» и провести через
  AskUserQuestion (одно окно на доку).
- Гипотезы: если код опроверг гипотезу — снять; если подтвердил —
  перевести в факты; появились новые неизвестные — добавить с пометкой.

### 4. mark — маркер актуальности

- После правок: `verified = сегодня · short-sha HEAD` (чистое дерево),
  `stale=false`.
- Незакоммиченные правки в `sources` — в `verified` не входят: в
  отчёте строка «дока верифицирована по коммиту N, но есть
  незакоммиченные изменения в X».
- `verified-sha` недостижим (rebase/squash) → диф по дате
  `git log --since=<дата> --oneline -- <sources>`; если и это
  неоднозначно — полная ревизия секции (fallback: агент по всем
  `sources` доки).
- Док вне охвата запроса, но с drift → пометить `stale=true`
  (честный долг, а не тихая свежесть).

### 5. report — changelog

Сводка по докам: дока × секция × изменение (факт / суждение-гейт) ×
причина (какой коммит/диф повлиял). Плюс: список scope-grew предложений
и легаси-док без хедера.

## B. Интеграция и точки роста

- **feature/improvements на verify** могут помечать `stale=true` в
  затронутых доках — тогда detect стартует с них без дифа. Пока
  пометки ручные; внедрение — доработка feature-скилла.
- Контракт (хедер, семейство, правила) —
  `skills/product-analysis/references/doc-contract.md`; изменения
  контракта — там, не здесь.
- Коммит доков — по запросу пользователя; скилл не коммитит сам.
