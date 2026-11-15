import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  Crosshair,
  Download,
  FlaskConical,
  Layers,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { translateSiteName, translateVariableLabel } from '../lib/translations';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  ANALOGOS_TERRESTRES_NASA,
  AnalogoPlanetarioPds,
  AnalogoTerrestrePreset,
  ResultadoComparacion,
  SitioAmbiental,
  VariableAnalogo,
} from '../lib/analogo';
import {
  CanvasCamera,
  CanvasEngineSceneState,
  CanvasHoverSummary,
  CanvasLayerFlags,
  CanvasViewportMode,
  OscilloscopeChannel,
  PlanetaryCanvasEngine,
} from '../lib/canvasEngine';

interface CanvasEngineWorkspaceProps {
  sitios: SitioAmbiental[];
  sitioA: SitioAmbiental;
  sitioB: SitioAmbiental;
  sitioAId: string;
  sitioBId: string;
  resultado: ResultadoComparacion;
  criticas: VariableAnalogo[];
  pesos: Record<VariableAnalogo, number>;
  earthLat: number;
  earthLon: number;
  sitioMarteNombre: string;
  sitioLunaNombre: string;
  onChangeSitioAId: (id: string) => void;
  onChangeSitioBId: (id: string) => void;
  onSwapSitios: () => void;
  onSelectPresetPair: (id: 't-m' | 't-l' | 'm-l') => void;
  onSelectEarthPreset: (preset: AnalogoTerrestrePreset) => void;
  onSelectPdsPreset: (preset: AnalogoPlanetarioPds) => void;
  onOpenLab: () => void;
}

export const CanvasEngineWorkspace: React.FC<CanvasEngineWorkspaceProps> = ({
  sitios,
  sitioA,
  sitioB,
  sitioAId,
  sitioBId,
  resultado,
  criticas,
  pesos,
  earthLat,
  earthLon,
  sitioMarteNombre,
  sitioLunaNombre,
  onChangeSitioAId,
  onChangeSitioBId,
  onSwapSitios,
  onSelectPresetPair,
  onSelectEarthPreset,
  onSelectPdsPreset,
  onOpenLab,
}) => {
  const { lang, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PlanetaryCanvasEngine>(new PlanetaryCanvasEngine());

  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number; dpr: number }>({
    w: 960,
    h: 640,
    dpr: 1,
  });

  const [viewportMode, setViewportMode] = useState<CanvasViewportMode>('split');
  const [oscChannel, setOscChannel] = useState<OscilloscopeChannel>('temperatura');
  const [layers, setLayers] = useState<CanvasLayerFlags>({
    atmosphere: true,
    wind: true,
    radiation: true,
    terrain: true,
    physics: true,
    instruments: true,
    grid: true,
  });

  const [playing, setPlaying] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return true;
  });
  const [speed, setSpeed] = useState<number>(1);
  const [sampleCursor, setSampleCursor] = useState<number>(0);
  const sampleCursorRef = useRef<number>(0);

  const [camera, setCamera] = useState<CanvasCamera>({ zoom: 1, panX: 0, panY: 0 });
  const pointerRef = useRef<{ x: number; y: number; inside: boolean }>({
    x: 0,
    y: 0,
    inside: false,
  });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origPanX: 0,
    origPanY: 0,
  });

  const [fps, setFps] = useState<number>(60);
  const [hoverInfo, setHoverInfo] = useState<CanvasHoverSummary>(() => ({
    zone: 'none',
    title: lang === 'en' ? 'Canvas Viewport' : 'Visor Canvas',
    lines: [
      lang === 'en'
        ? 'Click anywhere in a scene to drop a gravitational probe'
        : 'Haz clic en cualquier escena para soltar una sonda gravitacional',
    ],
  }));

  useEffect(() => {
    if (!pointerRef.current.inside) {
      setHoverInfo({
        zone: 'none',
        title: lang === 'en' ? 'Canvas Viewport' : 'Visor Canvas',
        lines: [
          lang === 'en'
            ? 'Click anywhere in a scene to drop a gravitational probe'
            : 'Haz clic en cualquier escena para soltar una sonda gravitacional',
        ],
      });
    }
  }, [lang]);

  const totalSamples = Math.max(2, resultado.seriesA.t.length);

  // Reiniciar cursor cuando cambia la cantidad de muestras
  useEffect(() => {
    sampleCursorRef.current = 0;
    setSampleCursor(0);
  }, [totalSamples, sitioAId, sitioBId]);

  // Medición responsiva con ResizeObserver + DPR
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(460, Math.floor(rect.height));
      setCanvasSize({ w, h, dpr });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const sceneStateRef = useRef<CanvasEngineSceneState>({
    sitioA,
    sitioB,
    resultado,
    criticas,
    pesos,
    viewportMode,
    oscChannel,
    layers,
    camera,
    pointer: pointerRef.current,
    playing,
    speed,
    sampleCursor: sampleCursorRef.current,
    lang,
  });

  sceneStateRef.current = {
    sitioA,
    sitioB,
    resultado,
    criticas,
    pesos,
    viewportMode,
    oscChannel,
    layers,
    camera,
    pointer: pointerRef.current,
    playing,
    speed,
    sampleCursor: sampleCursorRef.current,
    lang,
  };

  // Bucle principal del motor gráfico requestAnimationFrame
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let fpsCounter = 0;
    let fpsTimer = 0;
    let uiSyncTimer = 0;

    const tick = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      fpsCounter += 1;
      fpsTimer += dtSec;
      if (fpsTimer >= 0.5) {
        setFps(Math.round(fpsCounter / fpsTimer));
        fpsCounter = 0;
        fpsTimer = 0;
      }

      const st = sceneStateRef.current;
      engineRef.current.step(dtSec, st, (deltaIdx) => {
        const next = (sampleCursorRef.current + deltaIdx) % totalSamples;
        sampleCursorRef.current = next;
      });
      st.sampleCursor = sampleCursorRef.current;

      uiSyncTimer += dtSec;
      if (uiSyncTimer >= 0.08) {
        setSampleCursor(sampleCursorRef.current);
        if (pointerRef.current.inside) {
          setHoverInfo(
            engineRef.current.getHoverInfo(canvasSize.w, canvasSize.h, st)
          );
        }
        uiSyncTimer = 0;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const targetW = Math.round(canvasSize.w * canvasSize.dpr);
        const targetH = Math.round(canvasSize.h * canvasSize.dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          engineRef.current.render(ctx, canvasSize.w, canvasSize.h, canvasSize.dpr, st);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [canvasSize, totalSamples]);

  const handleDropBothProbes = useCallback(() => {
    engineRef.current.spawnDropProbe('A', 0.5);
    engineRef.current.spawnDropProbe('B', 0.5);
  }, []);

  const handleResetCamera = useCallback(() => {
    setCamera({ zoom: 1, panX: 0, panY: 0 });
    engineRef.current.clearProbes();
  }, []);

  const handleExportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `analogo_canvas_${sitioA.id}_vs_${sitioB.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [sitioA.id, sitioB.id]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragRef.current = {
      active: true,
      moved: false,
      startX: x,
      startY: y,
      origPanX: camera.panX,
      origPanY: camera.panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pointerRef.current = { x, y, inside: true };

    if (dragRef.current.active) {
      const dx = x - dragRef.current.startX;
      const dy = y - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.moved = true;
      }
      if (dragRef.current.moved) {
        setCamera((prev) => ({
          ...prev,
          panX: Math.max(-280, Math.min(280, dragRef.current.origPanX + dx)),
          panY: Math.max(-180, Math.min(180, dragRef.current.origPanY + dy)),
        }));
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const wasClick = dragRef.current.active && !dragRef.current.moved;
    dragRef.current.active = false;

    if (wasClick) {
      const hit = engineRef.current.hitTestSceneSide(
        x,
        y,
        canvasSize.w,
        canvasSize.h,
        sceneStateRef.current
      );
      if (hit) {
        engineRef.current.spawnDropProbe(hit.side, hit.xNorm);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setCamera((prev) => ({
      ...prev,
      zoom: Number(Math.max(0.75, Math.min(2.8, prev.zoom * factor)).toFixed(2)),
    }));
  };

  const currentIdx = Math.min(totalSamples - 1, Math.floor(sampleCursor));
  const currentHour = resultado.seriesA.t[currentIdx] ?? 0;

  const activeEarthPresetId = useMemo(
    () =>
      ANALOGOS_TERRESTRES_NASA.find(
        (p) => Math.abs(p.lat - earthLat) < 0.02 && Math.abs(p.lon - earthLon) < 0.02
      )?.id ?? '',
    [earthLat, earthLon]
  );

  const activeMarsPresetId = useMemo(
    () =>
      ANALOGOS_LUNA_MARTE_PDS.find(
        (p) => p.cuerpo === 'marte' && p.etiquetaSitio === sitioMarteNombre
      )?.id ?? 'marte-gale-msl',
    [sitioMarteNombre]
  );

  const activeMoonPresetId = useMemo(
    () =>
      ANALOGOS_LUNA_MARTE_PDS.find(
        (p) => p.cuerpo === 'luna' && p.etiquetaSitio === sitioLunaNombre
      )?.id ?? 'luna-mare-ecuador',
    [sitioLunaNombre]
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#07090E] text-slate-100">
      {/* Cinta superior de telemetría del motor gráfico */}
      <div className="border-b border-slate-800 bg-[#0B0E17]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 min-h-11 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            <span className="font-sans font-semibold text-cyan-400">
              {t('Motor Gráfico Canvas 2D', '2D Canvas Physics Engine')}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className={playing ? 'text-emerald-400' : 'text-amber-400'}>
              {playing ? t('● Simulando', '● Simulating') : t('❚❚ Pausado', '❚❚ Paused')}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">
              {canvasSize.w}×{canvasSize.h} @{canvasSize.dpr}x
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">{fps} FPS</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">Zoom {camera.zoom.toFixed(2)}×</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-cyan-300">t = {currentHour.toFixed(1)} h</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-700 text-slate-100 rounded hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              {playing ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  {t('Pausar', 'Pause')}
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  {t('Reproducir', 'Play')}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDropBothProbes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 rounded hover:bg-cyan-500/25 whitespace-nowrap shrink-0"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              {t('Soltar sondas (g)', 'Drop probes (g)')}
            </button>

            <button
              type="button"
              onClick={handleResetCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 rounded hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('Restablecer vista', 'Reset view')}
            </button>

            <button
              type="button"
              onClick={handleExportPng}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 rounded hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {t('Exportar PNG', 'Export PNG')}
            </button>
          </div>
        </div>
      </div>

      {/* Consola asimétrica: En móvil Canvas arriba + controles debajo; en escritorio barra lateral izquierda */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-4 sm:py-5 flex flex-col-reverse lg:flex-row gap-5 items-stretch">
        <aside className="w-full lg:w-[320px] shrink-0 space-y-4">
          {/* Selección de escena / terrenos */}
          <section className="bg-[#0D121D] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-300">
                {t('Escena Planetaria', 'Planetary Scene')}
              </h2>
              <button
                type="button"
                onClick={onSwapSitios}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                {t('Intercambiar', 'Swap')}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onSelectPresetPair('t-m')}
                className="px-2 py-1.5 text-[11px] font-medium bg-slate-900 border border-slate-700 rounded text-slate-200 hover:border-cyan-500/60 whitespace-nowrap truncate"
              >
                {t('Tierra/Marte', 'Earth/Mars')}
              </button>
              <button
                type="button"
                onClick={() => onSelectPresetPair('t-l')}
                className="px-2 py-1.5 text-[11px] font-medium bg-slate-900 border border-slate-700 rounded text-slate-200 hover:border-cyan-500/60 whitespace-nowrap truncate"
              >
                {t('Tierra/Luna', 'Earth/Moon')}
              </button>
              <button
                type="button"
                onClick={() => onSelectPresetPair('m-l')}
                className="px-2 py-1.5 text-[11px] font-medium bg-slate-900 border border-slate-700 rounded text-slate-200 hover:border-cyan-500/60 whitespace-nowrap truncate"
              >
                {t('Marte/Luna', 'Mars/Moon')}
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              <div>
                <label
                  htmlFor="canvas-sitio-a"
                  className="block text-[11px] font-medium text-cyan-400 mb-1"
                >
                  {t('Sitio A (Canal Cian)', 'Site A (Cyan Channel)')}
                </label>
                <select
                  id="canvas-sitio-a"
                  value={sitioAId}
                  onChange={(e) => onChangeSitioAId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {sitios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {translateSiteName(s.nombre, lang)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="canvas-sitio-b"
                  className="block text-[11px] font-medium text-amber-400 mb-1"
                >
                  {t('Sitio B (Canal Ámbar)', 'Site B (Amber Channel)')}
                </label>
                <select
                  id="canvas-sitio-b"
                  value={sitioBId}
                  onChange={(e) => onChangeSitioBId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {sitios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {translateSiteName(s.nombre, lang)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Locaciones calibradas por cuerpo */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400">
                {t('Locación calibrada por cuerpo', 'Calibrated location by body')}
              </div>
              <select
                aria-label={t('Locación Tierra', 'Earth location')}
                value={activeEarthPresetId}
                onChange={(e) => {
                  const found = ANALOGOS_TERRESTRES_NASA.find(
                    (p) => p.id === e.target.value
                  );
                  if (found) onSelectEarthPreset(found);
                }}
                className="w-full px-2.5 py-1.5 text-[11px] bg-slate-950 border border-slate-800 rounded text-slate-200"
              >
                {!activeEarthPresetId && (
                  <option value="">{t('Tierra · Personalizada', 'Earth · Custom')}</option>
                )}
                {ANALOGOS_TERRESTRES_NASA.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t('Tierra', 'Earth')} · {translateSiteName(p.nombre, lang)}
                  </option>
                ))}
              </select>

              <select
                aria-label={t('Locación Marte', 'Mars location')}
                value={activeMarsPresetId}
                onChange={(e) => {
                  const found = ANALOGOS_LUNA_MARTE_PDS.find(
                    (p) => p.id === e.target.value
                  );
                  if (found) onSelectPdsPreset(found);
                }}
                className="w-full px-2.5 py-1.5 text-[11px] bg-slate-950 border border-slate-800 rounded text-slate-200"
              >
                {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'marte').map(
                  (p) => (
                    <option key={p.id} value={p.id}>
                      {t('Marte', 'Mars')} · {translateSiteName(p.nombre, lang)}
                    </option>
                  )
                )}
              </select>

              <select
                aria-label={t('Locación Luna', 'Moon location')}
                value={activeMoonPresetId}
                onChange={(e) => {
                  const found = ANALOGOS_LUNA_MARTE_PDS.find(
                    (p) => p.id === e.target.value
                  );
                  if (found) onSelectPdsPreset(found);
                }}
                className="w-full px-2.5 py-1.5 text-[11px] bg-slate-950 border border-slate-800 rounded text-slate-200"
              >
                {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'luna').map((p) => (
                  <option key={p.id} value={p.id}>
                    {t('Luna', 'Moon')} · {translateSiteName(p.nombre, lang)}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Disposición de cámaras y canal del osciloscopio */}
          <section className="bg-[#0D121D] border border-slate-800 rounded-lg p-4 space-y-3">
            <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-300">
              {t('Modo de Render y Canal', 'Render Mode & Channel')}
            </h2>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-md border border-slate-800">
              {(
                [
                  { id: 'split', label: t('Dividida A | B', 'Split A | B') },
                  { id: 'siteA', label: t('Enfoque A', 'Focus A') },
                  { id: 'siteB', label: t('Enfoque B', 'Focus B') },
                  { id: 'instruments', label: t('Instrumentos', 'Instruments') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setViewportMode(opt.id)}
                  className={`px-2 py-1.5 text-[11px] font-medium rounded whitespace-nowrap transition-colors ${
                    viewportMode === opt.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div>
              <span className="block text-[11px] text-slate-400 mb-1.5">
                {t('Canal de osciloscopio', 'Oscilloscope channel')}
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-md border border-slate-800">
                {(
                  [
                    { id: 'temperatura', label: t('Temp (K)', 'Temp (K)') },
                    { id: 'luz', label: t('Luz (W/m²)', 'Light (W/m²)') },
                    { id: 'viento', label: t('Viento (m/s)', 'Wind (m/s)') },
                    { id: 'presion', label: t('Presión (Pa)', 'Pressure (Pa)') },
                  ] as const
                ).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setOscChannel(ch.id)}
                    className={`px-2 py-1 text-[11px] font-mono rounded whitespace-nowrap transition-colors ${
                      oscChannel === ch.id
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Línea temporal y velocidad */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                <span className="text-slate-400">{t('Cursor temporal', 'Time cursor')}</span>
                <span className="text-cyan-300">{currentHour.toFixed(1)} h</span>
              </div>
              <input
                type="range"
                min={0}
                max={totalSamples - 1}
                step={1}
                value={currentIdx}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  sampleCursorRef.current = val;
                  setSampleCursor(val);
                }}
                aria-label={t('Cursor temporal de simulación', 'Simulation time cursor')}
                className="w-full accent-cyan-400"
              />
              <div className="flex items-center justify-between gap-1 pt-1">
                <span className="text-[11px] text-slate-400">{t('Velocidad', 'Speed')}</span>
                <div className="flex items-center gap-1">
                  {[0.5, 1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSpeed(spd)}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded border ${
                        speed === spd
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {spd}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Capas del motor gráfico */}
          <section className="bg-[#0D121D] border border-slate-800 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-slate-300">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              {t('Capas de Renderizado', 'Render Layers')}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  { key: 'atmosphere', label: t('Atmósfera', 'Atmosphere') },
                  { key: 'terrain', label: t('Relieve suelo', 'Terrain') },
                  { key: 'wind', label: t('Viento y polvo', 'Wind & dust') },
                  { key: 'radiation', label: t('Radiación', 'Radiation') },
                  { key: 'physics', label: t('Física sondas', 'Probe physics') },
                  { key: 'instruments', label: t('Instrumentos', 'Instruments') },
                  { key: 'grid', label: t('Retícula ejes', 'Axis grid') },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="inline-flex items-center gap-2 text-slate-300 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={layers[item.key]}
                    onChange={(e) =>
                      setLayers((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="truncate">{item.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Lectura cuantitativa resumida */}
          <section className="bg-[#0D121D] border border-slate-800 rounded-lg p-4 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                {t('Índice de analogía', 'Analogy index')}
              </span>
              <span className="text-2xl font-mono font-bold tabular-nums text-cyan-300">
                {resultado.total.toFixed(1)}
                <span className="text-xs text-slate-400 ml-1">%</span>
              </span>
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-400 flex justify-between">
              <span>{t('Media directa:', 'Direct mean:')}</span>
              <span className="text-slate-200">{resultado.mediaSimple.toFixed(1)}%</span>
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-400 flex justify-between">
              <span>{t('Peor crítica:', 'Worst critical:')}</span>
              <span className="text-amber-300">
                {translateVariableLabel(resultado.peorCritica.variable, lang)} (
                {resultado.peorCritica.valor.toFixed(1)}%)
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenLab}
              className="w-full mt-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-slate-900 border border-slate-700 text-slate-100 rounded hover:border-cyan-500/50 transition-colors"
            >
              <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
              {t('Abrir mapas satelitales, ML y Firebase', 'Open satellite maps, ML & Firebase')}
            </button>
          </section>
        </aside>

        {/* Escena principal HTML5 <canvas> */}
        <main className="flex-1 min-w-0 flex flex-col gap-3">
          <div
            ref={containerRef}
            className="relative w-full h-[560px] lg:h-[710px] bg-[#07090E] border border-slate-800 rounded-lg overflow-hidden"
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => {
                pointerRef.current = { x: 0, y: 0, inside: false };
                dragRef.current.active = false;
              }}
              onDoubleClick={handleResetCamera}
              onWheel={handleWheel}
              className="w-full h-full block cursor-crosshair touch-none"
            />

            {/* Sonda flotante de coordenadas bajo cursor */}
            <div className="pointer-events-none absolute top-3 right-3 max-w-[270px] bg-[#07090E]/85 border border-slate-700/80 rounded px-3 py-2 text-[11px] font-mono tabular-nums space-y-0.5">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                <Crosshair className="w-3 h-3 shrink-0" />
                <span className="truncate">{hoverInfo.title}</span>
              </div>
              {hoverInfo.lines.map((line, i) => (
                <div key={i} className="text-slate-300 truncate">
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0D121D] border border-slate-800 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              {t(
                `Controles del motor Canvas: arrastra para desplazar cámara, rueda del ratón para zoom, doble clic para centrar y clic sobre el cielo o terreno para soltar una sonda balística bajo gravedad real (${sitioA.g.toFixed(2)} vs ${sitioB.g.toFixed(2)} m/s²).`,
                `Canvas engine controls: drag to pan camera, mouse wheel to zoom, double-click to center, and click sky/terrain to drop a ballistic probe under real gravity (${sitioA.g.toFixed(2)} vs ${sitioB.g.toFixed(2)} m/s²).`
              )}
            </span>
            <span className="font-mono tabular-nums text-slate-300">
              A: {translateSiteName(sitioA.nombre, lang)} · B: {translateSiteName(sitioB.nombre, lang)}
            </span>
          </div>
        </main>
      </div>
    </div>
  );
};
