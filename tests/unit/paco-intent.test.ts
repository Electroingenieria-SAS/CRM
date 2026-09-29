import { describe, expect, it } from 'vitest';
import {
  classifyPacoIntent,
  extractOrderReference,
  normalizeSpanish,
} from '@/modules/assistant/domain/spanish-intent';

describe('PACO Spanish intent classifier', () => {
  it('normalizes accents and noisy punctuation', () => {
    expect(normalizeSpanish('  ¿QUIÉN está Ocupado?  ')).toBe('quien esta ocupado');
  });

  it.each([
    ['necesito rejistrar una actividad', 'CREATE_ACTIVITY'],
    ['quien esta disponivle ahora', 'OCCUPANCY'],
    ['dame el rezumen de hoy', 'SUMMARY'],
    ['muestreme los pedidos demorados', 'QUEUE'],
    ['cancelar conslta', 'CANCEL'],
  ])('tolerates common misspellings: %s', (message, expected) => {
    expect(classifyPacoIntent(message).intent).toBe(expected);
  });

  it('extracts an order reference without parsing business logic', () => {
    expect(extractOrderReference('como va el pedido PVN-1048 por favor')).toBe('PVN-1048');
    expect(classifyPacoIntent('estado pedido PVN-1048').intent).toBe('ORDER_LOOKUP');
  });

  it('maps navigation phrases to existing modules', () => {
    expect(classifyPacoIntent('abre inventario').modulePath).toBe('/inventory');
    expect(classifyPacoIntent('ir a reportes').modulePath).toBe('/analytics/reports');
  });

  it('returns unknown for unrelated text instead of guessing', () => {
    expect(classifyPacoIntent('mañana llevo café').intent).toBe('UNKNOWN');
  });
});
