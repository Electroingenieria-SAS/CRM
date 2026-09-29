export interface InventoryBalanceLike {
  readonly onHand: number;
  readonly reserved: number;
  readonly committed: number;
}

export function inventoryAvailable(balance: InventoryBalanceLike): number {
  const available = balance.onHand - balance.reserved - balance.committed;
  if (balance.onHand < 0 || balance.reserved < 0 || balance.committed < 0 || available < 0) {
    throw new Error('El saldo de inventario es inconsistente.');
  }
  return available;
}

export function assertPositiveInventoryQuantity(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.');
  }
  return quantity;
}

export function assertInventoryAdjustment(delta: number, reason: string) {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('El ajuste debe modificar la existencia.');
  }
  if (!reason.trim()) throw new Error('El ajuste requiere un motivo.');
}

export function normalizeInventoryUnit(unit: string): string {
  const normalized = unit.trim().toUpperCase();
  if (!normalized) throw new Error('La unidad es obligatoria.');
  return normalized;
}
