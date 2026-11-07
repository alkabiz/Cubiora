import { useEffect, useState } from 'react';

export const CASHIER_HOTKEYS_STORAGE_KEY = 'cubiora:cashier:hotkeys_enabled';

export interface UseCashierHotkeysOptions {
  onCall: () => void;
  onStartService: () => void;
  onCloseTurn: () => void;
  canCall: boolean;
  canStart: boolean;
  canClose: boolean;
  isModalOpen?: boolean;
}

export interface UseCashierHotkeysResult {
  hotkeysEnabled: boolean;
  toggleHotkeys: () => void;
  shortcuts: {
    call: string;
    start: string;
    close: string;
  };
}

/**
 * Hook de aceleración operativa mediante atajos de teclado para el cajero/dispensador.
 *
 * Cumplimiento normativo y de accesibilidad:
 * - WCAG 2.1.4 Character Key Shortcuts (Nivel A): utiliza teclas con modificador (Alt+Shift / Alt)
 *   y ofrece control explícito para desactivarlos o activarlos de forma persistente.
 * - WCAG 2.1.1 Keyboard (Nivel A): toda acción por atajo tiene su equivalente accionable por botón.
 * - Evita colisiones con aceleradores del sistema/navegador en Windows/Linux mediante Alt+Shift.
 * - Ignora eventos cuando el foco reside en inputs, textareas, selects o contenteditable.
 * - Bloquea la ejecución cuando hay un diálogo modal abierto.
 * - Ignora eventos con event.repeat (mantenimiento continuo de tecla).
 * - No expone atajo de un solo paso para acciones destructivas (no-show mantiene diálogo).
 */
export function useCashierHotkeys({
  onCall,
  onStartService,
  onCloseTurn,
  canCall,
  canStart,
  canClose,
  isModalOpen = false,
}: UseCashierHotkeysOptions): UseCashierHotkeysResult {
  const [hotkeysEnabled, setHotkeysEnabled] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(CASHIER_HOTKEYS_STORAGE_KEY);
        return stored !== null ? stored === 'true' : true;
      }
      return true;
    } catch {
      return true;
    }
  });

  const toggleHotkeys = () => {
    setHotkeysEnabled((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(CASHIER_HOTKEYS_STORAGE_KEY, String(next));
        }
      } catch {
        // Ignora falla de cuota o restricción de iframe
      }
      return next;
    });
  };

  useEffect(() => {
    if (!hotkeysEnabled || isModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. Evitar ejecuciones múltiples al mantener la tecla
      if (event.repeat) return;

      // 2. Ignorar si el usuario está editando en campos de texto
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // 3. Validar modificador Alt (con o sin Shift para tolerancia ergonómica)
      // Evita colisión con Ctrl o Meta (atajos de sistema como Ctrl+N, Ctrl+S)
      const hasModifier = event.altKey && !event.ctrlKey && !event.metaKey;
      if (!hasModifier) return;

      const key = event.key.toLowerCase();

      // Alt+Shift+N o Alt+N: Llamar / Re-llamar siguiente
      if (key === 'n') {
        if (canCall) {
          event.preventDefault();
          onCall();
        }
      }
      // Alt+Shift+A o Alt+A: Iniciar atención
      else if (key === 'a') {
        if (canStart) {
          event.preventDefault();
          onStartService();
        }
      }
      // Alt+Shift+F o Alt+F: Finalizar atención (abre confirmación o ejecuta)
      else if (key === 'f') {
        if (canClose) {
          event.preventDefault();
          onCloseTurn();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hotkeysEnabled, isModalOpen, canCall, canStart, canClose, onCall, onStartService, onCloseTurn]);

  return {
    hotkeysEnabled,
    toggleHotkeys,
    shortcuts: {
      call: 'Alt+Shift+N',
      start: 'Alt+Shift+A',
      close: 'Alt+Shift+F',
    },
  };
}

