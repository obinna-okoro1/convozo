import { vi } from 'vitest';

export type Spy<T extends (...args: never[]) => unknown> = ReturnType<typeof vi.fn> & T;

export type SpyObj<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result ? ReturnType<typeof vi.fn<(...args: Args) => Result>> : T[K];
};

export function createSpyObj<T>(methods: readonly (keyof T)[]): SpyObj<T>;
export function createSpyObj<T>(methods: Partial<Record<keyof T, unknown>>): SpyObj<T>;
export function createSpyObj<T>(methods: readonly (keyof T)[] | Partial<Record<keyof T, unknown>>): SpyObj<T> {
  const entries = Array.isArray(methods)
    ? methods.map(method => [method, vi.fn()])
    : Object.entries(methods).map(([method, value]) => [method, vi.fn().mockReturnValue(value)]);

  return Object.fromEntries(entries) as SpyObj<T>;
}
