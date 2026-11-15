import { ResultadoComparacion, SitioAmbiental, VariableAnalogo } from './analogo';
import type { Lang } from './i18n';
import { translateSiteName, translateVariableLabel } from './translations';

export interface CanvasCamera {
  zoom: number;
  panX: number;
  panY: number;
}

export type CanvasViewportMode = 'split' | 'siteA' | 'siteB' | 'instruments';

export type OscilloscopeChannel = 'temperatura' | 'luz' | 'viento' | 'presion';

export interface CanvasLayerFlags {
  atmosphere: boolean;
  wind: boolean;
  radiation: boolean;
  terrain: boolean;
  physics: boolean;
  instruments: boolean;
  grid: boolean;
}

export interface CanvasHoverSummary {
  zone: string;
  title: string;
  lines: string[];
}

export interface CanvasEngineSceneState {
  sitioA: SitioAmbiental;
  sitioB: SitioAmbiental;
  resultado: ResultadoComparacion;
  criticas: VariableAnalogo[];
  pesos: Record<VariableAnalogo, number>;
  viewportMode: CanvasViewportMode;
  oscChannel: OscilloscopeChannel;
  layers: CanvasLayerFlags;
  camera: CanvasCamera;
  pointer: { x: number; y: number; inside: boolean };
  playing: boolean;
  speed: number;
  sampleCursor: number;
  lang: Lang;
}

interface DropProbe {
  side: 'A' | 'B';
  xNorm: number;
  yMeters: number;
  vy: number;
  vx: number;
  landed: boolean;
  bounces: number;
  age: number;
}

interface DustParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export class PlanetaryCanvasEngine {
  private timeAccum = 0;
  private sampleAccum = 0;
  private probes: DropProbe[] = [];
  private dustA: DustParticle[] = [];
  private dustB: DustParticle[] = [];

  constructor() {
    for (let i = 0; i < 65; i++) {
      this.dustA.push({
        x: Math.random(),
        y: Math.random(),
        size: 1 + Math.random() * 2,
        alpha: 0.25 + Math.random() * 0.55,
      });
      this.dustB.push({
        x: Math.random(),
        y: Math.random(),
        size: 1 + Math.random() * 2,
        alpha: 0.25 + Math.random() * 0.55,
      });
    }
  }

  spawnDropProbe(side: 'A' | 'B', xNorm: number) {
    this.probes.push({
      side,
      xNorm: Math.max(0.08, Math.min(0.92, xNorm)),
      yMeters: 36,
      vy: 0,
      vx: 0,
      landed: false,
      bounces: 0,
      age: 0,
    });
    if (this.probes.length > 16) {
      this.probes.shift();
    }
  }

  clearProbes() {
    this.probes = [];
  }

  step(
    dtSec: number,
    state: CanvasEngineSceneState,
    onAdvanceCursor: (deltaIdx: number) => void
  ) {
    const dt = Math.min(0.05, Math.max(0, dtSec)) * state.speed;
    this.timeAccum += dt;

    if (state.playing) {
      this.sampleAccum += dt * 18;
      if (this.sampleAccum >= 1) {
        const steps = Math.floor(this.sampleAccum);
        this.sampleAccum -= steps;
        onAdvanceCursor(steps);
      }
    }

    const idx = Math.min(state.sampleCursor, state.resultado.seriesA.t.length - 1);
    const windA = state.resultado.seriesA.viento[idx] ?? state.sitioA.viento[0];
    const windB = state.resultado.seriesB.viento[idx] ?? state.sitioB.viento[0];

    for (const p of this.dustA) {
      p.x = (p.x + (0.04 + windA * 0.03) * dt) % 1;
      p.y = (p.y + Math.sin(this.timeAccum * 2 + p.x * 12) * 0.015 * dt + 1) % 1;
    }
    for (const p of this.dustB) {
      p.x = (p.x + (0.04 + windB * 0.03) * dt) % 1;
      p.y = (p.y + Math.sin(this.timeAccum * 2 + p.x * 12) * 0.015 * dt + 1) % 1;
    }

    for (const probe of this.probes) {
      probe.age += dt;
      if (probe.landed) continue;
      const sitio = probe.side === 'A' ? state.sitioA : state.sitioB;
      const wind = probe.side === 'A' ? windA : windB;
      probe.vy -= sitio.g * dt;
      probe.yMeters += probe.vy * dt;
      probe.vx = wind * 0.008;
      probe.xNorm = Math.max(0.05, Math.min(0.95, probe.xNorm + probe.vx * dt));
      if (probe.yMeters <= 0) {
        probe.yMeters = 0;
        if (Math.abs(probe.vy) > 1.4 && probe.bounces < 2) {
          probe.vy = -probe.vy * 0.36;
          probe.bounces += 1;
        } else {
          probe.vy = 0;
          probe.landed = true;
        }
      }
    }
  }

  private getViewportRects(w: number, h: number, mode: CanvasViewportMode) {
    const instH = mode === 'instruments' ? Math.round(h * 0.56) : Math.round(h * 0.27);
    const sceneH = Math.max(180, h - instH);
    if (mode === 'siteA') {
      return {
        rectA: { x: 0, y: 0, w, h: sceneH },
        rectB: null,
        rectInst: { x: 0, y: sceneH, w, h: instH },
      };
    }
    if (mode === 'siteB') {
      return {
        rectA: null,
        rectB: { x: 0, y: 0, w, h: sceneH },
        rectInst: { x: 0, y: sceneH, w, h: instH },
      };
    }
    const half = Math.floor(w / 2);
    return {
      rectA: { x: 0, y: 0, w: half, h: sceneH },
      rectB: { x: half, y: 0, w: w - half, h: sceneH },
      rectInst: { x: 0, y: sceneH, w, h: instH },
    };
  }

  hitTestSceneSide(
    x: number,
    y: number,
    w: number,
    h: number,
    state: CanvasEngineSceneState
  ): { side: 'A' | 'B'; xNorm: number } | null {
    const { rectA, rectB } = this.getViewportRects(w, h, state.viewportMode);
    if (rectA && x >= rectA.x && x <= rectA.x + rectA.w && y >= rectA.y && y <= rectA.y + rectA.h) {
      return { side: 'A', xNorm: (x - rectA.x) / Math.max(1, rectA.w) };
    }
    if (rectB && x >= rectB.x && x <= rectB.x + rectB.w && y >= rectB.y && y <= rectB.y + rectB.h) {
      return { side: 'B', xNorm: (x - rectB.x) / Math.max(1, rectB.w) };
    }
    return null;
  }

  getHoverInfo(
    w: number,
    h: number,
    state: CanvasEngineSceneState
  ): CanvasHoverSummary {
    const { x, y } = state.pointer;
    const hit = this.hitTestSceneSide(x, y, w, h, state);
    const idx = Math.min(state.sampleCursor, state.resultado.seriesA.t.length - 1);
    if (hit) {
      const sitio = hit.side === 'A' ? state.sitioA : state.sitioB;
      const series = hit.side === 'A' ? state.resultado.seriesA : state.resultado.seriesB;
      const siteLabel =
        hit.side === 'A'
          ? state.lang === 'en'
            ? 'Site A'
            : 'Sitio A'
          : state.lang === 'en'
            ? 'Site B'
            : 'Sitio B';
      const windLabel = state.lang === 'en' ? 'Wind' : 'Viento';
      return {
        zone: `site${hit.side}`,
        title: `${siteLabel} · ${translateSiteName(sitio.nombre, state.lang)}`,
        lines: [
          `T=${(series.temperatura[idx] ?? sitio.T[0]).toFixed(1)} K · P=${(series.presion[idx] ?? sitio.P[0]).toExponential(2)} Pa`,
          `g=${sitio.g.toFixed(2)} m/s² · ${windLabel}=${(series.viento[idx] ?? sitio.viento[0]).toFixed(1)} m/s · Rad=${sitio.radiacion} µSv/h`,
        ],
      };
    }
    const oscWord = state.lang === 'en' ? 'Oscilloscope' : 'Osciloscopio';
    const chanLabel = translateVariableLabel(state.oscChannel, state.lang).toUpperCase();
    const simWord = state.lang === 'en' ? 'Global similarity' : 'Similitud global';
    const sampleWord = state.lang === 'en' ? 'Sample' : 'Muestra';
    return {
      zone: 'instruments',
      title: `${oscWord} · ${chanLabel}`,
      lines: [
        `${simWord} ${state.resultado.total.toFixed(1)}% · ${sampleWord} ${idx + 1}/${state.resultado.seriesA.t.length}`,
      ],
    };
  }

  private renderScene(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; w: number; h: number },
    side: 'A' | 'B',
    sitio: SitioAmbiental,
    state: CanvasEngineSceneState
  ) {
    const idx = Math.min(state.sampleCursor, state.resultado.seriesA.t.length - 1);
    const series = side === 'A' ? state.resultado.seriesA : state.resultado.seriesB;
    const luz = series.luz[idx] ?? 0;
    const temp = series.temperatura[idx] ?? sitio.T[0];
    const wind = series.viento[idx] ?? sitio.viento[0];
    const dust = side === 'A' ? this.dustA : this.dustB;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    // Atmósfera
    const dayRatio = Math.min(1, luz / 1200);
    const isMars = sitio.id.includes('marte') || (sitio.suelo.Fe2O3 ?? 0) > 0.13;
    const isMoon = sitio.id.includes('luna') || sitio.P[0] < 1;

    if (state.layers.atmosphere) {
      const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      if (isMoon) {
        grad.addColorStop(0, '#03050a');
        grad.addColorStop(1, '#0f172a');
      } else if (isMars) {
        grad.addColorStop(0, `rgba(55, 24, 18, ${0.4 + dayRatio * 0.55})`);
        grad.addColorStop(1, `rgba(148, 68, 36, ${0.25 + dayRatio * 0.5})`);
      } else {
        grad.addColorStop(0, `rgba(10, 28, 56, ${0.55 + dayRatio * 0.45})`);
        grad.addColorStop(1, `rgba(26, 78, 128, ${0.3 + dayRatio * 0.5})`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      ctx.fillStyle = '#07090E';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    // Grilla de calibración
    if (state.layers.grid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let gx = rect.x + 64; gx < rect.x + rect.w; gx += 64) {
        ctx.beginPath();
        ctx.moveTo(gx, rect.y);
        ctx.lineTo(gx, rect.y + rect.h);
        ctx.stroke();
      }
      for (let gy = rect.y + 48; gy < rect.y + rect.h; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(rect.x, gy);
        ctx.lineTo(rect.x + rect.w, gy);
        ctx.stroke();
      }
    }

    // Rayos de radiación cósmica proporcionales a sitio.radiacion
    if (state.layers.radiation && sitio.radiacion > 0.2) {
      const rayCount = Math.min(28, Math.max(3, Math.round(Math.log10(1 + sitio.radiacion) * 12)));
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.48)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < rayCount; i++) {
        const rx = rect.x + (((i * 137 + this.timeAccum * 45) % 100) / 100) * rect.w;
        const ry = rect.y + (((i * 89 + this.timeAccum * 190) % 85) / 100) * rect.h;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + 18);
        ctx.stroke();
      }
    }

    // Partículas de viento y polvo
    if (state.layers.wind && (wind > 0.05 || sitio.P[0] > 10)) {
      ctx.fillStyle = isMars ? '#fbbf24' : '#38bdf8';
      for (const p of dust) {
        ctx.globalAlpha = p.alpha * Math.min(1, 0.25 + wind / 10);
        const px = rect.x + p.x * rect.w;
        const py = rect.y + p.y * rect.h * 0.78;
        ctx.fillRect(px, py, p.size * (1 + wind * 0.3), p.size * 0.8);
      }
      ctx.globalAlpha = 1;
    }

    // Relieve del terreno según pendiente y rugosidad
    const groundBaseY = rect.y + rect.h * 0.78 + state.camera.panY * 0.25;
    if (state.layers.terrain) {
      const slopeRise = Math.tan((Math.min(28, sitio.pendiente) * Math.PI) / 180) * (rect.w * 0.28);
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h);
      const segs = 36;
      for (let i = 0; i <= segs; i++) {
        const frac = i / segs;
        const gx = rect.x + frac * rect.w;
        const roughAmp = Math.min(28, sitio.rugosidad * 240);
        const wave =
          Math.sin(frac * 18 + (side === 'A' ? 0 : 2)) * roughAmp * 0.5 +
          Math.cos(frac * 33) * roughAmp * 0.35;
        const gy = groundBaseY - (frac - 0.5) * slopeRise + wave;
        ctx.lineTo(gx, gy);
      }
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
      ctx.closePath();
      ctx.fillStyle = isMoon ? '#272a33' : isMars ? '#5c2c1b' : '#3b2f24';
      ctx.fill();
      ctx.strokeStyle = side === 'A' ? '#22d3ee' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Sondas gravitacionales en caída libre
    if (state.layers.physics) {
      for (const probe of this.probes) {
        if (probe.side !== side) continue;
        const px = rect.x + probe.xNorm * rect.w;
        const py = groundBaseY - (probe.yMeters / 40) * (rect.h * 0.62);
        ctx.fillStyle = probe.landed ? '#10b981' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(px, py - 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${probe.yMeters.toFixed(1)}m`, px + 9, py - 3);
      }
    }

    // Etiqueta HUD de esquina
    ctx.fillStyle = 'rgba(7, 9, 14, 0.82)';
    ctx.fillRect(rect.x + 10, rect.y + 10, Math.min(rect.w - 20, 290), 46);
    ctx.strokeStyle = side === 'A' ? 'rgba(34,211,238,0.5)' : 'rgba(245,158,11,0.5)';
    ctx.strokeRect(rect.x + 10, rect.y + 10, Math.min(rect.w - 20, 290), 46);

    ctx.font = '600 12px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = side === 'A' ? '#67e8f9' : '#fcd34d';
    ctx.fillText(`${side}: ${translateSiteName(sitio.nombre, state.lang)}`, rect.x + 18, rect.y + 28);
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      `T ${temp.toFixed(1)}K · g ${sitio.g.toFixed(2)}m/s² · ${wind.toFixed(1)}m/s`,
      rect.x + 18,
      rect.y + 46
    );

    ctx.restore();
  }

  private renderInstruments(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; w: number; h: number },
    state: CanvasEngineSceneState
  ) {
    ctx.save();
    ctx.fillStyle = '#07090E';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.stroke();

    if (!state.layers.instruments) {
      ctx.restore();
      return;
    }

    const sA = state.resultado.seriesA[state.oscChannel];
    const sB = state.resultado.seriesB[state.oscChannel];
    const n = Math.min(sA.length, sB.length);
    if (n < 2) {
      ctx.restore();
      return;
    }

    let minV = Infinity;
    let maxV = -Infinity;
    for (let i = 0; i < n; i++) {
      minV = Math.min(minV, sA[i], sB[i]);
      maxV = Math.max(maxV, sA[i], sB[i]);
    }
    if (maxV - minV < 1e-9) maxV = minV + 1;

    const padL = 56;
    const padR = 20;
    const padT = 24;
    const padB = 18;
    const plotW = Math.max(40, rect.w - padL - padR);
    const plotH = Math.max(30, rect.h - padT - padB);

    const drawLine = (arr: number[], color: string) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = rect.x + padL + (i / (n - 1)) * plotW;
        const py = rect.y + padT + (1 - (arr[i] - minV) / (maxV - minV)) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    drawLine(sA, '#22d3ee');
    drawLine(sB, '#f59e0b');

    // Cursor de muestra viva
    const cursorX =
      rect.x + padL + (Math.min(state.sampleCursor, n - 1) / (n - 1)) * plotW;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(cursorX, rect.y + padT);
    ctx.lineTo(cursorX, rect.y + padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    const oscLabel = state.lang === 'en' ? 'OSCILLOSCOPE' : 'OSCILOSCOPIO';
    const chanName = translateVariableLabel(state.oscChannel, state.lang).toUpperCase();
    const simTotalLabel = state.lang === 'en' ? 'TOTAL SIMILARITY' : 'SIMILITUD TOTAL';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `${oscLabel} · ${chanName} · ${simTotalLabel}: ${state.resultado.total.toFixed(1)}%`,
      rect.x + padL,
      rect.y + 15
    );
    ctx.restore();
  }

  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    state: CanvasEngineSceneState
  ) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, w, h);

    const { rectA, rectB, rectInst } = this.getViewportRects(
      w,
      h,
      state.viewportMode
    );
    if (rectA) this.renderScene(ctx, rectA, 'A', state.sitioA, state);
    if (rectB) this.renderScene(ctx, rectB, 'B', state.sitioB, state);
    if (rectA && rectB) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rectB.x, 0);
      ctx.lineTo(rectB.x, rectA.h);
      ctx.stroke();
    }
    this.renderInstruments(ctx, rectInst, state);
    ctx.restore();
  }
}
