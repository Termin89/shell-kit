import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import path from "path";
import fs from "node:fs";
import dts from "vite-plugin-dts";
const __dirname = import.meta.dirname

// Слои ядра — по входу на слой. Ключи = путь выходного чанка
// (preserveModules): dist повторяет структуру src, потребители
// импортируют shell-kit/<layer>.
const layerEntries = {
  index: path.resolve(__dirname, "src/index.ts"),
  "core/index": path.resolve(__dirname, "src/core/index.ts"),
  "devtools/index": path.resolve(__dirname, "src/devtools/index.ts"),
  "errors/index": path.resolve(__dirname, "src/errors/index.ts"),
  "module/index": path.resolve(__dirname, "src/module/index.ts"),
  "queries/index": path.resolve(__dirname, "src/queries/index.ts"),
  "react/index": path.resolve(__dirname, "src/react/index.ts"),
  "router/index": path.resolve(__dirname, "src/router/index.ts"),
  "service/index": path.resolve(__dirname, "src/service/index.ts"),
  "storage/index": path.resolve(__dirname, "src/storage/index.ts"),
  "transport/index": path.resolve(__dirname, "src/transport/index.ts"),
  "ui/index": path.resolve(__dirname, "src/ui/index.ts"),
};

const libConfig = {
  lib: {
    entry: layerEntries,
    // as const — иначе string[] не сужается до LibraryFormats[]
    formats: ["es" as const],
  },
  rollupOptions: {
    // Ядро — модульная сборка: каждый файл src остаётся своим модулем
    // в dist, межслойные импорты — относительными путями. Реакт —
    // внешний (peerDependency).
    external: ["react", "react-dom", "react/jsx-runtime"],
    output: {
      preserveModules: true,
      preserveModulesRoot: "src",
      entryFileNames: "[name].js",
    },
  },
  sourcemap: true,
  outDir: "dist",
};

// Solid-сборка пишет ТОЛЬКО dist/solid: preserveModules тащит в граф
// общие framework-free модули (router/queries/errors/storage), но их
// уже излучила react-сборка. Состав графов у проходов разный, тришейкин
// дал бы другие байты и перезаписал бы react-вывод — чужие чанки
// выбрасываем до записи. Импорты из dist/solid/*.js
// («../router/port.js») указывают на файлы react-прохода.
function keepSolidChunksOnly(): Plugin {
  return {
    name: "keep-solid-chunks-only",
    generateBundle(_, bundle) {
      for (const file of Object.keys(bundle)) {
        if (!file.startsWith("solid/")) {
          delete bundle[file];
        }
      }
    },
  };
}

// Вторая lib-сборка — Solid-адаптер (src/solid). Собирается ПОСЛЕ
// react-сборки: та чистит dist и излучает общие framework-free слои,
// эта дописывает только dist/solid поверх (emptyOutDir: false).
const libSolidConfig = {
  lib: {
    entry: { "solid/index": path.resolve(__dirname, "src/solid/index.ts") },
    formats: ["es" as const],
  },
  rollupOptions: {
    // solid-js и @solidjs/web — внешние (optional peerDependencies)
    external: ["solid-js", "@solidjs/web"],
    plugins: [keepSolidChunksOnly()],
    output: {
      preserveModules: true,
      // «src», не «src/solid»: чанки solid-слоя получают имена
      // «solid/...» и ложатся в dist/solid
      preserveModulesRoot: "src",
      entryFileNames: "[name].js",
    },
  },
  sourcemap: true,
  outDir: "dist",
  emptyOutDir: false,
};

// Копия CSS-слоя в dist: экспорт shell-kit/ui/styles.css указывает
// на dist/ui/components.css, исходник живёт рядом с компонентами ядра
function copyComponentsCss(): Plugin {
  return {
    name: "copy-components-css",
    closeBundle() {
      fs.mkdirSync(path.resolve(__dirname, "dist/ui"), { recursive: true });
      fs.copyFileSync(
        path.resolve(__dirname, "src/ui/components.css"),
        path.resolve(__dirname, "dist/ui/components.css"),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const isLib = mode === "lib"; // сборка npm-пакета ядра (react)
  const isLibSolid = mode === "lib-solid"; // сборка npm-пакета (solid)
  const isDemoSolid = mode === "demo-solid"; // демо на Solid-адаптере
  const isLibMode = isLib || isLibSolid;
  // JSX-трансформы не пересекаются: react-режимы — plugin-react,
  // solid-режимы — plugin-solid (два несовместимых компилятора JSX)
  const isSolidMode = isLibSolid || isDemoSolid;

  return {
    // Dev/preview/build демо — от src/demo (или src/demo-solid),
    // сборка библиотеки — от корня
    root: isLibMode
      ? __dirname
      : path.resolve(__dirname, isDemoSolid ? "src/demo-solid" : "src/demo"),
    // Публичные ассеты (favicon и т.п.) — только для демо-режимов,
    // в npm-пакет они не идут
    publicDir: isLibMode ? false : "public",
    plugins: isSolidMode
      ? [
          solid(),
          // Типы solid-слоя генерирует lib-solid-сборка; демо-сборке
          // они не нужны
          ...(isLibSolid
            ? [
                dts({
                  include: ["src/solid/**/*"],
                  tsconfigPath: "./tsconfig.solid.json",
                  outDirs: ["dist"],
                  // «src», не «src/solid»: entryRoot — база, от которой
                  // отсчитывается путь декларации, при «src/solid»
                  // файлы ложатся в корень dist
                  entryRoot: "src",
                }),
              ]
            : []),
        ]
      : [
          react(),
          // Типы пакета генерируются lib-сборкой (tsc-эмит и dts-плагин
          // используют tsconfig.lib.json); демо-сборке они не нужны
          ...(isLib
            ? [
                dts({
                  include: ["src/**/*"],
                  exclude: ["src/demo/**", "src/demo-solid/**", "src/solid/**"],
                  tsconfigPath: "./tsconfig.lib.json",
                  outDirs: ["dist"],
                  entryRoot: "src",
                }),
                copyComponentsCss(),
              ]
            : []),
        ],
    resolve: {
      alias: [
        // Догфудинг публичного API: демо (и dev-режим ядра) импортируют
        // пакет по имени без сборки — резолв в исходники src
        {
          find: /^shell-kit\/ui\/styles\.css$/,
          replacement: path.resolve(__dirname, "./src/ui/components.css"),
        },
        {
          find: "shell-kit",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
    },
    build: isLib
      ? libConfig
      : isLibSolid
        ? libSolidConfig
        : {
            outDir: path.resolve(
              __dirname,
              isDemoSolid ? "demo/dist-solid" : "demo/dist",
            ),
            sourcemap: true,
          },
    server: {
      port: isDemoSolid ? 3001 : 3000,
    },
  };
});
