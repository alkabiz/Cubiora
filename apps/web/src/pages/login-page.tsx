import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Heading, Text, TextField, Button, Flex, Box, Badge } from '@radix-ui/themes';

const loginSchema = z.object({
  username: z.string().trim().min(3, 'El usuario es obligatorio (mínimo 3 caracteres)'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
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

  const onSubmit = (_data: LoginFormData) => {
    // Scaffold PMV: flujo de login a conectar con backend en siguiente fase
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

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Flex direction="column" gap="4">
            <Box>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5 text-[var(--gray-12)]">
                Usuario
              </label>
              <TextField.Root
                id="username"
                placeholder="recepcion / cajero1"
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
              Ingresar al Sistema
            </Button>
          </Flex>
        </form>
      </Card>
    </Box>
  );
};
