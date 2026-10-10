import { Suspense } from "react";
import type { ComponentType, ReactNode } from "react";
import { ModuleRenderer, ShellGate, ShellProvider } from "../react";
import { RouterProvider } from "../router";
import { AppContext } from "./context";
import type { AppHandle } from "./types";
import type { AppState } from "../core";

/**
 * createAppRoot — корневой компонент приложения. Порядок фиксирован
 * (app-слой — единственный владелец композиции, приложения порядок
 * не копируют):
 *
 *   AppContext → ShellProvider → toast-слот → dev-тулы →
 *   RouterProvider → ShellGate (splash / auth-экран) → layout-слот
 *   (не задан — голый ModuleRenderer).
 *
 * Toast и dev-тулы — вне RouterProvider и ShellGate: тосты видны и
 * на auth-экране, тулы работают до логина (переключение сессии —
 * главный dev-кейс). Auth-экран — ленивый чанк в Suspense со
 * сплэшем; onSuccess декларации выполняется до retryBootstrap
 * (replace гейт-адреса — до перезапуска, чтобы back не возвращал
 * на /login).
 */

export function createAppRoot<S extends AppState = AppState, M = unknown>(
  handle: AppHandle<S, M>,
): ComponentType {
  const { definition, shell, port } = handle;
  const slots = definition.slots;
  const auth = definition.auth;
  const dev = definition.dev;
  const Tools = dev?.enabled === true ? dev.tools : undefined;

  function Root(): ReactNode {
    return (
      <AppContext.Provider value={handle as unknown as AppHandle}>
        <ShellProvider shell={shell}>
          {slots?.toast}
          {Tools !== undefined && (
            <Suspense fallback={null}>
              <Tools />
            </Suspense>
          )}
          <RouterProvider port={port}>
            <ShellGate
              fallback={auth?.splash}
              unauthenticated={
                auth === undefined
                  ? undefined
                  : (retry) => (
                      <Suspense fallback={auth.splash}>
                        <auth.screen
                          onSuccess={() => {
                            auth.onSuccess?.(handle);
                            retry();
                          }}
                        />
                      </Suspense>
                    )
              }
            >
              {slots?.layout ?? <ModuleRenderer />}
            </ShellGate>
          </RouterProvider>
        </ShellProvider>
      </AppContext.Provider>
    );
  }

  return Root;
}
