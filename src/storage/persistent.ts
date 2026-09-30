/**
 * PersistentMock — база персистентной mock-стратегии.
 *
 * Что даёт: mock-данные переживают перезагрузку (localStorage), медиа —
 * сидируются из бандла в IndexedDB при первом старте, смена версии схемы
 * автоматически пересеивает сервис. Мутации write-through: put/remove
 * пишут в LS сразу — демо «создал заявку → F5 → заявка на месте».
 *
 * Как используется (эталон — feed в u-kon):
 *
 * ```ts
 * class FeedMockService extends PersistentMock implements FeedService {
 *   constructor() {
 *     super({
 *       service: "feed",
 *       schemaVersion: 1,
 *       collections: {
 *         cards: () => CARDS_SEED,
 *         posts: () => POSTS_SEED,
 *       },
 *       media: () => MEDIA_SEED, // [{ id: "feed/cover-…", url: BASE_URL + "…" }]
 *     });
 *   }
 *   async listCards() {
 *     return this.list<FeedCardData>("cards").all();
 *   }
 * }
 * ```
 *
 * Инварианты: класс — реализация стратегии для defineService (флаги моков
 * его не касаются); слои выше сервиса про PersistentMock не знают.
 */

import { getStorageConfig } from "./configure";
import { clearServiceData, dataCollection } from "./data";
import { clearMediaByPrefix, seedMedia, type MediaSeedEntry } from "./media";

const SEEDED_KEY = "__seeded";

export interface PersistentMockOptions {
  /** Id сервиса — тот же, что в defineService. */
  readonly service: string;
  /**
   * Версия схемы данных сервиса. Инкремент при изменении сидов/структуры —
   * старые данные сбросятся и пересеятся автоматически.
   */
  readonly schemaVersion: number;
  /** Сиды коллекций: имя → фабрика массива записей. */
  readonly collections?: Readonly<Record<string, () => readonly object[]>>;
  /** Сиды медиа: бандл-URL → IndexedDB (существующие id не перекачиваются). */
  readonly media?: () =>
    | readonly MediaSeedEntry[]
    | Promise<readonly MediaSeedEntry[]>;
}

export interface MockList<T extends { id: string }> {
  /** Все записи (в порядке записи). */
  all(): Promise<readonly T[]>;
  get(id: string): Promise<T | undefined>;
  /** Upsert: вставить/заменить по id и записать в LS. */
  put(item: T): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(items: readonly T[]): Promise<void>;
}

export class PersistentMock {
  readonly #service: string;
  readonly #schemaVersion: number;
  readonly #options: PersistentMockOptions;
  #readyPromise: Promise<void> | undefined;

  constructor(options: PersistentMockOptions) {
    this.#service = options.service;
    this.#schemaVersion = options.schemaVersion;
    this.#options = options;
  }

  /** Готовность данных: первый вызов проверяет версию и сеет при необходимости. */
  protected async ready(): Promise<void> {
    if (this.#readyPromise === undefined) {
      this.#readyPromise = this.#init();
    }
    return this.#readyPromise;
  }

  async #init(): Promise<void> {
    const { project } = getStorageConfig();
    // Первое открытие scope с новой версией уже сбросило данные (data.ts).
    // Явная проверка версии держит scope открытым и при смене конфига.
    const scope = `${project}:${this.#service}`;
    const seededMarker = `${scope}:${SEEDED_KEY}`;
    const seeded = localStorage.getItem(seededMarker);

    if (seeded !== String(this.#schemaVersion)) {
      if (seeded !== null) {
        // Версия сменилась между запусками: вычистить хвосты (в т.ч. медиа).
        clearServiceData(project, this.#service);
        await clearMediaByPrefix(`${this.#service}/`);
      }
      for (const [name, seed] of Object.entries(this.#options.collections ?? {})) {
        dataCollection<readonly object[]>(
          this.#service,
          name,
          this.#schemaVersion,
        ).write(seed());
      }
      const media = this.#options.media?.();
      if (media !== undefined) {
        await seedMedia(await media);
      }
      localStorage.setItem(seededMarker, String(this.#schemaVersion));
    }
  }

  /** Коллекция сервисного scope. Типизируется на call-site. */
  protected list<T extends { id: string }>(name: string): MockList<T> {
    const store = () =>
      dataCollection<readonly T[]>(this.#service, name, this.#schemaVersion);
    return {
      all: async () => {
        await this.ready();
        return store().read() ?? [];
      },
      get: async (id) => {
        await this.ready();
        return (store().read() ?? []).find((item) => item.id === id);
      },
      put: async (item) => {
        await this.ready();
        store().update((items) => {
          const rest = (items ?? []).filter((x) => x.id !== item.id);
          return [...rest, item];
        });
      },
      remove: async (id) => {
        await this.ready();
        store().update((items) =>
          (items ?? []).filter((x) => x.id !== id),
        );
      },
      replaceAll: async (items) => {
        await this.ready();
        store().write(items);
      },
    };
  }

  /** Полный сброс сервиса: LS + медиа, затем пересев сидов. */
  async reset(): Promise<void> {
    const { project } = getStorageConfig();
    clearServiceData(project, this.#service);
    await clearMediaByPrefix(`${this.#service}/`);
    this.#readyPromise = undefined;
    await this.ready();
  }
}
