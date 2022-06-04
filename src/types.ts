export type Factory<T, A = any> = A extends Array<any> ? (...args:A) => T : () => T;

export type Tests = Array<string | [string] | [string, string | string[]]>;
export type TestInputs = Tests | Factory<Tests>;
