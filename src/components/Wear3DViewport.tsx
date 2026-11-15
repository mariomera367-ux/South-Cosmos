import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  MapPin,
  RotateCw,
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import {
  translateHardwareInfo,
  translateSiteName,
  translateZoneName,
} from '../lib/translations';
import { SitioAmbiental } from '../lib/analogo';
import {
  CameraPresetId,
  Wear3DSceneParams,
  Wear3DViewportController,
} from '../lib/wear3dScene';
import {
  ComponentPinDiagnostic,
  HardwareSpec,
  RecubrimientoTipo,
  WearVisualMode,
  ZonaDespliegue,
} from '../lib/wearEngine';

export interface Wear3DViewportHandle {
  focusComponent: (pinId: string) => void;
  captureSnapshot: () => string | null;
}

interface Wear3DViewportProps {
  sitio: SitioAmbiental;
  hardware: HardwareSpec;
  recubrimiento: RecubrimientoTipo;
  zona: ZonaDespliegue;
  dias: number;
  visualMode: WearVisualMode;
  onChangeVisualMode: (mode: WearVisualMode) => void;
  showPins: boolean;
  onTogglePins: () => void;
  showDustEffect: boolean;
  onToggleDustEffect: () => void;
  selectedPinId: string | null;
  pinDiagnostics: ComponentPinDiagnostic[];
  onSelectPin: (pinId: string) => void;
}

export const Wear3DViewport = forwardRef<Wear3DViewportHandle, Wear3DViewportProps>(
  (
    {
      sitio,
      hardware,
      recubrimiento,
      zona,
      dias,
      visualMode,
      onChangeVisualMode,
      showPins,
      onTogglePins,
      showDustEffect,
      onToggleDustEffect,
      selectedPinId,
      pinDiagnostics,
      onSelectPin,
    },
    ref
  ) => {
    const { lang, t } = useLanguage();
    const mountRef = useRef<HTMLDivElement | null>(null);
    const ctrlRef = useRef<Wear3DViewportController | null>(null);

    const [autoRotate, setAutoRotate] = useState<boolean>(true);
    const [dockExpanded, setDockExpanded] = useState<boolean>(true);
    const [contextLost, setContextLost] = useState<boolean>(false);

    const onSelectPinRef = useRef(onSelectPin);
    onSelectPinRef.current = onSelectPin;

    const latestParams: Wear3DSceneParams = {
      sitio,
      hardware,
      recubrimiento,
      zona,
      dias,
      visualMode,
      showPins,
      showDustEffect,
      selectedPinId,
      pinDiagnostics,
      autoRotate,
    };
    const latestParamsRef = useRef(latestParams);
    latestParamsRef.current = latestParams;

    useImperativeHandle(ref, () => ({
      focusComponent: (pinId: string) => {
        ctrlRef.current?.focusOnComponent(pinId);
      },
      captureSnapshot: () => {
        return ctrlRef.current ? ctrlRef.current.captureDataUrl() : null;
      },
    }));

    useEffect(() => {
      const el = mountRef.current;
      if (!el) return;

      const controller = new Wear3DViewportController(
        el,
        latestParamsRef.current,
        (pinId) => onSelectPinRef.current(pinId),
        (lost) => setContextLost(lost)
      );
      ctrlRef.current = controller;

      const ro = new ResizeObserver(() => {
        controller.resize();
      });
      ro.observe(el);

      return () => {
        ro.disconnect();
        controller.dispose();
        ctrlRef.current = null;
      };
    }, []);

    useEffect(() => {
      ctrlRef.current?.syncParams({
        sitio,
        hardware,
        recubrimiento,
        zona,
        dias,
        visualMode,
        showPins,
        showDustEffect,
        selectedPinId,
        pinDiagnostics,
        autoRotate,
      });
    }, [
      sitio,
      hardware,
      recubrimiento,
      zona,
      dias,
      visualMode,
      showPins,
      showDustEffect,
      selectedPinId,
      pinDiagnostics,
      autoRotate,
    ]);

    return (
      <div className="relative w-full h-[380px] sm:h-[460px] lg:h-[540px] bg-[#07090E] border border-slate-800 rounded-lg overflow-hidden select-none">
        {/* Contenedor WebGL aislado (sin backdrop-blur encima) */}
        <div ref={mountRef} className="w-full h-full" />

        {contextLost && (
          <div className="absolute inset-0 bg-[#07090E]/95 flex flex-col items-center justify-center p-6 text-center z-20">
            <p className="text-sm font-semibold text-amber-300">
              {t('Visor WebGL suspendido temporalmente', 'WebGL Viewport Temporarily Suspended')}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              {t(
                'El navegador liberó el contexto gráfico 3D. Puedes seguir consultando todos los cálculos numéricos y recargar la pestaña para reiniciar WebGL.',
                'The browser released the 3D graphics context. You can continue inspecting numerical results and reload the tab to restore WebGL.'
              )}
            </p>
          </div>
        )}

        {/* Etiqueta minimal superior izquierda */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none max-w-[85%]">
          <div className="bg-[#0D121D]/90 border border-slate-800 rounded px-3 py-1.5 space-y-0.5">
            <div className="text-xs font-semibold text-slate-100 truncate">
              {translateHardwareInfo(hardware, lang).nombre}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-400 flex flex-wrap items-center gap-x-2">
              <span className="text-cyan-300 truncate max-w-[200px]">
                {translateSiteName(sitio.nombre, lang)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{t('Día', 'Day')} {dias}</span>
              <span aria-hidden="true">·</span>
              <span>{translateZoneName(zona.id, zona.nombre, lang).split('(')[0].trim()}</span>
            </div>
          </div>
        </div>

        {/* Barra de control inferior plegable (Dock WebGL limpio) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-24px)] max-w-[740px] flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium bg-[#0D121D] border border-b-0 border-slate-700 rounded-t-md text-slate-300 hover:text-cyan-300 transition-colors"
          >
            {dockExpanded ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                {t('Ocultar controles 3D', 'Hide 3D controls')}
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                {t('Mostrar controles 3D', 'Show 3D controls')}
              </>
            )}
          </button>

          {dockExpanded && (
            <div className="w-full bg-[#0D121D]/95 border border-slate-700 rounded-lg p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              {/* Selector de capa visual */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
                {(
                  [
                    { id: 'fisico', label: t('Físico PBR', 'Physical PBR') },
                    { id: 'termico', label: t('Térmico ΔT', 'Thermal ΔT') },
                    { id: 'mecanico', label: t('Abrasión', 'Abrasion') },
                    { id: 'radiacion', label: t('Radiación', 'Radiation') },
                  ] as Array<{ id: WearVisualMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeVisualMode(m.id)}
                    className={`min-h-[36px] px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                      visualMode === m.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Cámara + Toggles */}
              <div className="flex items-center justify-between sm:justify-end gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'orbital', label: t('orbital', 'orbit') },
                      { id: 'frontal', label: t('frontal', 'front') },
                      { id: 'lateral', label: t('lateral', 'side') },
                      { id: 'superior', label: t('superior', 'top') },
                    ] as Array<{ id: CameraPresetId; label: string }>
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => ctrlRef.current?.setCameraPreset(cam.id)}
                      className="min-h-[36px] px-2 py-1 text-[11px] font-mono bg-[#07090E] border border-slate-800 hover:border-slate-600 rounded text-slate-300 capitalize whitespace-nowrap"
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onTogglePins}
                    title={t('Mostrar / Ocultar pines de componentes 3D', 'Show / Hide 3D component pins')}
                    className={`min-h-[36px] px-2 py-1 text-[11px] rounded border inline-flex items-center gap-1 whitespace-nowrap ${
                      showPins
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-[#07090E] border-slate-800 text-slate-400'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    {t('Pines', 'Pins')}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleDustEffect}
                    title={t('Activar / Desactivar polvo y microfisuras', 'Toggle dust & microcracks')}
                    className={`min-h-[36px] px-2 py-1 text-[11px] rounded border inline-flex items-center gap-1 whitespace-nowrap ${
                      showDustEffect
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-[#07090E] border-slate-800 text-slate-400'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    {t('Polvo', 'Dust')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoRotate((v) => !v)}
                    title={t('Rotación orbital automática', 'Automatic orbital rotation')}
                    className={`min-h-[36px] min-w-[36px] px-2 py-1 text-[11px] rounded border inline-flex items-center justify-center ${
                      autoRotate
                        ? 'bg-slate-800 border-slate-600 text-cyan-300'
                        : 'bg-[#07090E] border-slate-800 text-slate-400'
                    }`}
                    aria-label={t('Alternar rotación orbital', 'Toggle orbital rotation')}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

Wear3DViewport.displayName = 'Wear3DViewport';
