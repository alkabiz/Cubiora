import React from 'react';
import { useForm } from 'react-hook-form';

interface LoginFormData {
  username: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = (_data: LoginFormData) => {
    // Intento de login local (lógica de auth pendiente en siguiente fase)
  };

  return (
    <div style={{ maxWidth: '440px', margin: '4rem auto 0 auto' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 1rem auto',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-cyan))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: '1.5rem',
            }}
          >
            C
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Iniciar Sesión</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Acceso para personal de Recepción y Cubículos
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              className="form-input"
              placeholder="recepcion / cajero1"
              {...register('username', { required: 'El usuario es obligatorio' })}
            />
            {errors.username && (
              <span style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>
                {errors.username.message}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              {...register('password', { required: 'La contraseña es obligatoria' })}
            />
            {errors.password && (
              <span style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>
                {errors.password.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            id="btn-login-submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.5rem', padding: '0.85rem' }}
          >
            Ingresar al Sistema
          </button>
        </form>
      </div>
    </div>
  );
};
