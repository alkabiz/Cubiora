import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

interface TicketFormData {
  patientName: string;
  patientDocument: string;
}

export const ReceptionPage: React.FC = () => {
  const [lastCreatedTicket, setLastCreatedTicket] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TicketFormData>();

  const onSubmit = (_data: TicketFormData) => {
    // Scaffold PMV: simulación de creación de turno
    const generatedTicket = `T-${Math.floor(100 + Math.random() * 900)}`;
    setLastCreatedTicket(generatedTicket);
    reset();
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Registro de Turno Presencial
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          Ingrese los datos del usuario para asignar un turno en la cola de entrega de medicamentos.
        </p>

        {lastCreatedTicket && (
          <div
            className="card"
            style={{
              marginBottom: '2rem',
              background: 'rgba(13, 148, 136, 0.15)',
              borderColor: 'var(--accent-teal)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
              Turno Generado Exitosamente
            </span>
            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: '#fff',
                marginTop: '0.25rem',
              }}
            >
              {lastCreatedTicket}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label className="form-label" htmlFor="patientName">
              Nombre Completo del Paciente
            </label>
            <input
              id="patientName"
              className="form-input"
              placeholder="Ej. María Pérez"
              {...register('patientName', { required: 'El nombre es obligatorio' })}
            />
            {errors.patientName && (
              <span style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>
                {errors.patientName.message}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="patientDocument">
              Documento de Identidad
            </label>
            <input
              id="patientDocument"
              className="form-input"
              placeholder="Ej. 1020304050"
              {...register('patientDocument', { required: 'El documento es obligatorio' })}
            />
            {errors.patientDocument && (
              <span style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>
                {errors.patientDocument.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            id="btn-generar-turno"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', padding: '0.9rem' }}
          >
            Generar Turno
          </button>
        </form>
      </div>
    </div>
  );
};
