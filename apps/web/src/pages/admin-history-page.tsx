import React from 'react';
import { Badge, Card, Heading, Text } from '@radix-ui/themes';
import { ClockIcon } from '@radix-ui/react-icons';
import { AppMain } from '../app/app-main';
import { PageHeader } from '../app/page-header';

export const AdminHistoryPage: React.FC = () => {
  return (
    <AppMain
      header={
        <PageHeader
          code="SCR-ADM-003"
          section="Auditoría básica"
          title="Historial de turnos"
          description="Consulta las transiciones básicas de los turnos finalizados."
        />
      }
    >
      <Card size="2" className="app-empty-panel">
        <div className="app-empty-panel-icon" aria-hidden="true">
          <ClockIcon width={22} height={22} />
        </div>
        <Badge size="1" variant="soft" color="gray" radius="full">
          Módulo administrativo
        </Badge>
        <Heading as="h2" size="4" weight="bold" className="app-empty-panel-title">
          Historial de turnos
        </Heading>
        <Text as="p" size="2" className="app-empty-panel-copy">
          El acceso por rol ya está disponible. La consulta y auditoría del
          historial se incorporará en una entrega posterior, sin modificar los
          contratos ni la persistencia actual.
        </Text>
      </Card>
    </AppMain>
  );
};
