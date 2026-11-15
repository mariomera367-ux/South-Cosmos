import fs from 'node:fs';
import path from 'node:path';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  ANALOGOS_TERRESTRES_NASA,
  SITIOS_INICIALES,
  sitioDesdePresetPds,
  type SitioAmbiental,
} from '../src/lib/analogo.ts';
import {
  conteos,
  filas,
  historial,
  logEntrenamiento,
  type RegistroRow,
} from './db.ts';

export const CLIMA_Y = ['temperatura', 'presion', 'viento', 'luz'] as const;
export const SIM_Y = [...CLIMA_Y, 'total'] as const;
export const TOPE_AUTONOMO = 0.4;

const CARPETA_MODELOS = process.env.MODELOS || 'modelos';

export const SITIOS_ML = new Map<string, SitioAmbiental>();

for (const s of SITIOS_INICIALES) {
  SITIOS_ML.set(s.nombre, s);
}
for (const t of ANALOGOS_TERRESTRES_NASA) {
  SITIOS_ML.set(t.etiquetaSitio, {
    id: t.id,
    nombre: t.etiquetaSitio,
    lat: t.lat,
    lon: t.lon,
    periodo: 24.0,
    T: [...t.T],
    P: [...t.P],
    viento: [...t.viento],
    luz: [...t.luz],
    g: 9.81,
    radiacion: t.radiacion,
    aire: { ...SITIOS_INICIALES[0].aire },
    suelo: { ...t.suelo },
    pendiente: t.pendiente,
    rugosidad: t.rugosidad,
  });
}
for (const p of ANALOGOS_LUNA_MARTE_PDS) {
  const s = sitioDesdePresetPds(p);
  SITIOS_ML.set(s.nombre, s);
}

export const NOMBRES = Array.from(SITIOS_ML.keys());

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function vecSim(v: number[]): number[] {
  return [
    v[0] / 100,
    Math.log10(Math.max(v[1], 1e-12)) / 5,
    v[2] / 10,
    v[3] / 1000,
  ];
}

export function featsClima(x: { sitio: string; hora: number }): number[] {
  const siteObj = SITIOS_ML.get(x.sitio) ?? SITIOS_INICIALES[0];
  const f = (2 * Math.PI * (Number(x.hora) || 0)) / Math.max(0.1, siteObj.periodo);
  const out = new Array(NOMBRES.length + 2);
  for (let i = 0; i < NOMBRES.length; i++) {
    out[i] = NOMBRES[i] === x.sitio ? 1 : 0;
  }
  out[NOMBRES.length] = Math.sin(f);
  out[NOMBRES.length + 1] = Math.cos(f);
  return out;
}

export function featsSim(x: { a: number[]; b: number[] }): number[] {
  const a = vecSim(x.a);
  const b = vecSim(x.b);
  const diff = a.map((v, i) => Math.abs(v - b[i]));
  return [...a, ...b, ...diff];
}

interface SerializedMlp {
  nIn: number;
  nOut: number;
  h: number;
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
}

interface SerializedEnsamble {
  tipo: 'clima' | 'similitud';
  mu: number[];
  sd: number[];
  ms: SerializedMlp[];
  perdidaMedia: number;
  nEditor: number;
  nAutonomo: number;
  entrenadoEn: number;
  epocas: number;
  duracionMs: number;
}

class MLP {
  nIn: number;
  nOut: number;
  h: number;
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];

  constructor(nIn: number, nOut: number, h: number = 24, seed: number = 0) {
    this.nIn = nIn;
    this.nOut = nOut;
    this.h = h;
    const rng = mulberry32(seed + 1337);
    this.W1 = Array.from({ length: nIn }, () =>
      Array.from({ length: h }, () => randn(rng) * 0.5)
    );
    this.b1 = new Array(h).fill(0);
    this.W2 = Array.from({ length: h }, () =>
      Array.from({ length: nOut }, () => randn(rng) * 0.5)
    );
    this.b2 = new Array(nOut).fill(0);
  }

  static fromJson(raw: SerializedMlp): MLP {
    const m = new MLP(raw.nIn, raw.nOut, raw.h, 0);
    m.W1 = raw.W1;
    m.b1 = raw.b1;
    m.W2 = raw.W2;
    m.b2 = raw.b2;
    return m;
  }

  toJson(): SerializedMlp {
    return {
      nIn: this.nIn,
      nOut: this.nOut,
      h: this.h,
      W1: this.W1,
      b1: this.b1,
      W2: this.W2,
      b2: this.b2,
    };
  }

  forwardSingle(x: number[]): number[] {
    const H = new Array(this.h);
    for (let j = 0; j < this.h; j++) {
      let sum = this.b1[j];
      for (let i = 0; i < this.nIn; i++) {
        sum += x[i] * this.W1[i][j];
      }
      H[j] = Math.tanh(sum);
    }
    const out = new Array(this.nOut);
    for (let k = 0; k < this.nOut; k++) {
      let sum = this.b2[k];
      for (let j = 0; j < this.h; j++) {
        sum += H[j] * this.W2[j][k];
      }
      out[k] = sum;
    }
    return out;
  }

  fit(
    X: number[][],
    Y: number[][],
    weights: number[],
    epocas: number = 800,
    lr: number = 0.02
  ): number {
    const N = X.length;
    const wSum = weights.reduce((a, b) => a + b, 0) || 1;
    const w = weights.map((v) => v / wSum);

    const mW1 = Array.from({ length: this.nIn }, () => new Array(this.h).fill(0));
    const vW1 = Array.from({ length: this.nIn }, () => new Array(this.h).fill(0));
    const mb1 = new Array(this.h).fill(0);
    const vb1 = new Array(this.h).fill(0);
    const mW2 = Array.from({ length: this.h }, () => new Array(this.nOut).fill(0));
    const vW2 = Array.from({ length: this.h }, () => new Array(this.nOut).fill(0));
    const mb2 = new Array(this.nOut).fill(0);
    const vb2 = new Array(this.nOut).fill(0);

    const H = Array.from({ length: N }, () => new Array(this.h).fill(0));
    const O = Array.from({ length: N }, () => new Array(this.nOut).fill(0));
    const dO = Array.from({ length: N }, () => new Array(this.nOut).fill(0));
    const dH = Array.from({ length: N }, () => new Array(this.h).fill(0));

    let lastLoss = 0;
    const b1Pow = (t: number) => 1 - Math.pow(0.9, t);
    const b2Pow = (t: number) => 1 - Math.pow(0.999, t);

    for (let ep = 1; ep <= epocas; ep++) {
      lastLoss = 0;
      const gW2 = Array.from({ length: this.h }, () => new Array(this.nOut).fill(0));
      const gb2 = new Array(this.nOut).fill(0);
      const gW1 = Array.from({ length: this.nIn }, () => new Array(this.h).fill(0));
      const gb1 = new Array(this.h).fill(0);

      for (let r = 0; r < N; r++) {
        const xr = X[r];
        const hr = H[r];
        const or = O[r];
        const yr = Y[r];
        const wr = w[r];

        for (let j = 0; j < this.h; j++) {
          let z = this.b1[j];
          for (let i = 0; i < this.nIn; i++) {
            const xi = xr[i];
            if (xi !== 0) z += xi * this.W1[i][j];
          }
          hr[j] = Math.tanh(z);
        }

        for (let k = 0; k < this.nOut; k++) {
          let s = this.b2[k];
          for (let j = 0; j < this.h; j++) {
            s += hr[j] * this.W2[j][k];
          }
          or[k] = s;
          const diff = s - yr[k];
          lastLoss += wr * diff * diff;
          const d = 2 * wr * diff;
          dO[r][k] = d;
          gb2[k] += d;
        }

        for (let j = 0; j < this.h; j++) {
          let dhVal = 0;
          for (let k = 0; k < this.nOut; k++) {
            const dok = dO[r][k];
            gW2[j][k] += hr[j] * dok;
            dhVal += dok * this.W2[j][k];
          }
          const actDeriv = 1 - hr[j] * hr[j];
          const dj = dhVal * actDeriv;
          dH[r][j] = dj;
          gb1[j] += dj;
        }

        for (let i = 0; i < this.nIn; i++) {
          const xi = xr[i];
          if (xi === 0) continue;
          for (let j = 0; j < this.h; j++) {
            gW1[i][j] += xi * dH[r][j];
          }
        }
      }

      const c1 = b1Pow(ep);
      const c2 = b2Pow(ep);

      for (let i = 0; i < this.nIn; i++) {
        for (let j = 0; j < this.h; j++) {
          const g = gW1[i][j];
          mW1[i][j] = 0.9 * mW1[i][j] + 0.1 * g;
          vW1[i][j] = 0.999 * vW1[i][j] + 0.001 * g * g;
          this.W1[i][j] -=
            (lr * (mW1[i][j] / c1)) / (Math.sqrt(vW1[i][j] / c2) + 1e-8);
        }
      }
      for (let j = 0; j < this.h; j++) {
        const g = gb1[j];
        mb1[j] = 0.9 * mb1[j] + 0.1 * g;
        vb1[j] = 0.999 * vb1[j] + 0.001 * g * g;
        this.b1[j] -= (lr * (mb1[j] / c1)) / (Math.sqrt(vb1[j] / c2) + 1e-8);
      }
      for (let j = 0; j < this.h; j++) {
        for (let k = 0; k < this.nOut; k++) {
          const g = gW2[j][k];
          mW2[j][k] = 0.9 * mW2[j][k] + 0.1 * g;
          vW2[j][k] = 0.999 * vW2[j][k] + 0.001 * g * g;
          this.W2[j][k] -=
            (lr * (mW2[j][k] / c1)) / (Math.sqrt(vW2[j][k] / c2) + 1e-8);
        }
      }
      for (let k = 0; k < this.nOut; k++) {
        const g = gb2[k];
        mb2[k] = 0.9 * mb2[k] + 0.1 * g;
        vb2[k] = 0.999 * vb2[k] + 0.001 * g * g;
        this.b2[k] -= (lr * (mb2[k] / c1)) / (Math.sqrt(vb2[k] / c2) + 1e-8);
      }
    }

    return lastLoss;
  }
}

export class Ensamble {
  tipo: 'clima' | 'similitud';
  mu: number[] = [];
  sd: number[] = [];
  ms: MLP[] = [];
  perdidaMedia = 0;
  nEditor = 0;
  nAutonomo = 0;
  entrenadoEn = 0;
  epocas = 0;
  duracionMs = 0;

  constructor(tipo: 'clima' | 'similitud') {
    this.tipo = tipo;
  }

  static fromJson(raw: SerializedEnsamble): Ensamble {
    const e = new Ensamble(raw.tipo);
    e.mu = raw.mu;
    e.sd = raw.sd;
    e.ms = raw.ms.map((m) => MLP.fromJson(m));
    e.perdidaMedia = raw.perdidaMedia;
    e.nEditor = raw.nEditor;
    e.nAutonomo = raw.nAutonomo;
    e.entrenadoEn = raw.entrenadoEn;
    e.epocas = raw.epocas;
    e.duracionMs = raw.duracionMs;
    return e;
  }

  toJson(): SerializedEnsamble {
    return {
      tipo: this.tipo,
      mu: this.mu,
      sd: this.sd,
      ms: this.ms.map((m) => m.toJson()),
      perdidaMedia: this.perdidaMedia,
      nEditor: this.nEditor,
      nAutonomo: this.nAutonomo,
      entrenadoEn: this.entrenadoEn,
      epocas: this.epocas,
      duracionMs: this.duracionMs,
    };
  }

  private extractY(y: Record<string, number>): number[] {
    if (this.tipo === 'clima') {
      return [
        y.temperatura,
        Math.log10(Math.max(y.presion, 1e-12)),
        y.viento,
        y.luz,
      ];
    }
    return SIM_Y.map((k) => y[k]);
  }

  private invY(vec: number[]): number[] {
    const out = [...vec];
    if (this.tipo === 'clima') {
      out[1] = Math.pow(10, out[1]);
    }
    return out;
  }

  entrenar(
    rows: RegistroRow[],
    nMiembros: number = 3,
    epocas: number = 800
  ): { perdita: number; nEditor: number; nAutonomo: number } {
    const t0 = Date.now();
    const X = rows.map((r) => {
      const parsed = JSON.parse(r.x);
      return this.tipo === 'clima' ? featsClima(parsed) : featsSim(parsed);
    });
    const Y = rows.map((r) => this.extractY(JSON.parse(r.y)));

    const nIn = X[0].length;
    const nOut = Y[0].length;
    const N = rows.length;

    const edFlags = rows.map((r) => r.origen === 'editor');
    const rawW = rows.map((r, i) => (edFlags[i] ? 1.0 : 0.5 * r.confianza));
    const sumEd = rawW.reduce((a, w, i) => a + (edFlags[i] ? w : 0), 0);
    const sumAu = rawW.reduce((a, w, i) => a + (!edFlags[i] ? w : 0), 0);

    if (sumEd > 0 && sumAu > 0) {
      const escalaAu = Math.min(
        1.0,
        (TOPE_AUTONOMO / (1 - TOPE_AUTONOMO)) * (sumEd / sumAu)
      );
      for (let i = 0; i < N; i++) {
        if (!edFlags[i]) rawW[i] *= escalaAu;
      }
    }

    this.mu = new Array(nOut).fill(0);
    for (let k = 0; k < nOut; k++) {
      let s = 0;
      for (let r = 0; r < N; r++) s += Y[r][k];
      this.mu[k] = s / N;
    }
    this.sd = new Array(nOut).fill(0);
    for (let k = 0; k < nOut; k++) {
      let s = 0;
      for (let r = 0; r < N; r++) {
        const d = Y[r][k] - this.mu[k];
        s += d * d;
      }
      this.sd[k] = Math.sqrt(s / N) + 1e-6;
    }

    const Ynorm = Y.map((row) => row.map((v, k) => (v - this.mu[k]) / this.sd[k]));

    this.ms = [];
    let lossSum = 0;
    for (let m = 0; m < nMiembros; m++) {
      const net = new MLP(nIn, nOut, 24, m);
      const loss = net.fit(X, Ynorm, rawW, epocas, 0.02);
      lossSum += loss;
      this.ms.push(net);
    }

    this.perdidaMedia = lossSum / Math.max(1, nMiembros);
    this.nEditor = edFlags.filter(Boolean).length;
    this.nAutonomo = N - this.nEditor;
    this.entrenadoEn = Math.floor(Date.now() / 1000);
    this.epocas = epocas;
    this.duracionMs = Date.now() - t0;

    return {
      pertita: this.perdidaMedia,
      perdita: this.perdidaMedia,
      nEditor: this.nEditor,
      nAutonomo: this.nAutonomo,
    } as unknown as { perdita: number; nEditor: number; nAutonomo: number };
  }

  predecir(x: Record<string, unknown>): Record<string, { valor: number; incertidumbre: number }> {
    const f =
      this.tipo === 'clima'
        ? featsClima(x as { sitio: string; hora: number })
        : featsSim(x as { a: number[]; b: number[] });

    const preds = this.ms.map((m) => {
      const z = m.forwardSingle(f);
      const unscaled = z.map((v, k) => v * this.sd[k] + this.mu[k]);
      let inv = this.invY(unscaled);
      if (this.tipo === 'similitud') {
        inv = inv.map((v) => Math.max(0, Math.min(100, v)));
      }
      return inv;
    });

    const keys = this.tipo === 'clima' ? CLIMA_Y : SIM_Y;
    const out: Record<string, { valor: number; incertidumbre: number }> = {};
    keys.forEach((k, idx) => {
      const vals = preds.map((p) => p[idx]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance =
        vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
      out[k] = {
        valor: Number(mean.toFixed(4)),
        incertidumbre: Number(Math.sqrt(variance).toFixed(4)),
      };
    });
    return out;
  }
}

export function guardarModelo(e: Ensamble): void {
  fs.mkdirSync(CARPETA_MODELOS, { recursive: true });
  fs.writeFileSync(
    path.join(CARPETA_MODELOS, `${e.tipo}.json`),
    JSON.stringify(e.toJson()),
    'utf8'
  );
}

export function cargarModelo(tipo: 'clima' | 'similitud'): Ensamble | null {
  const file = path.join(CARPETA_MODELOS, `${tipo}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as SerializedEnsamble;
    if (!parsed?.ms?.length) return null;
    if (tipo === 'clima' && parsed.ms[0].nIn !== NOMBRES.length + 2) {
      return null;
    }
    return Ensamble.fromJson(parsed);
  } catch {
    return null;
  }
}

export function entrenarTodo(epocas: number = 800): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const tipo of ['clima', 'similitud'] as const) {
    const fsRows = filas(tipo, 'aprobado');
    if (fsRows.length < 10) {
      out[tipo] = 'pocos datos';
      continue;
    }
    const e = new Ensamble(tipo);
    e.entrenar(fsRows, 3, epocas);
    guardarModelo(e);
    logEntrenamiento(tipo, e.nEditor, e.nAutonomo, e.perdidaMedia);
    out[tipo] = Number(e.perdidaMedia.toFixed(4));
  }
  return out;
}

export function obtenerEstadoModelos() {
  const clima = cargarModelo('clima');
  const similitud = cargarModelo('similitud');
  const c = conteos();
  const pend = filas(undefined, 'pendiente').slice(-30).reverse();

  const infoDe = (m: Ensamble | null) =>
    m
      ? {
          entrenadoEn: m.entrenadoEn,
          perdidaMedia: Number(m.perdidaMedia.toFixed(5)),
          nEditor: m.nEditor,
          nAutonomo: m.nAutonomo,
          miembros: m.ms.length,
          epocas: m.epocas,
          duracionMs: m.duracionMs,
          nIn: m.ms[0]?.nIn ?? 0,
        }
      : null;

  return {
    modelosListos: Boolean(clima && similitud),
    sitiosSoportados: NOMBRES,
    modelos: {
      clima: infoDe(clima),
      similitud: infoDe(similitud),
    },
    conteos: c,
    historial: historial(15),
    pendientes: pend.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      x: r.x,
      y: r.y,
      origen: r.origen,
      fuente: r.fuente,
      url: r.url,
      confianza: r.confianza,
    })),
  };
}

export function predecirPar(input: {
  sitioA: string;
  sitioB: string;
  t0: number;
  t1: number;
}) {
  const clima = cargarModelo('clima');
  const sim = cargarModelo('similitud');
  if (!clima || !sim) {
    throw new Error('Modelos ML aún no entrenados.');
  }

  const resolveNombre = (raw: string): string => {
    if (SITIOS_ML.has(raw)) return raw;
    if (raw.startsWith('Tierra')) return 'Tierra (Atacama, 2400 m)';
    if (raw.startsWith('Marte')) return 'Marte (Cráter Gale)';
    if (raw.startsWith('Luna')) return 'Luna (ecuador, mare)';
    return 'Tierra (Atacama, 2400 m)';
  };

  const a = resolveNombre(input.sitioA);
  const b = resolveNombre(input.sitioB);
  const t0 = Number(input.t0) || 0;
  const t1 = Math.max(t0 + 1, Number(input.t1) || 48);

  const avgClima = (sitio: string) => {
    const steps = 12;
    const acc: Record<string, { v: number[]; u: number[] }> = {};
    for (const k of CLIMA_Y) acc[k] = { v: [], u: [] };
    for (let i = 0; i < steps; i++) {
      const h = t0 + ((t1 - t0) * i) / (steps - 1);
      const p = clima.predecir({ sitio, hora: h });
      for (const k of CLIMA_Y) {
        acc[k].v.push(p[k].valor);
        acc[k].u.push(p[k].incertidumbre);
      }
    }
    const res: Record<string, { valor: number; incertidumbre: number }> = {};
    for (const k of CLIMA_Y) {
      const mv = acc[k].v.reduce((x, y) => x + y, 0) / steps;
      const mu = acc[k].u.reduce((x, y) => x + y, 0) / steps;
      res[k] = { valor: mv, incertidumbre: mu };
    }
    return res;
  };

  const ca = avgClima(a);
  const cb = avgClima(b);

  const simPred = sim.predecir({
    a: CLIMA_Y.map((k) => ca[k].valor),
    b: CLIMA_Y.map((k) => cb[k].valor),
  });

  return { a, b, t0, t1, ca, cb, sim: simPred };
}
