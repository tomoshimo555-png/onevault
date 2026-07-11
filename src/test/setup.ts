import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
Object.defineProperty(globalThis, "matchMedia", {
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  configurable: true,
});

Object.defineProperty(Range.prototype, "getClientRects", {
  value: () => ({ length: 0, item: () => null, [Symbol.iterator]: function* iterator() {} }),
  configurable: true,
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  value: () => ({
    x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
    toJSON: () => ({}),
  }),
  configurable: true,
});
