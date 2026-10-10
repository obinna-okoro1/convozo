import { type Mock, vi } from 'vitest';

export type Spy<T extends (...args: never[]) => unknown> = ReturnType<typeof vi.fn> & T;

export type SpyObj<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
    ? ReturnType<typeof vi.fn<(...args: Args) => Result>>
    : T[K];
};

type SpyStubs<T> = Partial<Record<keyof T, unknown>>;

function isMethodList<T>(methods: readonly (keyof T)[] | SpyStubs<T>): methods is readonly (keyof T)[] {
  return Array.isArray(methods);
}

export function createSpyObj<T>(methods: readonly (keyof T)[], properties?: SpyStubs<T>): SpyObj<T>;
export function createSpyObj<T>(methods: SpyStubs<T>): SpyObj<T>;
export function createSpyObj<T>(methods: readonly (keyof T)[] | SpyStubs<T>, properties: SpyStubs<T> = {}): SpyObj<T> {
  const entries: [PropertyKey, Mock][] = isMethodList(methods)
    ? methods.map(method => [method, vi.fn()])
    : Object.entries(methods)
      .map(([method, value]): [PropertyKey, Mock] => [method, vi.fn()
        .mockReturnValue(value)]);

  return { ...Object.fromEntries(entries), ...properties } as SpyObj<T>;
}
