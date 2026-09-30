/**
 * configureStorage — идентичность хранилища приложения.
 *
 * Один раз на старте (module scope App или main.tsx, до первого обращения
 * сервисов к storage) вызывается `configureStorage({ project: "u-kon" })`.
 * Проект задаёт пространство имён: ключи localStorage `<project>:<service>:
 * <collection>` и база IndexedDB `shell-kit-media:<project>`.
 *
 * Паттерн повторяет configureQuery: module-private синглтон + предупреждение
 * при замене в рантайме. Если конфигурации не было — первое обращение к
 * storage кидает внятную ошибку (storage не угадывает проект сам).
 */

export interface StorageConfig {
  /** Идентификатор проекта: префикс ключей LS и имя media-базы. */
  readonly project: string;
}

let _config: StorageConfig | undefined;
let _isConfigured = false;

/** Установить конфиг хранилища. Вызывается один раз при старте приложения. */
export function configureStorage(config: StorageConfig): void {
  if (_isConfigured) {
    console.warn(
      "[storage] конфигурация заменена в рантайме — уже прочитанные " +
        "сервисами сторы держат старое пространство имён",
    );
  }
  _isConfigured = true;
  _config = config;
}

/** Текущий конфиг. Кидает ошибку, если configureStorage не вызван. */
export function getStorageConfig(): StorageConfig {
  if (!_config) {
    throw new Error(
      "[storage] хранилище не сконфигурировано: вызовите " +
        'configureStorage({ project: "…" }) на старте приложения',
    );
  }
  return _config;
}
