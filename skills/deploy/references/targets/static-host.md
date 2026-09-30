# Цель деплоя: static-host

Семейство: `drivers.target`. Статус: **каркас-заглушка** — дописать
при первом использовании (workflow Pages, правило base, 404-фолбэк).

## Когда

Сервера нет, статики SPA достаточно (моки / MVP-этап проекта).

## GitHub Pages

- Источник — Actions-деплой статики (не ветка); путь `/<repo>/` →
  сборка с `--base=/<repo>/`.
- SPA-роутер: Pages не умеет серверный fallback → `404.html` =
  копия `index.html` (настроить копирование в сборке) или hash-режим
  роутера платформы (`router: "off"` / memory-история).
- Workflow: build → `upload-pages-artifact` → `deploy-pages`
  (permissions: pages write, id-token write).

## Другие (упоминания)

Vercel/Netlify — статики из коробки, SPA-fallback настроен по
умолчанию; выбирать, если заказчик уже живёт там. Бэкенд/WS —
за пределами этого драйвера (см. SKILL.md §C).
