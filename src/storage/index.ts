/**
 * storage — локальная персистентность сервисов: данные (localStorage),
 * медиа (IndexedDB), программный сброс.
 */

export { configureStorage, getStorageConfig } from "./configure";
export type { StorageConfig } from "./configure";

export { dataCollection, clearServiceData } from "./data";
export type { DataCollection } from "./data";

export {
  putMedia,
  getMedia,
  deleteMedia,
  seedMedia,
  resolveMediaUrl,
  peekMediaUrl,
  clearMediaByPrefix,
  dropMediaDb,
  listMediaProjects,
} from "./media";
export type { MediaRef, MediaRecord, MediaSeedEntry } from "./media";

export { clearStorage } from "./clear";
export type { ClearStorageOptions } from "./clear";

export { PersistentMock } from "./persistent";
export type { PersistentMockOptions, MockList } from "./persistent";
