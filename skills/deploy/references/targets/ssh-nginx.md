# Цель деплоя: ssh-nginx

Семейство: `drivers.target` (дефолт). Статус: **полная** — паттерн
обкатан на u-kon (workflow + rsync + nginx sub-path). Модель: сервер
пользователя + GitHub Actions; ручной вариант — тот же rsync из локали.

## 1. Сервер: что уже есть

По ssh-алиасу (спросить, если нет в `~/.ssh/config`):

- доступ: `ssh <alias> 'echo ok'`;
- nginx: `nginx -v`; каталог конфигов (macOS —
  `/opt/homebrew/etc/nginx/servers/`, linux — `/etc/nginx/conf.d/`);
  `nginx -T | grep -i <project>` покажет существующий блок;
- целевой каталог и его владелец.

Три исхода:

| Ситуация | Действие |
|---|---|
| nginx отдаёт сайт, конфиг под проект есть | ничего не менять: **скинуть инструкции** (путь, команда reload) |
| nginx есть, блока под проект нет | добавить server-блок/location: бэкап → правка → `nginx -t` → reload |
| nginx нет | установить (brew/apt), конфиг с нуля, старт, проверить |

«Скинуть инструкции» = сервер админит сам пользователь: отдать готовый
конфиг и команды, не лезть по ssh без доступа.

## 2. Конфиг nginx (канон)

`<!-- L3: SPA на sub-path -->`
```nginx
server {
  listen 80;
  server_name example.com;

  location /<name>/ {
    alias /srv/<name>/dist/;
    try_files $uri $uri/ /<name>/index.html;   # роутер-fallback SPA
  }

  # хешированные ассеты — длинный cache
  location ~* ^/<name>/assets/ {
    alias /srv/<name>/dist/assets/;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```
`<!-- /L3 -->`

Правила: `index.html` — без кэша (или короткий), чтобы релиз
подхватывался; http→https — только если сертификаты на сервере уже
есть (тогда 301); чужие блоки не трогать.

## 3. CI: GitHub Actions

Секреты раннера: `gh secret set DEPLOY_KEY / SSH_HOST / SSH_PORT /
SSH_USER` — deploy-ключ только этого сервера, не личный ключ.

`<!-- L3: канонический workflow (обкатан на u-kon) -->`
```yaml
name: Deploy <project>
on:
  push:
    branches: [ master ]
    paths: [ "projects/<project>/**", "src/**", "package*.json", … ]
  workflow_dispatch:
permissions: { contents: read }
concurrency:
  group: deploy-<project>
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: npm }
      - run: npm ci
      # монорепо: npm run project:<project>:build -- --base=/<project>/
      - run: npm run build -- --base=/<project>/
      - uses: webfactory/ssh-agent@v0.9.1
        with: { ssh-private-key: "${{ secrets.DEPLOY_KEY }}" }
      - run: mkdir -p ~/.ssh && ssh-keyscan -p ${{ secrets.SSH_PORT }}
             ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts
      - name: Deploy dist
        run: rsync -avz --delete
             -e "ssh -p ${{ secrets.SSH_PORT }}"
             projects/<project>/dist/
             "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:<target>/dist/"
```
`<!-- /L3 -->`

Нюансы: `paths` — только влияющее на проект; `--delete` у rsync —
согласовать (сносит лишнее в целевом каталоге); первый прогон —
руками (`workflow_dispatch`), не пушем.

## 4. Ручной деплой (без CI)

Сборка с `--base` → rsync теми же флагами из локали; записать команду
в MEMORY.md — это и есть режим «агент сам деплоит» (deploy-now).

## 5. Verify

`curl -sI https://<host>/<name>/` → 200; глубокая ссылка
(`/<name>/<module>/…`) → 200 (fallback работает); asset из бандла →
200 + cache-заголовок. Изменения не видны — проверить, что index.html
не закэширован.
