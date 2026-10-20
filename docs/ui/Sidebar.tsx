import React from 'react';
import { usePharmacy, ScreenView } from '../context/PharmacyContext';
import {
  UserCheck,
  LayoutGrid,
  BarChart3,
  Tv,
  Settings2,
  History,
  Clock,
  Users,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, metrics, cubicles } = usePharmacy();

  const menuItems: { id: ScreenView; label: string; icon: React.ReactNode; code: string }[] = [
    {
      id: 'reception',
      label: 'Recepción de Turnos',
      code: 'SCR-REC-001',
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      id: 'cubicle',
      label: 'Cubículo de Atención',
      code: 'SCR-CAJ-001',
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      id: 'admin',
      label: 'Métricas y Cola General',
      code: 'SCR-ADM-001',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'public',
      label: 'Monitor de Sala',
      code: 'SCR-PUB-001',
      icon: <Tv className="w-4 h-4" />,
    },
    {
      id: 'cubicles_config',
      label: 'Gestión de Cubículos',
      code: 'SCR-ADM-002',
      icon: <Settings2 className="w-4 h-4" />,
    },
    {
      id: 'history',
      label: 'Historial y Auditoría',
      code: 'SCR-ADM-003',
      icon: <History className="w-4 h-4" />,
    },
  ];

  const activeCubiclesCount = cubicles.filter(
    (c) => c.status === 'busy' || c.status === 'calling' || c.status === 'exceeded'
  ).length;

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#ffffff] border-r border-[#E2E8F0] z-40 flex flex-col justify-between p-4 hidden md:flex">
      <div className="flex flex-col gap-4">
        <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
          Consola Operativa
        </div>

        <nav className="flex flex-col gap-1" aria-label="Menú de consola">
          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-[#e5eeff] text-[#001428] font-bold shadow-xs'
                    : 'text-[#475569] hover:bg-[#f8f9ff] hover:text-[#0b1c30]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`${isActive ? 'text-[#006591]' : 'text-[#64748B]'}`}>
                    {item.icon}
                  </span>
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006591]"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Operational summary pill cards */}
      <div className="flex flex-col gap-2">
        <div className="p-3 bg-[#eff4ff] border border-[#E2E8F0] rounded-lg flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#475569] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#006591]" />
              Turnos en gestión
            </span>
            <span className="font-mono text-xs text-[#001428] font-bold tabular-nums">
              {metrics.waitingCount + activeCubiclesCount}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-[#475569] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#006591]" />
              Espera promedio
            </span>
            <span className="font-mono text-xs text-[#006591] font-bold tabular-nums">
              4m 12s
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#dce9ff]">
            <span className="text-[11px] text-[#64748B] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#10B981]" />
              Cumplimiento SLA
            </span>
            <span className="font-mono text-[11px] text-[#065F46] font-semibold tabular-nums">
              {metrics.slaCompliancePct}%
            </span>
          </div>
        </div>

        <div className="text-[11px] text-[#64748B] text-center px-1">
          Hospital Central · Farmacia v2.4
        </div>
      </div>
    </aside>
  );
};
