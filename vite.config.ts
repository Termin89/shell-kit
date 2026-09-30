import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
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
  const isLib = mode === "lib"; // сборка npm-пакета ядра

  return {
    // Dev/preview/build демо — от src/demo, сборка библиотеки — от корня
    root: isLib ? __dirname : path.resolve(__dirname, "src/demo"),
    // Публичные ассеты (favicon и т.п.) — только для демо-режима,
    // в npm-пакет они не идут
    publicDir: isLib ? false : "public",
    plugins: [
      react(),
      // Типы пакета генерируются lib-сборкой (tsc-эмит и dts-плагин
      // используют tsconfig.lib.json); демо-сборке они не нужны
      ...(isLib
        ? [
            dts({
              include: ["src/**/*"],
              exclude: ["src/demo/**"],
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
    build: isLib ? libConfig : {
      outDir: path.resolve(__dirname, "demo/dist"),
      sourcemap: true,
    },
    server: {
      port: 3000,
    },
  };
});
