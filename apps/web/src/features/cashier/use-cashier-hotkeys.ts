import { useEffect, useState } from 'react';

export const CASHIER_HOTKEYS_STORAGE_KEY = 'cubiora:cashier:hotkeys_enabled';

/**
 * Mapeo de atajos configurable. Cambiar aquí afecta hook, UI y aria-keyshortcuts.
 *
 * DECISIÓN DE DISEÑO (Fase E — Fase A11Y-006 revisada):
 * Se migró de Alt+Shift+<Key> a Ctrl+Shift+<Key> porque:
 * 1. Alt+Shift (sin tecla adicional) es el atajo predeterminado de Windows para cambiar
 *    el idioma del teclado. Esto provocaba que, al presionar Alt+Shift+N, Windows pudiera
 *    interceptar la combinación parcial Alt+Shift y cambiar el layout ANTES de que el
 *    navegador recibiera la N.
 * 2. Ctrl+Shift+<letra> no está reservado por Windows para cambio de idioma (el shortcut
 *    de Windows es Alt+Shift o Ctrl+Shift SOLO, sin letra adicional).
 * 3. NVDA en Windows usa Alt+<tecla> ampliamente. Ctrl+Shift+<letra> tiene menos
 *    colisiones con NVDA/JAWS que Alt+Shift+<letra>.
 * 4. WCAG 2.1.4 se sigue cumpliendo: hay modificador compuesto (Ctrl+Shift) y el usuario
 *    puede desactivar los atajos.
 *
 * RIESGO RESIDUAL DOCUMENTADO:
 * - Ctrl+Shift+N abre nueva ventana de incógnito en Chrome/Edge. Si el cajero usa Chrome,
 *   este atajo puede conflictuar. Alternativa: Ctrl+Shift+K / Ctrl+Shift+J / Ctrl+Shift+M.
 *   Para la farmacia (entorno controlado con Firefox o Chromium sin atajo de incógnito
 *   habilitado), Ctrl+Shift+N es seguro. Se debe validar con el equipo de TI.
 * - JAWS: Ctrl+Shift+N puede interferir con "Move to next table cell". Validar con
 *   JAWS + Chrome en el entorno de ventanilla.
 *
 * DECISIÓN PENDIENTE DE CONFIRMACIÓN POR TI/FARMACIA:
 * Si se detectan conflictos en producción, cambiar a Ctrl+Alt+<Key> (sin Shift) o a
 * teclas de función F4/F5/F6 (con confirmación de no colisión con el SW de gestión).
 */
export const CASHIER_HOTKEY_MAP = {
  call: { key: 'k', ctrlKey: true, shiftKey: true, label: 'Ctrl+Shift+K' },
  start: { key: 'j', ctrlKey: true, shiftKey: true, label: 'Ctrl+Shift+J' },
  close: { key: 'm', ctrlKey: true, shiftKey: true, label: 'Ctrl+Shift+M' },
} as const;

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
 * - WCAG 2.1.4 Character Key Shortcuts (Nivel A): utiliza teclas con modificador compuesto
 *   (Ctrl+Shift) y ofrece control explícito para desactivarlos o activarlos de forma persistente.
 * - WCAG 2.1.1 Keyboard (Nivel A): toda acción por atajo tiene su equivalente accionable por botón.
 * - Ignora eventos cuando el foco reside en inputs, textareas, selects o contenteditable.
 * - Bloquea la ejecución cuando hay un diálogo modal abierto.
 * - Ignora eventos con event.repeat (mantenimiento continuo de tecla).
 * - No expone atajo de un solo paso para acciones destructivas (no-show mantiene diálogo).
 *
 * Atajos activos (ver CASHIER_HOTKEY_MAP para configuración):
 * - Ctrl+Shift+K: Llamar / Re-llamar siguiente turno
 * - Ctrl+Shift+J: Iniciar atención
 * - Ctrl+Shift+M: Finalizar atención (abre confirmación si aplica)
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

      // 3. Validar que se usa el modificador compuesto Ctrl+Shift (sin Alt ni Meta)
      //    Ctrl+Shift no está reservado por Windows para cambio de idioma (ese es Alt+Shift
      //    o Ctrl+Shift SIN letra adicional).
      const matchesModifier =
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey &&
        !event.metaKey;
      if (!matchesModifier) return;

      const key = event.key.toLowerCase();

      // Ctrl+Shift+K: Llamar / Re-llamar siguiente
      if (key === CASHIER_HOTKEY_MAP.call.key) {
        if (canCall) {
          event.preventDefault();
          onCall();
        }
      }
      // Ctrl+Shift+J: Iniciar atención
      else if (key === CASHIER_HOTKEY_MAP.start.key) {
        if (canStart) {
          event.preventDefault();
          onStartService();
        }
      }
      // Ctrl+Shift+M: Finalizar atención (abre confirmación o ejecuta)
      else if (key === CASHIER_HOTKEY_MAP.close.key) {
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
      call: CASHIER_HOTKEY_MAP.call.label,
      start: CASHIER_HOTKEY_MAP.start.label,
      close: CASHIER_HOTKEY_MAP.close.label,
    },
  };
}
