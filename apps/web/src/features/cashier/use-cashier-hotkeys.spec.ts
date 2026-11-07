import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCashierHotkeys, CASHIER_HOTKEYS_STORAGE_KEY, CASHIER_HOTKEY_MAP } from './use-cashier-hotkeys';

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

  it('dispara onCall con Ctrl+Shift+K cuando canCall es true', () => {
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
      key: CASHIER_HOTKEY_MAP.call.key,
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('dispara onStartService con Ctrl+Shift+J cuando canStart es true', () => {
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
      key: CASHIER_HOTKEY_MAP.start.key,
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(onStartService).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('dispara onCloseTurn con Ctrl+Shift+M cuando canClose es true', () => {
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
      key: CASHIER_HOTKEY_MAP.close.key,
      ctrlKey: true,
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

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: CASHIER_HOTKEY_MAP.call.key,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: CASHIER_HOTKEY_MAP.start.key,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: CASHIER_HOTKEY_MAP.close.key,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );

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
      key: CASHIER_HOTKEY_MAP.call.key,
      ctrlKey: true,
      shiftKey: true,
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
      key: CASHIER_HOTKEY_MAP.call.key,
      ctrlKey: true,
      shiftKey: true,
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

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: CASHIER_HOTKEY_MAP.call.key,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(onCall).not.toHaveBeenCalled();
  });

  it('no dispara con modificador incorrecto (Alt en lugar de Ctrl) — evita conflicto de idioma', () => {
    // Verifica que el antiguo esquema Alt+Shift ya no se active
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

    // Alt+Shift+K — antes era el esquema anterior; ahora no debe disparar nada
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        altKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(onCall).not.toHaveBeenCalled();

    // Solo Ctrl sin Shift — no debe disparar
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: CASHIER_HOTKEY_MAP.call.key,
        ctrlKey: true,
        shiftKey: false,
        bubbles: true,
      }),
    );
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

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: CASHIER_HOTKEY_MAP.call.key,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
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

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: CASHIER_HOTKEY_MAP.call.key,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(onCall).not.toHaveBeenCalled();
  });

  it('expone las etiquetas correctas de los atajos desde CASHIER_HOTKEY_MAP', () => {
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

    expect(result.current.shortcuts.call).toBe(CASHIER_HOTKEY_MAP.call.label);
    expect(result.current.shortcuts.start).toBe(CASHIER_HOTKEY_MAP.start.label);
    expect(result.current.shortcuts.close).toBe(CASHIER_HOTKEY_MAP.close.label);
  });
});
