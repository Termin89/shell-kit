---
name: mobile-focus-zoom
description: Guarantee app-like form focus on mobile — iOS Safari (incl. standalone PWA) auto-zooms the viewport when a native form control (input/select/textarea) with computed font-size <16px receives focus, the field "expands to screen width". Audit and fix pattern for shell-kit apps — one unlayered CSS guard (16px on mobile) instead of maximum-scale=1 (kills pinch-zoom, WCAG 1.4.4). Use when the user says «поле зумится при фокусе», «инпут приближается на айфоне», «при фокусе приближается и становится на ширину экрана», «сделай как в нативном приложении — без зума», «пробеги по проекту, чтобы нигде не зумилось», "input focus zoom ios".
---

# /mobile-focus-zoom

Гарантия «как в нативном приложении»: тап/фокус в поле ввода НЕ должен
масштабировать вьюпорт. Проявление бага (iOS Safari, включая standalone
PWA): при фокусе контрола (input/select/textarea) браузер приближает
страницу к элементу — поле «разъезжается» на ширину экрана, после
blur вьюпорт не всегда возвращается.

## 1. Корень и правило

iOS Safari автозумит вьюпорт, если у сфокусированного нативного
форм-контрола **computed font-size < 16px**. Правило: любой
фокусабельный текстовый контрол (`input`, `select`, `textarea`) на
мобильной ширине layout (mobile-брейкпоинт проекта; в u-kon ≤768)
имеет computed font-size **≥ 16px**. Кнопки зум не провоцируют;
кастомные контролы на div/contenteditable — тоже (но проверь, что
«кастомный select» не является нативным `<select>` со стилями).

## 2. Фикс-паттерн (одна точка на приложение)

Unlayered-правило в дизайн-системном CSS приложения
(`src/design-system/theme.css`), **вне** любых `@layer`-блоков и
**после** импортов Tailwind:

```css
/* iOS: фокус поля с font-size <16px автозумит вьюпорт (skill
   mobile-focus-zoom). Правило вне @layer — unlayered author CSS
   перебивает утилиты (text-sm и т.п.) без !important; только
   мобильная ширина — десктопная типографика полей не меняется. */
@media (max-width: 768px) {
  input,
  select,
  textarea {
    font-size: 16px;
  }
}
```

Почему так, а не иначе:

- **Не** `maximum-scale=1` / `user-scalable=no` в viewport-мете —
  режет pinch-zoom пользователям с плохим зрением (WCAG 1.4.4),
  «лекарство» от симптома, а не от причины.
- **Не** `!important` и не правки каждого поля: Tailwind v4 держит
  утилиты в `@layer utilities` — unlayered-правило выигрывает каскад
  у ЛЮБОГО класса (text-sm/text-[13px]/компонентного .topsearch из
  ui/styles.css) без борьбы специфичности. Один guard закрывает всё
  приложение, включая будущие экраны и модалки.
- **Внутрь `@layer base` класть нельзя** — проиграет утилитам
  (каскад слоёв, не специфичность).
- Ширина медиа = mobile-брейкпоинт проекта (769 — уже tablet: зум
  на iPad не проявляется, типографику не трогаем).
- 16px — порог iOS; не «примерно», не 15.5px (дробные px ниже
  порога зумят).

Единственный обход guard — inline `style="font-size:…"` на контроле
(grep `fontSize|font-size` по src — в норме только theme.css).

## 3. Аудит-протокол (dev-browser)

Desktop-Chromium зум не воспроизводит — проверяем причинное условие
(computed font-size), геометрию и визуальную регрессию:

1. По каждому маршруту с формами: `goto` → CDP
   `Emulation.setDeviceMetricsOverride {width:390,height:844,deviceScaleFactor:2,mobile:true}`
   → кадр → **assert `innerW === 390`** (override слетает после
   навигаций — применять на каждый маршрут заново; `mobile:false`
   игнорируется — не использовать).
2. `evaluate` (plain JS): собрать видимые контролы:
   ```js
   [...document.querySelectorAll("input,select,textarea")]
     .filter((el) => getComputedStyle(el).visibility !== "hidden" &&
                    el.getClientRects().length > 0)
     .map((el) => ({
       tag: el.tagName.toLowerCase(),
       type: el.type || "",
       name: el.getAttribute("data-name") || el.autocomplete ||
             el.placeholder?.slice(0, 24) || el.name || "",
       font: getComputedStyle(el).fontSize,
     }))
   ```
   Вердикт: `min(px) >= 16` на каждом маршруте.
3. Поверхности за тогглами (редактор профиля, редактор карточки
   организации) и модалки — открывать DOM-кликами
   (`el.click()`: позиционные клики Playwright при CDP mobile-override
   дают офсет ~43px). Гейт-StateCard на маршруте — перелогиниться
   ролью с правом (создание ресурсов — партнёр и т.п.).
4. Визуальная регрессия: 16px крупнее привычных 13–14px дизайна —
   скрин ключевых экранов (auth, визарды, композитор) на 390 после
   guard; смотреть, что текст не ломает узкие контейнеры
   (гриды-половины полей, шторки, модалки).
5. Финальное доказательство — реальный iOS-девайс: тап по каждому
   типу поля (текст/пароль/select/textarea) — вьюпорт не
   масштабируется ни в Safari, ни в standalone PWA.

## 4. Грабли

- Guard вне `@layer` — иначе тихо проигрывает `text-sm`.
- Зум проявляется и в установленной standalone-PWA (тот же WebKit) —
  фикс общий.
- В модалках/шторках контролы тоже под guard (правило глобальное),
  но аудит их не видит на статичных маршрутах — открывать DOM-кликами.
- CDP не эмулирует ни focus-zoom, ни display-mode standalone —
  девайс-прогон вручную.

## 5. Эталон прогона

u-kon (github.com/Termin89/u-kon), 2026-10-04: guard в
`src/design-system/theme.css` (после `@layer components`), аудит на
dev-сервере — 21 маршрут (гость: login/register; админ: feed+editor+
admin, messenger+чат, requests+wizard+admin, partners+wizard+admin,
resources+create под партнёром, events/about/tariffs/settings/
support) + редактор профиля за тогглом «Редактировать» — все видимые
контролы computed ≥16px, инлайн-размеров в src нет; скрины wizard/
profile/resource — без разъезда. QA-строка — docs/modules/cross-qa.md
(X-58).
