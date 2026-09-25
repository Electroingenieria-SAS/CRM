import type { ReconstructionStatus } from '../domain/reconstruction-status';

export function getReconstructionStatus(): ReconstructionStatus {
  return {
    baselineCommit: '4bdceeaa54847581f83e9425aa0310aae8b0547d',
    sourceVersion: '11.43.0',
    targetVersion: '0.1.0',
    environment: 'staging',
    gates: [
      {
        id: 'architecture',
        label: 'Arquitectura modular',
        state: 'validated',
        detail: 'Next.js + TypeScript con fronteras de módulo y controles de complejidad.',
      },
      {
        id: 'security',
        label: 'Seguridad productiva',
        state: 'in-progress',
        detail: 'El staging no consume datos productivos mientras permanezcan P0 abiertos.',
      },
      {
        id: 'parity',
        label: 'Paridad funcional',
        state: 'pending',
        detail: 'La migración funcional se realizará dominio por dominio.',
      },
      {
        id: 'production',
        label: 'Promoción a producción',
        state: 'blocked',
        detail: 'Bloqueada hasta validar auth, RBAC, RPC/RLS, E2E autenticado y rollback.',
      },
    ],
  };
}
