export type PacoIntent =
  | 'ORDER_LOOKUP'
  | 'QUEUE'
  | 'CREATE_ACTIVITY'
  | 'OCCUPANCY'
  | 'SUMMARY'
  | 'OPEN_MODULE'
  | 'CANCEL'
  | 'HELP'
  | 'UNKNOWN';

export interface IntentMatch {
  intent: PacoIntent;
  confidence: number;
  reference?: string;
  modulePath?: string;
}

const examples: Record<Exclude<PacoIntent, 'UNKNOWN'>, string[]> = {
  ORDER_LOOKUP: [
    'consultar pedido',
    'buscar pedido',
    'estado del pedido',
    'como va el pedido',
    'donde va el pedido',
  ],
  QUEUE: ['ver cola', 'pedidos en cola', 'que hay en cola', 'pedidos demorados', 'cola de pedidos'],
  CREATE_ACTIVITY: [
    'registrar actividad',
    'crear actividad',
    'agregar actividad',
    'programar actividad',
    'anotar actividad',
  ],
  OCCUPANCY: [
    'ver ocupacion',
    'quien esta disponible',
    'personas disponibles',
    'quien esta ocupado',
    'estado del equipo',
  ],
  SUMMARY: [
    'resumen ahora',
    'dame un resumen',
    'resumen operativo',
    'que esta pasando',
    'pendientes criticos',
  ],
  OPEN_MODULE: ['abrir modulo', 'ir a pedidos', 'ir a inventario', 'abrir jornada', 'abrir reportes'],
  CANCEL: ['cancelar consulta', 'cancelar', 'salir de consulta', 'olvida esto', 'empezar de nuevo'],
  HELP: ['ayuda', 'que puedes hacer', 'opciones', 'como me ayudas', 'comandos'],
};

const moduleRoutes = [
  { tokens: ['pedido', 'pedidos', 'venta', 'ventas'], path: '/orders' },
  { tokens: ['jornada', 'workforce', 'actividad', 'actividades'], path: '/workforce' },
  { tokens: ['inventario', 'stock'], path: '/inventory' },
  { tokens: ['panel', 'dashboard', 'indicadores'], path: '/analytics' },
  { tokens: ['reporte', 'reportes'], path: '/analytics/reports' },
  { tokens: ['vsm', 'tiempos'], path: '/analytics/vsm' },
  { tokens: ['auditoria', 'auditar'], path: '/audit' },
  { tokens: ['administracion', 'usuarios', 'permisos'], path: '/admin' },
] as const;

export function normalizeSpanish(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distance(left: string, right: string) {
  const a = left.slice(0, 32);
  const b = right.slice(0, 32);
  const rows = Array.from({ length: a.length + 1 }, (_, index) => index);

  for (let column = 1; column <= b.length; column += 1) {
    let previous = rows[0] ?? 0;
    rows[0] = column;
    for (let row = 1; row <= a.length; row += 1) {
      const old = rows[row] ?? 0;
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      rows[row] = Math.min(
        (rows[row] ?? 0) + 1,
        (rows[row - 1] ?? 0) + 1,
        previous + cost,
      );
      previous = old;
    }
  }
  return rows[a.length] ?? b.length;
}

function similarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) return 1;
  return 1 - distance(left, right) / Math.max(left.length, right.length, 1);
}

function tokenScore(input: string, example: string) {
  const inputTokens = normalizeSpanish(input).split(' ').filter(Boolean);
  const exampleTokens = normalizeSpanish(example).split(' ').filter(Boolean);
  if (!inputTokens.length || !exampleTokens.length) return 0;

  const matched = exampleTokens.reduce((sum, expected) => {
    const best = Math.max(...inputTokens.map((token) => similarity(token, expected)));
    return sum + (best >= 0.68 ? best : 0);
  }, 0);

  return matched / exampleTokens.length;
}

export function extractOrderReference(message: string) {
  const tokens = message
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean);
  return tokens.find((token) => /\d/.test(token) && token.length >= 3);
}

function routeFor(message: string) {
  const normalized = normalizeSpanish(message);
  return moduleRoutes.find((module) =>
    module.tokens.some((token) => normalized.split(' ').some((word) => similarity(word, token) >= 0.75)),
  )?.path;
}

export function classifyPacoIntent(message: string): IntentMatch {
  const normalized = normalizeSpanish(message);
  if (!normalized) return { intent: 'UNKNOWN', confidence: 0 };

  let best: IntentMatch = { intent: 'UNKNOWN', confidence: 0 };
  for (const [intent, phrases] of Object.entries(examples) as Array<
    [Exclude<PacoIntent, 'UNKNOWN'>, string[]]
  >) {
    const confidence = Math.max(...phrases.map((phrase) => tokenScore(normalized, phrase)));
    if (confidence > best.confidence) best = { intent, confidence };
  }

  const reference = extractOrderReference(message);
  if (reference && /pedido|orden|pedi|ordn/.test(normalized)) {
    best = { intent: 'ORDER_LOOKUP', confidence: Math.max(best.confidence, 0.9), reference };
  }

  const modulePath = routeFor(message);
  if (modulePath && /(abr|ir|modul|lleva|naveg)/.test(normalized)) {
    best = { intent: 'OPEN_MODULE', confidence: Math.max(best.confidence, 0.85), modulePath };
  }

  if (best.confidence < 0.46) return { intent: 'UNKNOWN', confidence: best.confidence, reference };
  return { ...best, reference: best.reference ?? reference, modulePath: best.modulePath ?? modulePath };
}
