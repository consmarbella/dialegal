// Contexto de request: forzar carga del corpus completo (data/corpus-full)
// en casos pagados aunque CORPUS_COMPLETO no esté en true a nivel de env.
import { AsyncLocalStorage } from "async_hooks";

const als = new AsyncLocalStorage<{ force: boolean }>();

export function corpusForzadoActivo(): boolean {
  return !!als.getStore()?.force;
}

/** Ejecuta fn con corpus completo forzado (casos premium / pagados). */
export function runWithCorpusForzado<T>(fn: () => T): T {
  return als.run({ force: true }, fn);
}

export function runWithCorpusForzadoAsync<T>(fn: () => Promise<T>): Promise<T> {
  return als.run({ force: true }, fn);
}
