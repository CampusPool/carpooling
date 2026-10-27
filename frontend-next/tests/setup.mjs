import "@testing-library/jest-dom/vitest";

globalThis.crypto ??= {};
globalThis.crypto.randomUUID ??= () => "test-idempotency-key";
Object.defineProperty(window, "scrollTo", { value: () => {}, configurable: true });
