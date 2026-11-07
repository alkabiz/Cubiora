import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCashierHotkeys, CASHIER_HOTKEYS_STORAGE_KEY } from './use-cashier-hotkeys';

describe('useCashierHotkeys', () => {
  let onCall: () => void;
  let onStartService: () => void;
  let onCloseTurn: () => void;

  beforeEach(() => {
    onCall = vi.fn();
    onStartService = vi.fn();
    onCloseTurn = vi.fn();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispara onCall con Alt+Shift+N o Alt+N cuando canCall es true', () => {
    renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: true,
        canStart: false,
        canClose: false,
      }),
    );

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('dispara onStartService con Alt+Shift+A cuando canStart es true', () => {
    renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: false,
        canStart: true,
        canClose: false,
      }),
    );

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(onStartService).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('dispara onCloseTurn con Alt+Shift+F cuando canClose es true', () => {
    renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: false,
        canStart: false,
        canClose: true,
      }),
    );

    const event = new KeyboardEvent('keydown', {
      key: 'f',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(onCloseTurn).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('no ejecuta acciones si el estado correspondiente está deshabilitado', () => {
    renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: false,
        canStart: false,
        canClose: false,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', altKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', altKey: true, bubbles: true }));

    expect(onCall).not.toHaveBeenCalled();
    expect(onStartService).not.toHaveBeenCalled();
    expect(onCloseTurn).not.toHaveBeenCalled();
  });

  it('ignora eventos con repeat activo para evitar disparos múltiples', () => {
    renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: true,
        canStart: true,
        canClose: true,
      }),
    );

    const repeatEvent = new KeyboardEvent('keydown', {
      key: 'n',
      altKey: true,
      repeat: true,
      bubbles: true,
    });
    window.dispatchEvent(repeatEvent);

    expect(onCall).not.toHaveBeenCalled();
  });

  it('bloquea la ejecución cuando el foco está en un input o textarea', () => {
    renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: true,
        canStart: true,
        canClose: true,
      }),
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      altKey: true,
      bubbles: true,
    });
    input.dispatchEvent(event);

    expect(onCall).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('bloquea la ejecución si isModalOpen es true', () => {
    renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: true,
        canStart: true,
        canClose: true,
        isModalOpen: true,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true, bubbles: true }));
    expect(onCall).not.toHaveBeenCalled();
  });

  it('permite desactivar los atajos y persiste en localStorage (WCAG 2.1.4)', () => {
    const { result } = renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: true,
        canStart: true,
        canClose: true,
      }),
    );

    expect(result.current.hotkeysEnabled).toBe(true);

    act(() => {
      result.current.toggleHotkeys();
    });

    expect(result.current.hotkeysEnabled).toBe(false);
    expect(localStorage.getItem(CASHIER_HOTKEYS_STORAGE_KEY)).toBe('false');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true, bubbles: true }));
    expect(onCall).not.toHaveBeenCalled();
  });

  it('limpia el listener de eventos al desmontarse el hook', () => {
    const { unmount } = renderHook(() =>
      useCashierHotkeys({
        onCall,
        onStartService,
        onCloseTurn,
        canCall: true,
        canStart: true,
        canClose: true,
      }),
    );

    unmount();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true, bubbles: true }));
    expect(onCall).not.toHaveBeenCalled();
  });
});
