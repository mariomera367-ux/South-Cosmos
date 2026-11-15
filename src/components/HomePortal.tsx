import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Compass,
  Cpu,
  FlaskConical,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  PerfilRecomendacion,
  recomendarAnalogosTerrestres,
  sitioDesdePresetPds,
} from '../lib/analogo';
import { useLanguage } from '../lib/i18n';
import {
  translateEarthRecommendationSummary,
  translateSiteName,
} from '../lib/translations';

interface HomePortalProps {
  onLaunchWearStudio: (targetPdsId: string, hardwareId: string) => void;
  onNavigateView: (view: 'canvas' | 'laboratorio', anchor?: string) => void;
}

export const HomePortal: React.FC<HomePortalProps> = ({
  onLaunchWearStudio,
  onNavigateView,
}) => {
  const { lang, t } = useLanguage();
  const [quickTargetId, setQuickTargetId] = useState<string>('marte-jezero-2020');
  const [quickHardwareId, setQuickHardwareId] = useState<string>('rover-6x6');

  const pdsObj = useMemo(
    () =>
      ANALOGOS_LUNA_MARTE_PDS.find((p) => p.id === quickTargetId) ??
      ANALOGOS_LUNA_MARTE_PDS[0],
    [quickTargetId]
  );

  const perfilQuick: PerfilRecomendacion =
    quickHardwareId === 'traje-eva'
      ? 'traje'
      : quickHardwareId === 'base-permanente'
        ? 'base'
        : 'rover';

  const topEarthRec = useMemo(() => {
    const dest = sitioDesdePresetPds(pdsObj);
    return recomendarAnalogosTerrestres(dest, perfilQuick)[0];
  }, [pdsObj, perfilQuick]);

  // Fondo vivo sutil en HTML5 Canvas
  const bgWrapRef = useRef<HTMLDivElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let tAnim = 0;

    const draw = () => {
      tAnim += 0.008;
      const wrap = bgWrapRef.current;
      const canvas = bgCanvasRef.current;
      if (wrap && canvas) {
        const w = Math.max(320, Math.floor(wrap.clientWidth));
        const h = Math.max(260, Math.floor(wrap.clientHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = '#07090E';
          ctx.fillRect(0, 0, w, h);

          // Estrellas suaves
          for (let i = 0; i < 85; i++) {
            const x = (((i * 173 + 31) % 1000) / 1000) * w;
            const y = (((i * 97 + 19) % 720) / 1000) * h;
            const tw = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(tAnim * 2 + i));
            ctx.fillStyle = `rgba(226, 232, 240, ${tw})`;
            ctx.fillRect(x, y, 1.3, 1.3);
          }

          // Grilla orbital sutil
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
          ctx.lineWidth = 1;
          for (let x = 0; x < w; x += 64) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }

          // Arco planetario inferior (Tierra cian + Luna/Marte ámbar)
          const rad = Math.max(w * 0.65, 540);
          const cx = w * 0.72;
          const cy = h + rad * 0.78;
          const glow = ctx.createRadialGradient(cx, cy - rad, 20, cx, cy - rad, 240);
          glow.addColorStop(0, pdsObj.cuerpo === 'luna' ? 'rgba(6, 182, 212, 0.22)' : 'rgba(245, 158, 11, 0.22)');
          glow.addColorStop(1, 'rgba(7, 9, 14, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = pdsObj.cuerpo === 'luna' ? 'rgba(6, 182, 212, 0.45)' : 'rgba(245, 158, 11, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();

          // Trayectoria orbital animada
          const satAngle = Math.PI * (1.28 + 0.35 * (0.5 + 0.5 * Math.sin(tAnim * 0.7)));
          const sx = cx + Math.cos(satAngle) * (rad + 26);
          const sy = cy + Math.sin(satAngle) * (rad + 26);
          ctx.fillStyle = '#06B6D4';
          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [pdsObj.cuerpo]);

  return (
    <div className="flex-1 flex flex-col bg-[#07090E] text-slate-100">
      {/* Hero interactivo respaldado por Canvas */}
      <div
        ref={bgWrapRef}
        className="relative border-b border-slate-800 overflow-hidden"
      >
        <canvas
          ref={bgCanvasRef}
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 py-8 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              {t(
                'Plataforma de Simulación y Análogos Planetarios · Motor Canvas 2D',
                'Planetary Analog & Simulation Platform · 2D Canvas Engine'
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-100 leading-tight">
              {t(
                'Simula el desgaste de tu hardware y encuentra su campo de pruebas ideal en la Tierra',
                'Simulate hardware wear and find its ideal terrestrial testbed on Earth'
              )}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              {t(
                'Elige cualquier cráter o zona de la Luna y Marte, coloca rovers, trajes EVA, bases permanentes o sube tus propios modelos 3D/planos para evaluar abrasión, choque térmico y radiación con el motor Canvas, mientras calculamos el mejor análogo terrestre según los 9 factores ambientales.',
                'Pick any crater or landing site on the Moon or Mars, deploy rovers, EVA suits, permanent habitats, or upload your own 3D models to evaluate abrasion, thermal shock, and radiation while computing the closest Earth analog across 9 environmental dimensions.'
              )}
            </p>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onLaunchWearStudio(quickTargetId, quickHardwareId)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 transition-colors"
              >
                {t('Iniciar pruebas de desgaste 3D', 'Launch 3D Wear Testing')}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateView('canvas')}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-100 bg-[#0D121D] border border-slate-700 rounded-md hover:border-cyan-400 transition-colors"
              >
                <Layers className="w-4 h-4 text-cyan-400" />
                {t('Abrir Motor Físico 2D', 'Open 2D Physics Engine')}
              </button>
            </div>
          </div>

          {/* Asistente rápido de inicio amigable */}
          <div className="lg:col-span-5 bg-[#0D121D]/95 border border-slate-800 rounded-lg p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                {t('Asistente rápido de simulación', 'Quick Simulation Assistant')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t(
                  'Selecciona destino y equipo para calcular al instante el mejor sitio en la Tierra',
                  'Choose target and hardware to compute the best Earth analog site instantly'
                )}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label
                  htmlFor="home-target-select"
                  className="block font-medium text-slate-300 mb-1"
                >
                  {t(
                    '¿Dónde operará la misión? (Luna o Marte)',
                    'Where will the mission operate? (Moon or Mars)'
                  )}
                </label>
                <select
                  id="home-target-select"
                  value={quickTargetId}
                  onChange={(e) => setQuickTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  <optgroup label={t('Marte', 'Mars')}>
                    {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'marte').map((p) => (
                      <option key={p.id} value={p.id}>
                        {t('Marte', 'Mars')} · {translateSiteName(p.nombre, lang)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('Luna', 'Moon')}>
                    {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'luna').map((p) => (
                      <option key={p.id} value={p.id}>
                        {t('Luna', 'Moon')} · {translateSiteName(p.nombre, lang)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label
                  htmlFor="home-hw-select"
                  className="block font-medium text-slate-300 mb-1"
                >
                  {t(
                    '¿Qué equipo o estructura vas a probar?',
                    'Which hardware or structure will you test?'
                  )}
                </label>
                <select
                  id="home-hw-select"
                  value={quickHardwareId}
                  onChange={(e) => setQuickHardwareId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="rover-6x6">
                    {t('Rover 6x6 Explorador', '6x6 Explorer Rover')}
                  </option>
                  <option value="traje-eva">
                    {t('Traje Espacial EVA', 'EVA Space Suit')}
                  </option>
                  <option value="base-permanente">
                    {t('Base Permanente (Domo + Esclusa)', 'Permanent Habitat (Dome + Airlock)')}
                  </option>
                </select>
              </div>
            </div>

            {topEarthRec && (
              <div className="p-3 rounded-md bg-[#07090E] border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-amber-300">
                    {t('ANÁLOGO TERRESTRE SUGERIDO', 'SUGGESTED EARTH ANALOG')}
                  </span>
                  <span className="text-cyan-300 font-bold tabular-nums">
                    {topEarthRec.puntuacionPrueba.toFixed(1)}% {t('aptitud', 'fit')}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {translateSiteName(topEarthRec.preset.nombre, lang)}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {translateEarthRecommendationSummary(topEarthRec, lang)}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => onLaunchWearStudio(quickTargetId, quickHardwareId)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 transition-colors"
            >
              {t('Simular desgaste en Entorno 3D', 'Simulate Wear in 3D Environment')}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Accesos directos amigables a todos los módulos */}
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-7 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-100">
            {t('Módulos del Entorno Canvas', 'Canvas Environment Modules')}
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {t(
              'Todos sincronizados con el mismo modelo físico',
              'All synchronized with the same physics core'
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onLaunchWearStudio(quickTargetId, quickHardwareId)}
            className="text-left p-5 bg-[#0D121D] border border-slate-800 rounded-lg hover:border-cyan-500/60 transition-colors space-y-2.5 group"
          >
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
            <div className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
              {t('Estudio 3D de Pruebas de Desgaste', '3D Hardware Wear Test Studio')}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t(
                'Visor WebGL interactivo con capas térmica/abrasión/radiación, pines 3D por pieza, comparador de aleaciones NASA, blindaje g/cm² y ciclos día–noche.',
                'Interactive WebGL viewport with thermal/abrasion/radiation layers, 3D component pins, NASA alloy comparator, g/cm² radiation shielding, and day–night thermal cycles.'
              )}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateView('canvas')}
            className="text-left p-5 bg-[#0D121D] border border-slate-800 rounded-lg hover:border-cyan-500/60 transition-colors space-y-2.5 group"
          >
            <Cpu className="w-5 h-5 text-amber-400" />
            <div className="text-sm font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
              {t('Motor Físico Canvas 2D', '2D Canvas Physics Engine')}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t(
                'Visualiza en tiempo real atmósfera, viento, polvo, radiación cósmica, relieve y sondas de caída gravitacional lado a lado.',
                'Visualize atmosphere, wind, dust, cosmic radiation, terrain relief, and gravitational drop probes side-by-side in real time.'
              )}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateView('laboratorio', 'pds-planetario')}
            className="text-left p-5 bg-[#0D121D] border border-slate-800 rounded-lg hover:border-cyan-500/60 transition-colors space-y-2.5 group"
          >
            <FlaskConical className="w-5 h-5 text-cyan-400" />
            <div className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
              {t('Satélites, Datos NASA y ML', 'Satellites, NASA Data & ML')}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t(
                'Mapas satelitales 2D/3D (Google Earth, Luna y Marte PDS), osciloscopio Canvas, composición mineral y ensambles de Machine Learning.',
                '2D/3D satellite maps (Google Earth, Moon & Mars PDS), Canvas oscilloscope, mineral composition, and Machine Learning ensembles.'
              )}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
