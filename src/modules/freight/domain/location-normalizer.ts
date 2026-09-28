const CITY_ALIASES: Readonly<Record<string, string>> = {
  'BOGOTA D C': 'BOGOTA',
  'BOGOTA DC': 'BOGOTA',
  'BOGOTA DISTRITO CAPITAL': 'BOGOTA',
  'SANTA FE DE BOGOTA': 'BOGOTA',
  'SANTAFE DE BOGOTA': 'BOGOTA',
  'GUADALAJARA DE BUGA': 'BUGA',
  'SANTA CRUZ DE LORICA': 'LORICA',
  'SANTIAGO DE CALI': 'CALI',
  'SAN JOSE DE CUCUTA': 'CUCUTA',
  'ARMENIA Q': 'ARMENIA',
  'ARMENIA QUINDIO': 'ARMENIA',
};

const DEPARTMENT_ALIASES: Readonly<Record<string, string>> = {
  VALLE: 'VALLE DEL CAUCA',
  'BOGOTA D C': 'BOGOTA DC',
  'D C': 'BOGOTA DC',
  'DISTRITO CAPITAL': 'BOGOTA DC',
  'BOGOTA DISTRITO CAPITAL': 'BOGOTA DC',
  'LA GUAJIRA': 'GUAJIRA',
};

export function normalizeFreightToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeFreightCity(value: string): string {
  const cityPart = value.split(',', 1)[0] ?? '';
  const normalized = normalizeFreightToken(cityPart);

  if (
    normalized.startsWith('SAN VICENTE DEL CHUCU') ||
    normalized.startsWith('SAN VICENTE DE CHUCURI')
  ) {
    return 'SAN VICENTE DE CHUCURI';
  }

  return CITY_ALIASES[normalized] ?? normalized;
}

export function normalizeFreightDepartment(value: string): string {
  const normalized = normalizeFreightToken(value);
  return DEPARTMENT_ALIASES[normalized] ?? normalized;
}
