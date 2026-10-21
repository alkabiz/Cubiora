import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Card, Heading, Text, TextField, Button, Flex, Box, Badge, Callout } from '@radix-ui/themes';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useAuth } from '../context/auth-context';

const loginSchema = z.object({
  username: z.string().trim().min(3, 'El usuario es obligatorio (mínimo 3 caracteres)'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user) {
      if (user.role === 'CASHIER') {
        navigate('/cajero', { replace: true });
      } else {
        navigate('/recepcion', { replace: true });
      }
    }
  }, [user, navigate]);

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const loggedUser = await login(data.username, data.password);
      if (loggedUser.role === 'CASHIER') {
        navigate('/cajero', { replace: true });
      } else {
        navigate('/recepcion', { replace: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Credenciales inválidas o usuario inactivo';
      setServerError(message);
    }
  };

  return (
    <Box className="max-w-md mx-auto mt-8 sm:mt-12">
      <Card size="3" className="p-8">
        <Flex direction="column" align="center" className="mb-6 text-center">
          <Badge size="3" variant="solid" color="teal" className="w-12 h-12 flex items-center justify-center font-bold text-lg mb-3">
            C
          </Badge>
          <Heading size="5" weight="bold">
            Iniciar Sesión
          </Heading>
          <Text size="2" color="gray" className="mt-1">
            Acceso para personal de Recepción y Cubículos
          </Text>
        </Flex>

        {serverError && (
          <Callout.Root color="ruby" size="1" className="mb-4">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>{serverError}</Callout.Text>
          </Callout.Root>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Flex direction="column" gap="4">
            <Box>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5 text-[var(--gray-12)]">
                Usuario
              </label>
              <TextField.Root
                id="username"
                placeholder="receptor / cajero"
                size="3"
                {...register('username')}
                aria-invalid={!!errors.username}
              />
              {errors.username && (
                <Text size="1" color="ruby" className="mt-1 block">
                  {errors.username.message}
                </Text>
              )}
            </Box>

            <Box>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-[var(--gray-12)]">
                Contraseña
              </label>
              <TextField.Root
                id="password"
                type="password"
                placeholder="••••••••"
                size="3"
                {...register('password')}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <Text size="1" color="ruby" className="mt-1 block">
                  {errors.password.message}
                </Text>
              )}
            </Box>

            <Button
              type="submit"
              id="btn-login-submit"
              size="3"
              color="teal"
              variant="solid"
              disabled={isSubmitting}
              className="mt-2 w-full cursor-pointer"
            >
              {isSubmitting ? 'Ingresando…' : 'Ingresar al Sistema'}
            </Button>
          </Flex>
        </form>
      </Card>
    </Box>
  );
};
