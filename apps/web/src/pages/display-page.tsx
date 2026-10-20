import React, { useState } from 'react';
import { PublicCall } from '@cubiora/shared';
import { Badge, Flex, Box, Text } from '@radix-ui/themes';

const INITIAL_CALLS: PublicCall[] = [
  {
    publicCode: 'TUR-000123-A7',
    cubicleDisplayName: 'Cubículo 03',
    calledAt: new Date().toISOString(),
    callNumber: 1,
  },
  {
    publicCode: 'TUR-000120-B2',
    cubicleDisplayName: 'Cubículo 02',
    calledAt: new Date(Date.now() - 1000 * 120).toISOString(),
    callNumber: 2,
  },
  {
    publicCode: 'TUR-000118-C1',
    cubicleDisplayName: 'Cubículo 01',
    calledAt: new Date(Date.now() - 1000 * 240).toISOString(),
    callNumber: 1,
  },
  {
    publicCode: 'TUR-000115-D4',
    cubicleDisplayName: 'Cubículo 04',
    calledAt: new Date(Date.now() - 1000 * 360).toISOString(),
    callNumber: 1,
  },
];

export const DisplayPage: React.FC = () => {
  const [calls] = useState<PublicCall[]>(INITIAL_CALLS);
  const [isConnected] = useState(true);

  const currentCall = calls[0];
  const recentCalls = calls.slice(1, 5);

  return (
    <Box
      className="min-h-screen flex flex-col bg-[#001428] text-white"
      style={{
        margin: 0,
        padding: 0,
        backgroundColor: '#001428',
        color: '#ffffff',
      }}
    >
      {/* ─── Encabezado institucional de la Pantalla Pública ────────────── */}
      <header
        className="px-6 py-4 flex items-center justify-between border-b border-slate-800"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        <Flex align="center" gap="3">
          <Badge
            size="2"
            variant="solid"
            color="teal"
            className="w-9 h-9 flex items-center justify-center font-bold text-base"
          >
            C
          </Badge>
          <Text size="5" weight="bold" className="tracking-wide">
            Cubiora
          </Text>
          <Text size="3" className="text-slate-400 font-medium">
            Turnos
          </Text>
        </Flex>

        {/* Estado de conexión discreto */}
        <Flex align="center" gap="2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            }`}
          />
          <Text size="1" className="text-slate-400 font-medium tracking-wider uppercase">
            {isConnected ? 'En línea' : 'Sin conexión'}
          </Text>
        </Flex>
      </header>

      {/* ─── Contenido Principal: Pantalla de Gran Formato ──────────────── */}
      <main className="flex-1 p-6 md:p-10 flex flex-col lg:flex-row gap-8 items-stretch">
        {/* Columna Izquierda / Panel Principal: Turno en llamado (flex-2) */}
        <Box
          className="flex-1 lg:flex-[2] flex flex-col justify-center items-center text-center p-8 md:p-12 rounded-2xl bg-[#001e38] border-2 border-teal-500/40 shadow-2xl"
          style={{
            background: '#001e38',
            borderRadius: '1.25rem',
            border: '2px solid rgba(20, 184, 166, 0.4)',
          }}
        >
          <Text
            size="3"
            weight="medium"
            className="text-teal-400 uppercase tracking-widest block mb-4"
          >
            Turno llamado
          </Text>

          <Text
            weight="bold"
            className="font-mono block text-white"
            style={{
              fontSize: 'clamp(3rem, 8vw, 6.5rem)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {currentCall?.publicCode || '---'}
          </Text>

          <Text
            size="4"
            className="text-slate-400 block mt-6 mb-2 font-medium"
          >
            Diríjase al
          </Text>

          <Text
            weight="bold"
            className="text-teal-300 block"
            style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              lineHeight: 1.1,
            }}
          >
            {currentCall?.cubicleDisplayName || 'Cubículo'}
          </Text>
        </Box>

        {/* Columna Derecha: Llamados recientes (flex-1) */}
        <Box
          className="flex-1 lg:flex-[1] flex flex-col p-6 rounded-2xl bg-[#001a30] border border-slate-800"
          style={{
            background: '#001a30',
            borderRadius: '1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Text
            size="2"
            weight="bold"
            className="text-slate-400 uppercase tracking-wider block mb-4 pb-2 border-b border-slate-800"
          >
            Llamados recientes
          </Text>

          <Flex direction="column" gap="3" className="flex-1 justify-around">
            {recentCalls.map((item, index) => (
              <Box
                key={item.publicCode + index}
                className="p-4 rounded-xl bg-[#002240] border border-slate-800/80 flex items-center justify-between gap-4"
                style={{
                  background: '#002240',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {/* Código de turno en monoespacio */}
                <Text
                  size="5"
                  weight="bold"
                  className="font-mono text-white tracking-wide"
                >
                  {item.publicCode}
                </Text>

                {/* Cubículo separado visualmente con badge */}
                <Badge size="2" variant="solid" color="teal">
                  {item.cubicleDisplayName}
                </Badge>
              </Box>
            ))}
          </Flex>
        </Box>
      </main>
    </Box>
  );
};
