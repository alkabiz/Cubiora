import React, { useState, useRef, useEffect } from 'react';
import { Ticket, TicketState } from '../../types/queue';
import { playSuccessChime } from '../../utils/audio';

interface RecepcionScreenProps {
  tickets: Ticket[];
  onEmitTicket: (ticket: Ticket) => void;
  lastIssuedTicket: Ticket | null;
}

export const RecepcionScreen: React.FC<RecepcionScreenProps> = ({
  tickets,
  onEmitTicket,
  lastIssuedTicket,
}) => {
  const [patientName, setPatientName] = useState('');
  const [idDocument, setIdDocument] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showRecent, setShowRecent] = useState(() => {
    try {
      const saved = sessionStorage.getItem('cubiora_show_recent');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceDuplicateSubmit, setForceDuplicateSubmit] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus inicial en Nombre del paciente
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Guardar preferencia de visualización de últimos turnos durante la sesión
  const handleToggleRecent = () => {
    setShowRecent((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('cubiora_show_recent', String(next));
      } catch {
        // Ignorar si sessionStorage no está disponible
      }
      return next;
    });
  };

  // Validación: Nombre obligatorio válido
  const isNameValid = patientName.trim().length > 0;

  // Comprobación de posible duplicado únicamente cuando el documento haya sido diligenciado
  const cleanedDoc = idDocument.trim().replace(/\D/g, '');
  const duplicateTicket =
    cleanedDoc.length >= 4 && !forceDuplicateSubmit
      ? tickets.find(
          (t) =>
            t.idDocument &&
            t.idDocument.replace(/\D/g, '') === cleanedDoc
        )
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Impide doble envío o envío mediante Enter durante la generación
    if (!isNameValid || isSubmitting) {
      return;
    }

    if (duplicateTicket && !forceDuplicateSubmit) {
      return;
    }

    setIsSubmitting(true);

    // Simulación de confirmación del backend
    setTimeout(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      const suffix = Math.floor(Math.random() * 90 + 10);
      const code = `TUR-000${suffix}-A7`;

      // El backend determina automáticamente el estado del turno
      // Por regla de negocio del PMV: ASSIGNED cuando hay cubículo disponible
      const assignedCubicle = 'Cubículo 03';
      const determinedState: TicketState = 'ASSIGNED';

      const newTicket: Ticket = {
        id: `t-${Date.now()}`,
        code,
        category: 'general',
        categoryLabel: 'General',
        createdAt: now,
        patientName: patientName.trim(),
        idDocument: idDocument.trim() || undefined,
        timeStr,
        assignedCubicle,
        state: determinedState,
      };

      // Notificar nuevo turno confirmado
      onEmitTicket(newTicket);
      playSuccessChime();

      // Limpiar Nombre y Documento, reiniciar flags
      setPatientName('');
      setIdDocument('');
      setForceDuplicateSubmit(false);
      setIsSubmitting(false);

      // Llevar foco a Nombre del paciente para habilitar la creación inmediata del siguiente paciente
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }, 300);
  };

  const handleClearForm = () => {
    if (isSubmitting) return;
    setPatientName('');
    setIdDocument('');
    setForceDuplicateSubmit(false);
    nameInputRef.current?.focus();
  };

  // Manejo de copia accesible y con teclado
  const handleCopyCode = () => {
    if (!lastIssuedTicket) return;
    // Copiar únicamente el código
    navigator.clipboard?.writeText(lastIssuedTicket.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const hasFormData = patientName.length > 0 || idDocument.length > 0;

  // Estado del último turno visible
  const activeTicket = lastIssuedTicket;
  const activeState: TicketState = activeTicket?.state || 'ASSIGNED';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: Formulario Generar Turno (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <h1 className="text-xl font-bold text-[#001428] font-sans">
              Generar turno
            </h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Campo Nombre del paciente */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="nombrePacienteInput"
                  className="text-xs sm:text-sm font-semibold text-[#0b1c30]"
                >
                  Nombre del paciente <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  id="nombrePacienteInput"
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Ingrese nombre y apellido"
                  className="w-full h-11 px-3.5 bg-[#eff4ff] text-[#0b1c30] rounded-lg text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#006591] border border-transparent focus:border-[#006591] transition-all disabled:opacity-60"
                />
              </div>

              {/* Campo Documento: Etiqueta "Documento", Indicador "Opcional", Placeholder "Ej. 1023456789" */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="documentoInput"
                    className="text-xs sm:text-sm font-semibold text-[#0b1c30]"
                  >
                    Documento
                  </label>
                  <span className="text-xs text-slate-500 font-normal">
                    Opcional
                  </span>
                </div>
                <input
                  id="documentoInput"
                  type="text"
                  disabled={isSubmitting}
                  value={idDocument}
                  onChange={(e) => {
                    setIdDocument(e.target.value);
                    setForceDuplicateSubmit(false);
                  }}
                  placeholder="Ej. 1023456789"
                  className="w-full h-11 px-3.5 bg-[#eff4ff] text-[#0b1c30] rounded-lg text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#006591] border border-transparent focus:border-[#006591] transition-all disabled:opacity-60"
                />
              </div>

              {/* Advertencia contextual de posible duplicado */}
              {duplicateTicket && (
                <div
                  className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex flex-col gap-2"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">
                      warning
                    </span>
                    <div>
                      <span className="font-semibold">
                        Posible turno activo detectado:
                      </span>{' '}
                      El documento ingresado ya registra el turno{' '}
                      <strong className="font-mono">{duplicateTicket.code}</strong>.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForceDuplicateSubmit(true)}
                    className="self-start text-[11px] font-semibold text-amber-800 underline hover:text-amber-950 cursor-pointer"
                  >
                    Continuar y emitir turno de todos modos
                  </button>
                </div>
              )}

              {/* Acciones del formulario */}
              <div className="flex flex-col gap-2 pt-2">
                {/* Botón principal: Generar turno / Generando turno... */}
                <button
                  type="submit"
                  disabled={!isNameValid || isSubmitting}
                  className="w-full h-11 bg-[#001428] hover:bg-[#0f2942] text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>Generando turno…</span>
                    </>
                  ) : (
                    <span>Generar turno</span>
                  )}
                </button>

                {/* Acción terciaria Limpiar: Visible solo cuando existan datos */}
                {hasFormData && !isSubmitting && (
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-center"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* COLUMNA DERECHA: Resultado del Turno y Últimos turnos generados (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          {/* PANEL DE RESULTADO: "Último turno generado" */}
          <div
            role="status"
            aria-live="polite"
            className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4"
          >
            {activeTicket ? (
              <>
                {/* Encabezado fijo: "Último turno generado" */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-[#006591] uppercase tracking-wider">
                    Último turno generado
                  </span>

                  {/* Badge de estado */}
                  {activeState === 'PENDING' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      En espera
                    </span>
                  )}
                  {activeState === 'ASSIGNED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#c9e6ff] text-[#001e2f]">
                      Asignado
                    </span>
                  )}
                  {activeState === 'CALLED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      Llamado
                    </span>
                  )}
                </div>

                {/* Componente visual del código del turno */}
                <div className="bg-[#eff4ff] p-4 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      Número de turno
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-2xl sm:text-3xl text-[#001428] font-bold tracking-wide">
                        {activeTicket.code}
                      </span>
                      <div className="relative flex items-center">
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleCopyCode();
                            }
                          }}
                          aria-label="Copiar número de turno"
                          title="Copiar número de turno"
                          className="p-1.5 text-slate-500 hover:text-[#001428] rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#006591]"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {copiedCode ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Indicador de copiado visible */}
                  {copiedCode && (
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md animate-fadeIn">
                      Número de turno copiado
                    </span>
                  )}
                </div>

                {/* Contenido e instrucciones específicas por estado */}
                {activeState === 'PENDING' && (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 flex flex-col gap-1">
                    <div className="font-semibold text-slate-800">
                      No hay un cubículo disponible
                    </div>
                    <div className="text-slate-600">
                      Observe la pantalla de llamados
                    </div>
                  </div>
                )}

                {activeState === 'ASSIGNED' && (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 flex flex-col gap-1">
                    <div className="font-semibold text-slate-800">
                      Cubículo asignado
                    </div>
                    <div className="text-slate-600">
                      Observe la pantalla de llamados
                    </div>
                  </div>
                )}

                {activeState === 'CALLED' && (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 flex flex-col gap-1">
                    <div className="font-semibold text-[#001428]">
                      Diríjase al {activeTicket.assignedCubicle || 'Cubículo 03'}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Estado inicial antes de generar un turno en la sesión */
              <>
                <div className="pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-[#006591] uppercase tracking-wider">
                    Último turno generado
                  </span>
                </div>
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                  <span className="material-symbols-outlined text-3xl text-slate-300">
                    confirmation_number
                  </span>
                  <p className="text-xs text-slate-600">
                    Aún no has generado ningún turno en esta sesión.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ÚLTIMOS TURNOS GENERADOS (Máximo 3 registros, simplificado) */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Últimos turnos generados
              </h2>
              {/* Acción Ocultar / Mostrar últimos turnos con persistencia de sesión */}
              <button
                type="button"
                onClick={handleToggleRecent}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {showRecent ? 'Ocultar' : 'Mostrar últimos turnos'}
              </button>
            </div>

            {showRecent && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 px-2 font-medium">Turno</th>
                      <th className="py-2 px-2 font-medium">Hora</th>
                      <th className="py-2 px-2 font-medium">Cubículo</th>
                      <th className="py-2 px-2 font-medium text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.slice(0, 3).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-2 font-mono font-bold text-[#001428]">
                          {t.code}
                        </td>
                        <td className="py-2 px-2 text-slate-600 font-mono">
                          {t.timeStr}
                        </td>
                        <td className="py-2 px-2 text-slate-700">
                          {t.assignedCubicle || '--'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              t.state === 'PENDING'
                                ? 'bg-slate-100 text-slate-600'
                                : t.state === 'CALLED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-[#c9e6ff] text-[#001e2f]'
                            }`}
                          >
                            {t.state === 'PENDING'
                              ? 'En espera'
                              : t.state === 'CALLED'
                              ? 'Llamado'
                              : 'Asignado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
