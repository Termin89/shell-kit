/**
 * Слой ui — универсальная UI-библиотека shell-kit (переиспользуемая
 * часть исполнителя, ТЗ U-kon §52–54).
 *
 * lib — cx; icon — фабрика createIcon; primitives — примитивы на
 * структурных классах components.css. Слой не знает Tailwind: проект
 * импортирует src/ui/components.css в свой theme.css и объявляет
 * токены (--color-*, --radius-*), на которые опираются классы.
 */
export * from "./lib";
export * from "./icon";
export * from "./primitives";
