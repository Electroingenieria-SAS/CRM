export const financialDecisionLabels = {
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  ON_HOLD: 'Retenido',
  REQUIRES_REVIEW: 'Requiere revisión',
  RELEASED: 'Liberado',
} as const;

export function explainAvailableCredit(reason: string) {
  if (reason === 'NO_AUDITED_REUSABLE_CREDIT_LIMIT') {
    return 'No existe una fuente auditada de cupo reutilizable. El sistema no inventa crédito disponible.';
  }
  return 'El cupo disponible no está definido para esta operación.';
}
