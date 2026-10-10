import type { ComponentType, ReactNode } from "react";
import type { StatesDeclaration } from "./types";

/**
 * states/registry — реестр деклараций состояний: офлайн-каталог для
 * dev-тулы без живой машины. Заполняется на загрузке чанка модуля
 * (createStatesPage регистрирует декларацию по moduleId; standalone-
 * машины вроде auth — явным вызовом из dev-файла проекта). Живые
 * машины — отдельный реестр (machine.ts, по devId): он видит только
 * смонтированные экраны, этот — всё, что когда-либо грузилось.
 *
 * Без dev-гейта (паттерн _registerService из service-слоя): цена
 * прод-сборки — Map-запись на уже живые объекты декларации, данных
 * и кода в прод не прибавляется. Потребитель — devtools
 * (StatesCatalog: каталог + офлайн-превью).
 */

/** Запись реестра: декларация с типами, стёртыми под каталог тулы. */
export interface RegisteredStatesDeclaration {
  /** id модуля (или явное имя standalone-регистрации). */
  readonly id: string;
  /** Декларация, type-erased: каталогу тулы генерики не нужны. */
  readonly declaration: StatesDeclaration<string, string, string>;
  /**
   * Обёртка контекста экрана для офлайн-превью: тонкий компонент
   * вокруг вьюхи (пример: vm-контроллер auth-экрана). Не задана —
   * превью рендерит вьюхи состояний как есть.
   */
  readonly preview?: ComponentType<{ readonly children: ReactNode }>;
}

/** Опции регистрации: превью-обёртка контекста экрана. */
export interface RegisterStatesOptions {
  readonly preview?: ComponentType<{ readonly children: ReactNode }>;
}

/** Реестр деклараций. Module-private — чтение через геттер ниже. */
const declarations = new Map<string, RegisteredStatesDeclaration>();

/**
 * Зарегистрировать декларацию состояний. Дедуп/замена по id
 * (HMR-перерегистрация — последний побеждает, как у сервисов).
 * Вызывается createStatesPage при загрузке чанка модуля и явно из
 * dev-файлов проекта для standalone-машин.
 */
export function registerStatesDeclaration<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
>(
  id: string,
  declaration: StatesDeclaration<Id, Role, Signal>,
  options: RegisterStatesOptions = {},
): void {
  declarations.set(id, {
    id,
    declaration: declaration as unknown as StatesDeclaration<string, string, string>,
    ...(options.preview !== undefined ? { preview: options.preview } : {}),
  });
}

/**
 * Снимок реестра деклараций (порядок регистрации — порядок загрузки
 * чанков). Источник офлайн-каталога состояний dev-тулы.
 */
export function getRegisteredStateDeclarations(): readonly RegisteredStatesDeclaration[] {
  return [...declarations.values()];
}
