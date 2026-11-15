import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const RUTA = process.env.DB_RUTA || 'conocimiento.db';

export const OFICIALES = new Set(['NASA', 'NOAA', 'USGS', 'ESA', 'PDS']);

export const LIMITES: Record<string, [number, number]> = {
  temperatura: [0, 1000],
  presion: [0, 1e7],
  viento: [0, 150],
  luz: [0, 1500],
};

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(RUTA);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  return dbInstance;
}

export function iniciar(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS registros(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      x TEXT NOT NULL,
      y TEXT NOT NULL,
      origen TEXT NOT NULL CHECK(origen IN('editor','autonomo')),
      fuente TEXT NOT NULL,
      url TEXT DEFAULT '',
      confianza REAL DEFAULT 0.5,
      estado TEXT DEFAULT 'pendiente' CHECK(estado IN('pendiente','aprobado','rechazado')),
      fecha REAL NOT NULL,
      hash TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entrenamientos(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha REAL NOT NULL,
      tipo TEXT NOT NULL,
      n_editor INT NOT NULL,
      n_autonomo INT NOT NULL,
      perdida REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lista_blanca(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dominio TEXT UNIQUE NOT NULL,
      etiqueta TEXT NOT NULL,
      categoria TEXT NOT NULL,
      activo INT NOT NULL DEFAULT 1,
      auto_entrenar INT NOT NULL DEFAULT 1,
      creado_en REAL NOT NULL
    );
  `);
}

function sortKeys(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(sortKeys);
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(val as Record<string, unknown>).sort()) {
      out[k] = sortKeys((val as Record<string, unknown>)[k]);
    }
    return out;
  }
  return val;
}

export function validar(tipo: string, y: Record<string, unknown>): void {
  for (const [k, raw] of Object.entries(y)) {
    const v = Number(raw);
    const [lo, hi] = LIMITES[k] ?? [0, 100];
    if (!Number.isFinite(v) || v < lo || v > hi) {
      throw new Error(
        `Valor fuera de rango físico en '${tipo}': ${k}=${String(raw)} (permitido [${lo}, ${hi}])`
      );
    }
  }
}

export interface RegistroRow {
  id: number;
  tipo: 'clima' | 'similitud';
  x: string;
  y: string;
  origen: 'editor' | 'autonomo';
  fuente: string;
  url: string;
  confianza: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha: number;
  hash: string;
}

export interface EntrenamientoRow {
  id: number;
  fecha: number;
  tipo: 'clima' | 'similitud';
  n_editor: number;
  n_autonomo: number;
  perdida: number;
}

export function guardar(
  tipo: 'clima' | 'similitud',
  x: Record<string, unknown>,
  y: Record<string, unknown>,
  origen: 'editor' | 'autonomo',
  fuente: string,
  url: string = '',
  confianza: number = 0.5,
  forzarAprobado: boolean = false
): 'aprobado' | 'pendiente' | 'duplicado' {
  validar(tipo, y);
  const estado =
    forzarAprobado || origen === 'editor' || OFICIALES.has(fuente)
      ? 'aprobado'
      : 'pendiente';
  const payload = JSON.stringify(sortKeys([tipo, x, y, fuente]));
  const hash = crypto.createHash('sha1').update(payload).digest('hex');

  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO registros(tipo, x, y, origen, fuente, url, confianza, estado, fecha, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      tipo,
      JSON.stringify(x),
      JSON.stringify(y),
      origen,
      fuente,
      url,
      confianza,
      estado,
      Date.now() / 1000,
      hash
    );
    return estado;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return 'duplicado';
    }
    throw err;
  }
}

export function filas(
  tipo?: 'clima' | 'similitud',
  estado?: 'pendiente' | 'aprobado' | 'rechazado'
): RegistroRow[] {
  const db = getDb();
  const clauses: string[] = ['1=1'];
  const params: Array<string> = [];
  if (tipo) {
    clauses.push('tipo = ?');
    params.push(tipo);
  }
  if (estado) {
    clauses.push('estado = ?');
    params.push(estado);
  }
  const sql = `SELECT * FROM registros WHERE ${clauses.join(' AND ')} ORDER BY id ASC`;
  return db.prepare(sql).all(...params) as unknown as RegistroRow[];
}

export function cambiarEstado(
  id: number,
  estado: 'aprobado' | 'rechazado' | 'pendiente'
): void {
  const db = getDb();
  db.prepare('UPDATE registros SET estado = ? WHERE id = ?').run(estado, id);
}

export function conteos() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tipo, origen, estado, COUNT(*) as c FROM registros GROUP BY tipo, origen, estado`
    )
    .all() as Array<{
    tipo: 'clima' | 'similitud';
    origen: 'editor' | 'autonomo';
    estado: 'pendiente' | 'aprobado' | 'rechazado';
    c: number;
  }>;

  let total = 0;
  let aprobados = 0;
  let pendientes = 0;
  let rechazados = 0;
  const porTipo = {
    clima: { editor: 0, autonomo: 0, pendientes: 0 },
    similitud: { editor: 0, autonomo: 0, pendientes: 0 },
  };

  for (const r of rows) {
    const n = Number(r.c);
    total += n;
    if (r.estado === 'aprobado') aprobados += n;
    else if (r.estado === 'pendiente') pendientes += n;
    else if (r.estado === 'rechazado') rechazados += n;

    const slot = porTipo[r.tipo];
    if (slot) {
      if (r.estado === 'pendiente') slot.pendientes += n;
      if (r.origen === 'editor' && r.estado === 'aprobado') slot.editor += n;
      if (r.origen === 'autonomo' && r.estado === 'aprobado') slot.autonomo += n;
    }
  }

  return { total, aprobados, pendientes, rechazados, porTipo };
}

export function logEntrenamiento(
  tipo: 'clima' | 'similitud',
  nEd: number,
  nAu: number,
  perdida: number
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO entrenamientos(fecha, tipo, n_editor, n_autonomo, perdida)
     VALUES (?, ?, ?, ?, ?)`
  ).run(Date.now() / 1000, tipo, nEd, nAu, perdida);
}

export function historial(n: number = 15): EntrenamientoRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM entrenamientos ORDER BY id DESC LIMIT ?')
    .all(n) as unknown as EntrenamientoRow[];
}
