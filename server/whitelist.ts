import { getDb, iniciar } from './db.ts';

export type WhitelistCategory =
  | 'NASA'
  | 'PDS'
  | 'ESA'
  | 'USGS'
  | 'NOAA'
  | 'Oficial';

export interface WhitelistDomainRow {
  id: number;
  dominio: string;
  etiqueta: string;
  categoria: WhitelistCategory;
  activo: number;
  auto_entrenar: number;
  creado_en: number;
}

export const SEMILLA_OFICIAL: Array<{
  dominio: string;
  etiqueta: string;
  categoria: WhitelistCategory;
}> = [
  { dominio: 'nasa.gov', etiqueta: 'NASA Portal Oficial', categoria: 'NASA' },
  {
    dominio: 'pds.nasa.gov',
    etiqueta: 'NASA Planetary Data System (PDS)',
    categoria: 'PDS',
  },
  {
    dominio: 'pds-geosciences.wustl.edu',
    etiqueta: 'WUSTL PDS Geosciences Node',
    categoria: 'PDS',
  },
  {
    dominio: 'rsl.wustl.edu',
    etiqueta: 'WUSTL Orbital Data Explorer (ODE)',
    categoria: 'PDS',
  },
  {
    dominio: 'jpl.nasa.gov',
    etiqueta: 'NASA Jet Propulsion Laboratory',
    categoria: 'NASA',
  },
  { dominio: 'usgs.gov', etiqueta: 'USGS Astrogeology & Earth', categoria: 'USGS' },
  { dominio: 'esa.int', etiqueta: 'European Space Agency (ESA)', categoria: 'ESA' },
  {
    dominio: 'noaa.gov',
    etiqueta: 'NOAA National Centers for Environmental Info',
    categoria: 'NOAA',
  },
];

export function extraerDominio(urlStr: string): string | null {
  const raw = (urlStr || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function asegurarSemillaWhitelist(): void {
  iniciar();
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO lista_blanca(dominio, etiqueta, categoria, activo, auto_entrenar, creado_en)
     VALUES (?, ?, ?, 1, 1, ?)`
  );
  const now = Date.now() / 1000;
  for (const item of SEMILLA_OFICIAL) {
    stmt.run(item.dominio, item.etiqueta, item.categoria, now);
  }
}

export function listarWhitelist(): WhitelistDomainRow[] {
  asegurarSemillaWhitelist();
  const db = getDb();
  return db
    .prepare('SELECT * FROM lista_blanca ORDER BY id ASC')
    .all() as unknown as WhitelistDomainRow[];
}

export function buscarReglaListaBlanca(urlStr: string): WhitelistDomainRow | null {
  const host = extraerDominio(urlStr);
  if (!host) return null;
  const activos = listarWhitelist()
    .filter((d) => d.activo === 1)
    .sort((a, b) => b.dominio.length - a.dominio.length);
  return (
    activos.find((d) => host === d.dominio || host.endsWith(`.${d.dominio}`)) ?? null
  );
}

export function agregarDominioWhitelist(input: {
  dominio: string;
  etiqueta?: string;
  categoria?: string;
  autoEntrenar?: boolean;
}): WhitelistDomainRow {
  asegurarSemillaWhitelist();
  const dominio = extraerDominio(input.dominio);
  if (!dominio) {
    throw new Error('Dominio inválido. Ejemplo válido: pds.nasa.gov');
  }
  const categoriasValidas: WhitelistCategory[] = [
    'NASA',
    'PDS',
    'ESA',
    'USGS',
    'NOAA',
    'Oficial',
  ];
  const categoria: WhitelistCategory = categoriasValidas.includes(
    input.categoria as WhitelistCategory
  )
    ? (input.categoria as WhitelistCategory)
    : 'Oficial';
  const etiqueta = (input.etiqueta || dominio).trim().slice(0, 120);
  const auto = input.autoEntrenar === false ? 0 : 1;

  const db = getDb();
  db.prepare(
    `INSERT INTO lista_blanca(dominio, etiqueta, categoria, activo, auto_entrenar, creado_en)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(dominio) DO UPDATE SET
       etiqueta = excluded.etiqueta,
       categoria = excluded.categoria,
       activo = 1,
       auto_entrenar = excluded.auto_entrenar`
  ).run(dominio, etiqueta, categoria, auto, Date.now() / 1000);

  return db
    .prepare('SELECT * FROM lista_blanca WHERE dominio = ?')
    .get(dominio) as unknown as WhitelistDomainRow;
}

export function actualizarDominioWhitelist(
  id: number,
  patch: { activo?: boolean; autoEntrenar?: boolean }
): WhitelistDomainRow | null {
  asegurarSemillaWhitelist();
  const db = getDb();
  const actual = db
    .prepare('SELECT * FROM lista_blanca WHERE id = ?')
    .get(id) as unknown as WhitelistDomainRow | undefined;
  if (!actual) return null;

  const nextActivo =
    typeof patch.activo === 'boolean' ? (patch.activo ? 1 : 0) : actual.activo;
  const nextAuto =
    typeof patch.autoEntrenar === 'boolean'
      ? patch.autoEntrenar
        ? 1
        : 0
      : actual.auto_entrenar;

  db.prepare(
    'UPDATE lista_blanca SET activo = ?, auto_entrenar = ? WHERE id = ?'
  ).run(nextActivo, nextAuto, id);

  return db
    .prepare('SELECT * FROM lista_blanca WHERE id = ?')
    .get(id) as unknown as WhitelistDomainRow;
}

export function eliminarDominioWhitelist(id: number): boolean {
  asegurarSemillaWhitelist();
  const db = getDb();
  const res = db.prepare('DELETE FROM lista_blanca WHERE id = ?').run(id);
  return Number(res.changes ?? 0) > 0;
}
