import { defineModule } from "shell-kit/module";
import CatalogPage from "./CatalogPage";
import { useCatalogProps } from "./controller";

/**
 * Модуль A · Каталог — собран по контракту ShellModule:
 * CatalogPage — чистая вьюха, useCatalogProps — контроллер.
 * Рендерер получает view, чистая вьюха остаётся в component
 * для частичного использования.
 */
const catalogModule = defineModule({
  page: {
    component: CatalogPage,
    controller: useCatalogProps,
  },
});

export default catalogModule;
