import { describe, expect, it } from 'vitest';
import {
  normalizeFreightCity,
  normalizeFreightDepartment,
  normalizeFreightToken,
} from '@/modules/freight/domain/location-normalizer';

describe('freight location normalization', () => {
  it('normalizes accents, case and whitespace', () => {
    expect(normalizeFreightToken('  Quindío  ')).toBe('QUINDIO');
  });

  it('treats Armenia variants as one city', () => {
    expect(normalizeFreightCity('Armenia')).toBe('ARMENIA');
    expect(normalizeFreightCity('ARMENIA')).toBe('ARMENIA');
    expect(normalizeFreightCity('Armenia, Quindío')).toBe('ARMENIA');
    expect(normalizeFreightCity('Armenia Q.')).toBe('ARMENIA');
  });

  it('normalizes known department aliases', () => {
    expect(normalizeFreightDepartment('Valle')).toBe('VALLE DEL CAUCA');
    expect(normalizeFreightDepartment('La Guajira')).toBe('GUAJIRA');
  });
});
