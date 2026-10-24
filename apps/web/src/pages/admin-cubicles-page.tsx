import React from 'react';
import { Badge, Card, Heading, Text } from '@radix-ui/themes';
import { GridIcon } from '@radix-ui/react-icons';
import { AppMain } from '../app/app-main';
import { PageHeader } from '../app/page-header';

export const AdminCubiclesPage: React.FC = () => {
  return (
    <AppMain
      header={
        <PageHeader
          code="SCR-ADM-002"
          section="Administración"
          title="Cubículos"
          description="Consulta y administra la disponibilidad de los cubículos."
        />
      }
    >
      <Card size="2" className="app-empty-panel">
        <div className="app-empty-panel-icon" aria-hidden="true">
          <GridIcon width={22} height={22} />
        </div>
        <Badge size="1" variant="soft" color="gray" radius="full">
          Módulo administrativo
        </Badge>
        <Heading as="h2" size="4" weight="bold" className="app-empty-panel-title">
          Administración de cubículos
        </Heading>
        <Text as="p" size="2" className="app-empty-panel-copy">
          El acceso por rol ya está disponible. La gestión operativa de cubículos
          se incorporará en una entrega posterior, sin alterar los flujos actuales
          de Recepción, Mi cubículo ni la pantalla pública.
        </Text>
      </Card>
    </AppMain>
  );
};
