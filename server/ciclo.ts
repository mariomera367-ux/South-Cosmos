import {
  compararSitios,
  generarSerie,
  PESOS_DEFAULT,
} from '../src/lib/analogo.ts';
import { filas, guardar, iniciar } from './db.ts';
import { CLIMA_Y, entrenarTodo, NOMBRES, SITIOS_ML } from './ml.ts';

function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function faltanSitiosEnDb(): boolean {
  const existentes = filas('clima', 'aprobado');
  const vistos = new Set<string>();
  for (const r of existentes) {
    try {
      const x = JSON.parse(r.x) as { sitio?: string };
      if (x.sitio) vistos.add(x.sitio);
    } catch {
      // Ignorar fila malformada
    }
  }
  return NOMBRES.some((n) => !vistos.has(n));
}

export function sembrar(seed: number = 0): number {
  iniciar();
  const rng = seededRng(seed);
  let agregados = 0;

  // 1. Semilla de clima por sitio
  for (const nombre of NOMBRES) {
    const sitio = SITIOS_ML.get(nombre);
    if (!sitio) continue;
    const count = 36;
    for (let i = 0; i < count; i++) {
      const h = rng() * Math.max(48, sitio.periodo);
      const ser = generarSerie(sitio, [h, h + 0.1], 2);
      const y: Record<string, number> = {
        temperatura: Number(Math.max(15, ser.temperatura[0] * (1 + normal(rng) * 0.01)).toFixed(3)),
        presion: Number(Math.max(1e-11, ser.presion[0] * (1 + normal(rng) * 0.01)).toExponential(4)),
        viento: Number(Math.max(0, ser.viento[0] * (1 + normal(rng) * 0.02)).toFixed(3)),
        luz: Number(Math.max(0, Math.min(1480, ser.luz[0] * (1 + normal(rng) * 0.01))).toFixed(2)),
      };
      const st = guardar(
        'clima',
        { sitio: nombre, hora: Number(h.toFixed(2)) },
        y,
        'editor',
        'semilla analogo.ts',
        '',
        1.0
      );
      if (st !== 'duplicado') agregados++;
    }
  }

  // 2. Semilla de similitud entre pares representativos
  const claveSitios = NOMBRES.slice(0, 18);
  const wSum = CLIMA_Y.reduce((acc, k) => acc + PESOS_DEFAULT[k], 0);
  for (const nA of claveSitios) {
    const sA = SITIOS_ML.get(nA);
    if (!sA) continue;
    for (const nB of claveSitios) {
      const sB = SITIOS_ML.get(nB);
      if (!sB) continue;
      for (let i = 0; i < 4; i++) {
        const t0 = rng() * 120;
        const t1 = t0 + 24 + rng() * 48;
        const comp = compararSitios(sA, sB, {
          horas: [t0, t1],
          modo: sA.periodo > 48 || sB.periodo > 48 ? 'ciclo' : 'reloj',
          n: 48,
        });
        const meanArr = (arr: number[]) =>
          arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);

        const x = {
          a: [
            meanArr(comp.seriesA.temperatura),
            meanArr(comp.seriesA.presion),
            meanArr(comp.seriesA.viento),
            meanArr(comp.seriesA.luz),
          ],
          b: [
            meanArr(comp.seriesB.temperatura),
            meanArr(comp.seriesB.presion),
            meanArr(comp.seriesB.viento),
            meanArr(comp.seriesB.luz),
          ],
        };
        const total =
          CLIMA_Y.reduce((acc, k) => acc + comp.porVariable[k] * PESOS_DEFAULT[k], 0) /
          wSum;
        const y = {
          temperatura: Number(comp.porVariable.temperatura.toFixed(2)),
          presion: Number(comp.porVariable.presion.toFixed(2)),
          viento: Number(comp.porVariable.viento.toFixed(2)),
          luz: Number(comp.porVariable.luz.toFixed(2)),
          total: Number(total.toFixed(2)),
        };
        const st = guardar(
          'similitud',
          x,
          y,
          'editor',
          'semilla analogo.ts',
          '',
          1.0
        );
        if (st !== 'duplicado') agregados++;
      }
    }
  }

  return agregados;
}

export async function conectorNasaPower(
  lat: number = -24.1,
  lon: number = -69.9,
  start: string = '20260615',
  end: string = '20260616'
): Promise<number> {
  const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,PS,WS10M,ALLSKY_SFC_SW_DWN&community=RE&longitude=${encodeURIComponent(
    lon
  )}&latitude=${encodeURIComponent(lat)}&start=${start}&end=${end}&format=JSON`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) {
    throw new Error(`NASA POWER HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as {
    properties?: {
      parameter?: Record<string, Record<string, number>>;
    };
  };
  const params = data.properties?.parameter;
  if (!params?.T2M) return 0;

  let nuevos = 0;
  const keys = Object.keys(params.T2M).sort();
  for (let i = 0; i < keys.length; i += 2) {
    const k = keys[i];
    const tC = params.T2M[k];
    const psKpa = params.PS?.[k];
    const ws = params.WS10M?.[k];
    const sw = params.ALLSKY_SFC_SW_DWN?.[k];
    if (tC < -200 || psKpa < 0 || ws < 0 || sw < -10) continue;

    const horaNum = Number.parseInt(k.slice(8, 10), 10) || i % 24;
    const st = guardar(
      'clima',
      { sitio: 'Tierra (Atacama, 2400 m)', hora: horaNum },
      {
        temperatura: Number((tC + 273.15).toFixed(2)),
        presion: Number((psKpa * 1000).toFixed(1)),
        viento: Number(Math.max(0, ws).toFixed(2)),
        luz: Number(Math.max(0, Math.min(1480, sw)).toFixed(1)),
      },
      'autonomo',
      'NASA',
      url,
      0.92
    );
    if (st !== 'duplicado') nuevos++;
  }
  return nuevos;
}

export async function ejecutarCiclo(opts?: {
  sembrarSiVacio?: boolean;
  incluirNasa?: boolean;
  epocas?: number;
  lat?: number;
  lon?: number;
  start?: string;
  end?: string;
}) {
  iniciar();
  let nuevos = 0;

  const existingCount = filas(undefined, 'aprobado').length;
  if (opts?.sembrarSiVacio !== false && (existingCount < 20 || faltanSitiosEnDb())) {
    nuevos += sembrar(0);
  }

  let nasaError: string | null = null;
  if (opts?.incluirNasa) {
    try {
      nuevos += await conectorNasaPower(opts.lat, opts.lon, opts.start, opts.end);
    } catch (err) {
      nasaError = err instanceof Error ? err.message : String(err);
    }
  }

  const epocas = Math.max(200, Math.min(3000, Number(opts?.epocas) || 800));
  const entrenamiento = entrenarTodo(epocas);

  return {
    modo: opts?.incluirNasa ? 'nasa' : 'local',
    nuevos,
    nasaError,
    entrenamiento,
    sitiosSoportados: NOMBRES,
  };
}
