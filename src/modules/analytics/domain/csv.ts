function pushField(row: string[], field: string) {
  row.push(field);
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      pushField(row, field);
      field = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      pushField(row, field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }

  if (quoted) throw new Error('El CSV contiene una comilla sin cerrar.');
  pushField(row, field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('El CSV debe incluir encabezados y al menos una fila.');

  const headers = rows[0].map((value) => value.trim());
  if (headers.some((header) => !header)) throw new Error('El CSV contiene encabezados vacíos.');
  if (new Set(headers).size !== headers.length) throw new Error('El CSV contiene encabezados duplicados.');

  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])),
  );
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export function recordsToCsv(
  columns: readonly { key: string; label: string }[],
  rows: readonly Record<string, unknown>[],
): string {
  const header = columns.map((column) => csvCell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(','));
  return [header, ...body].join('\r\n');
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
