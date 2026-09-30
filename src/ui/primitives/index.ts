/**
 * Примитивы UI — концепция из gemba-walks-demo, поднята в ядро.
 *
 * Каждый примитив — папка <name>/ (компонент + barrel). Структурный
 * стиль (`.btn`, `.card`, …) — в src/ui/components.css (@layer
 * components); варианты/состояния — типизированные JS-карты внутри
 * компонентов; внешний className добавляется последним через cx().
 * Токены (цвета, радиусы) классам даёт проект в своём theme.css.
 */
export * from "./badge";
export * from "./button";
export * from "./card";
export * from "./chip";
export * from "./iconbtn";
export * from "./navlist";
export * from "./navitem";
export * from "./searchbar";
