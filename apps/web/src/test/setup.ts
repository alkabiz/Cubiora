class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverMock;

if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView =
    window.HTMLElement.prototype.scrollIntoView || function () {};
  window.HTMLElement.prototype.hasPointerCapture =
    window.HTMLElement.prototype.hasPointerCapture || function () {
      return false;
    };
  window.HTMLElement.prototype.setPointerCapture =
    window.HTMLElement.prototype.setPointerCapture || function () {};
  window.HTMLElement.prototype.releasePointerCapture =
    window.HTMLElement.prototype.releasePointerCapture || function () {};
}
