/**
 * clearStorage — программный сброс локального хранилища.
 *
 * Гранулярность: сервис (`{ service }`, текущий проект), проект
 * (`{ project }`) или всё (`clearStorage()` — все LS-префиксы проектов,
 * у которых есть media-базы). Использование: сброс демо-состояния,
 * чистый прогон перед показом, гигиена при смене схемы.
 */

import { getStorageConfig } from "./configure";
import { clearServiceData } from "./data";
import {
  clearMediaByPrefix,
  dropMediaDb,
  listMediaProjects,
} from "./media";

export interface ClearStorageOptions {
  /** Проект. По умолчанию — текущий (configureStorage). */
  readonly project?: string;
  /** Сервис внутри проекта. Не задан — весь проект. */
  readonly service?: string;
}

export async function clearStorage(options: ClearStorageOptions = {}): Promise<void> {
  if (options.service !== undefined) {
    const project = options.project ?? getStorageConfig().project;
    clearServiceData(project, options.service);
    await clearMediaByPrefix(`${options.service}/`);
    return;
  }

  if (options.project !== undefined) {
    removePrefixedKeys(`${options.project}:`);
    await dropMediaDb(options.project);
    return;
  }

  // Всё: проекты определяем по их media-базам + текущий проект.
  const projects = new Set(await listMediaProjects());
  projects.add(getStorageConfig().project);
  for (const project of projects) {
    removePrefixedKeys(`${project}:`);
    await dropMediaDb(project);
  }
}

function removePrefixedKeys(prefix: string): void {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && key.startsWith(prefix)) {
      doomed.push(key);
    }
  }
  for (const key of doomed) {
    localStorage.removeItem(key);
  }
}
