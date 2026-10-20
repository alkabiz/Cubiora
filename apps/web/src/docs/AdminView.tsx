import React from 'react';
import { CmpAdm001 } from './CmpAdm001';

/**
 * SCR-ADM-001 View Wrapper delegating to reusable CMP-ADM-001
 */
export const AdminView: React.FC = () => {
  return <CmpAdm001 />;
};

export { CmpAdm001 };
