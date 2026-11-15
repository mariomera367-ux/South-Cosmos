import React, { useEffect, useState } from 'react';
import { Compass, ExternalLink, MapPin, RefreshCw, Search } from 'lucide-react';
import {
  ANALOGOS_TERRESTRES_NASA,
  SerieMedidaNASA,
} from '../lib/analogo';
import { useLanguage } from '../lib/i18n';
import { translateSiteName } from '../lib/translations';
import { GoogleSatelliteMap } from './GoogleSatelliteMap';

interface CmrCollection {
  id: string;
  title: string;
  shortName: string;
  versionId: string;
  dataCenter: string;
  summary: string;
  timeStart: string | null;
  timeEnd: string | null;
  earthdataUrl: string;
}

interface MapsGroundingSnippet {
  author: string | null;
  text: string;
  uri: string | null;
}

interface MapsGroundingPlace {
  title: string;
  uri: string;
  placeId: string | null;
  reviewSnippets: MapsGroundingSnippet[];
}

interface MapsGroundingResult {
  respuestaMarkdown: string;
  lugares: MapsGroundingPlace[];
  lat: number | null;
  lon: number | null;
  consulta: string;
  modelo: string;
}

interface EarthdataPanelProps {
  usarNasaEnVivo: boolean;
  onToggleNasaEnVivo: (usar: boolean) => void;
  lat: number;
  lon: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChangeUbicacion: (
    lat: number,
    lon: number,
    nombreSitio?: string,
    presetMeta?: {
      T?: [number, number];
      P?: [number, number];
      viento?: [number, number];
      luz?: [number, number | null];
      suelo?: Record<string, number>;
      pendiente: number;
      rugosidad: number;
      radiacion: number;
      queryCmr: string;
    }
  ) => void;
  onChangeFechas: (start: string, end: string) => void;
  onSerieCargada: (serie: SerieMedidaNASA) => void;
  serieActual: SerieMedidaNASA | null | undefined;
}

const CAPAS_WORLDVIEW = [
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    nombre: 'MODIS Terra · Color real',
    nombreEn: 'MODIS Terra · True Color',
  },
  {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    nombre: 'VIIRS Suomi NPP · Color real',
    nombreEn: 'VIIRS Suomi NPP · True Color',
  },
  {
    id: 'MODIS_Terra_Land_Surface_Temp_Day',
    nombre: 'MODIS Terra · Temperatura superficial día',
    nombreEn: 'MODIS Terra · Daytime Land Surface Temp',
  },
];

const DEFAULT_MAPS_QUERY_ES =
  'Estaciones científicas, accesos logísticos, campamentos base y rasgos geológicos cercanos';
const DEFAULT_MAPS_QUERY_EN =
  'Nearby research stations, logistical access routes, base camps, and geological features';

export const EarthdataPanel: React.FC<EarthdataPanelProps> = ({
  usarNasaEnVivo,
  onToggleNasaEnVivo,
  lat,
  lon,
  startDate,
  endDate,
  onChangeUbicacion,
  onChangeFechas,
  onSerieCargada,
  serieActual,
}) => {
  const { lang, t } = useLanguage();
  const [presetSeleccionado, setPresetSeleccionado] = useState<string>('atacama-yungay');
  const [latInput, setLatInput] = useState<string>(lat.toFixed(2));
  const [lonInput, setLonInput] = useState<string>(lon.toFixed(2));

  const [cargandoPower, setCargandoPower] = useState<boolean>(false);
  const [errorPower, setErrorPower] = useState<string | null>(null);

  const [visorSatelital, setVisorSatelital] = useState<
    'google-2d' | 'google-3d' | 'worldview'
  >('google-2d');
  const [capaWorldview, setCapaWorldview] = useState<string>(
    'MODIS_Terra_CorrectedReflectance_TrueColor'
  );
  const [spanWorldview, setSpanWorldview] = useState<number>(2.5);
  const [imgError, setImgError] = useState<boolean>(false);

  const [cmrQuery, setCmrQuery] = useState<string>('MERRA-2');
  const [cmrFiltrarPunto, setCmrFiltrarPunto] = useState<boolean>(true);
  const [cmrHits, setCmrHits] = useState<number>(0);
  const [cmrResultados, setCmrResultados] = useState<CmrCollection[]>([]);
  const [cargandoCmr, setCargandoCmr] = useState<boolean>(false);
  const [errorCmr, setErrorCmr] = useState<string | null>(null);

  const [mapsQuery, setMapsQuery] = useState<string>(
    lang === 'en' ? DEFAULT_MAPS_QUERY_EN : DEFAULT_MAPS_QUERY_ES
  );
  const [mapsLoading, setMapsLoading] = useState<boolean>(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsResult, setMapsResult] = useState<MapsGroundingResult | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  useEffect(() => {
    setMapsQuery((prev) => {
      if (prev === DEFAULT_MAPS_QUERY_ES || prev === DEFAULT_MAPS_QUERY_EN) {
        return lang === 'en' ? DEFAULT_MAPS_QUERY_EN : DEFAULT_MAPS_QUERY_ES;
      }
      return prev;
    });
  }, [lang]);

  const lastFetchedCoord = React.useRef<string>(`${lat.toFixed(3)},${lon.toFixed(3)}`);

  useEffect(() => {
    setLatInput(lat.toFixed(2));
    setLonInput(lon.toFixed(2));
    const match = ANALOGOS_TERRESTRES_NASA.find(
      (p) => Math.abs(p.lat - lat) < 0.02 && Math.abs(p.lon - lon) < 0.02
    );
    if (match) {
      setPresetSeleccionado(match.id);
      setCmrQuery(match.queryCmr);
    }
    const coordKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (lastFetchedCoord.current !== coordKey) {
      lastFetchedCoord.current = coordKey;
      setImgError(false);
      cargarPower(lat, lon, startDate, endDate);
      if (match) {
        buscarCmr(match.queryCmr, cmrFiltrarPunto, lat, lon);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  const cargarPower = async (
    targetLat: number,
    targetLon: number,
    sDate: string,
    eDate: string
  ) => {
    setCargandoPower(true);
    setErrorPower(null);
    try {
      const start = sDate.replace(/-/g, '');
      const end = eDate.replace(/-/g, '');
      const res = await fetch(
        `/api/earthdata/power?lat=${encodeURIComponent(
          targetLat
        )}&lon=${encodeURIComponent(targetLon)}&start=${start}&end=${end}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || t('Error al obtener datos de NASA POWER', 'Error fetching NASA POWER data')
        );
      }
      onSerieCargada({
        fuente: data.source,
        lat: data.lat,
        lon: data.lon,
        elevacionM: data.elevacionM,
        start: data.start,
        end: data.end,
        horas: data.horas,
        etiquetas: data.etiquetas,
        temperaturaK: data.temperaturaK,
        presionPa: data.presionPa,
        vientoMs: data.vientoMs,
        luzWm2: data.luzWm2,
      });
    } catch (err) {
      setErrorPower(
        err instanceof Error
          ? err.message
          : t('Error consultando NASA Earthdata', 'Error querying NASA Earthdata')
      );
    } finally {
      setCargandoPower(false);
    }
  };

  const buscarCmr = async (
    keyword: string,
    usarPunto: boolean,
    targetLat: number,
    targetLon: number
  ) => {
    setCargandoCmr(true);
    setErrorCmr(null);
    try {
      const params = new URLSearchParams({
        keyword: keyword.trim(),
        page_size: '5',
      });
      if (usarPunto) {
        params.set('lat', String(targetLat));
        params.set('lon', String(targetLon));
      }
      const res = await fetch(`/api/earthdata/cmr?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || t('Error consultando NASA CMR', 'Error querying NASA CMR')
        );
      }
      setCmrHits(data.totalHits ?? 0);
      setCmrResultados(data.entries ?? []);
    } catch (err) {
      setErrorCmr(
        err instanceof Error
          ? err.message
          : t('Error consultando Earthdata Search', 'Error querying Earthdata Search')
      );
    } finally {
      setCargandoCmr(false);
    }
  };

  // Carga inicial automática de datos reales de NASA Earthdata y catálogo CMR
  useEffect(() => {
    cargarPower(lat, lon, startDate, endDate);
    buscarCmr('MERRA-2', true, lat, lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeleccionarPreset = (id: string) => {
    setPresetSeleccionado(id);
    const p = ANALOGOS_TERRESTRES_NASA.find((item) => item.id === id);
    if (!p) return;
    lastFetchedCoord.current = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
    setImgError(false);
    setCmrQuery(p.queryCmr);
    onChangeUbicacion(p.lat, p.lon, p.etiquetaSitio, {
      T: p.T,
      P: p.P,
      viento: p.viento,
      luz: p.luz,
      suelo: p.suelo,
      pendiente: p.pendiente,
      rugosidad: p.rugosidad,
      radiacion: p.radiacion,
      queryCmr: p.queryCmr,
    });
    cargarPower(p.lat, p.lon, startDate, endDate);
    buscarCmr(p.queryCmr, cmrFiltrarPunto, p.lat, p.lon);
  };

  const consultarMaps = async (
    targetLat: number = lat,
    targetLon: number = lon,
    overrideQuery?: string
  ) => {
    const q = (overrideQuery ?? mapsQuery).trim();
    if (!q) {
      setMapsError(
        t('Ingresa una consulta geográfica para Google Maps.', 'Enter a geographic query for Google Maps.')
      );
      return;
    }
    setMapsLoading(true);
    setMapsError(null);
    try {
      const res = await fetch('/api/earthdata/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consulta: q,
          lat: targetLat,
          lon: targetLon,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            t('Error al consultar Google Maps Grounding', 'Error querying Google Maps Grounding')
        );
      }
      setMapsResult(data as MapsGroundingResult);
    } catch (err) {
      setMapsError(
        err instanceof Error
          ? err.message
          : t('Error consultando Google Maps Grounding', 'Error querying Google Maps Grounding')
      );
    } finally {
      setMapsLoading(false);
    }
  };

  const usarMiUbicacionMaps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMapsError(
        t('El navegador no soporta geolocalización.', 'Geolocation is not supported by this browser.')
      );
      return;
    }
    setGeoStatus(t('Solicitando coordenadas...', 'Requesting coordinates...'));
    setMapsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myLat = Number(pos.coords.latitude.toFixed(4));
        const myLon = Number(pos.coords.longitude.toFixed(4));
        setGeoStatus(
          t(
            `Ubicación detectada: ${myLat}°, ${myLon}°`,
            `Location detected: ${myLat}°, ${myLon}°`
          )
        );
        setPresetSeleccionado('personalizado');
        setImgError(false);
        onChangeUbicacion(
          myLat,
          myLon,
          `Tierra (${myLat.toFixed(2)}°, ${myLon.toFixed(2)}° · GPS)`
        );
        consultarMaps(myLat, myLon);
      },
      (err) => {
        setGeoStatus(null);
        setMapsError(
          err.message ||
            t(
              'No se pudo obtener la ubicación del navegador. Se usarán las coordenadas del panel.',
              'Could not obtain browser location. Panel coordinates will be used.'
            )
        );
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleAplicarCoordenadas = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = Math.max(-89.5, Math.min(89.5, Number(latInput) || 0));
    const parsedLon = Math.max(-180, Math.min(180, Number(lonInput) || 0));
    setPresetSeleccionado('personalizado');
    setImgError(false);
    onChangeUbicacion(
      parsedLat,
      parsedLon,
      `Tierra (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}° · NASA)`
    );
    cargarPower(parsedLat, parsedLon, startDate, endDate);
    if (cmrFiltrarPunto) {
      buscarCmr(cmrQuery, true, parsedLat, parsedLon);
    }
  };

  const worldviewImgUrl = `/api/earthdata/worldview?lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&span=${spanWorldview}&date=${encodeURIComponent(
    startDate
  )}&layer=${encodeURIComponent(capaWorldview)}`;

  const worldviewDeepLink = `https://worldview.earthdata.nasa.gov/?v=${(
    lon - spanWorldview
  ).toFixed(2)},${(lat - spanWorldview).toFixed(2)},${(lon + spanWorldview).toFixed(
    2
  )},${(lat + spanWorldview).toFixed(2)}&t=${startDate}-T12%3A00%3A00Z`;

  const googleEarthDeepLink = `https://earth.google.com/web/@${lat.toFixed(
    5
  )},${lon.toFixed(5)},1500a,12000d,35y,0h,45t,0r`;

  const earthdataSearchDeepLink = `https://search.earthdata.nasa.gov/search?q=${encodeURIComponent(
    cmrQuery || 'Atacama'
  )}`;

  const sitioPresetActivo = ANALOGOS_TERRESTRES_NASA.find(
    (p) => p.id === presetSeleccionado
  );
  const etiquetaMapaActual = sitioPresetActivo
    ? translateSiteName(sitioPresetActivo.nombre, lang)
    : t(
        `Coordenadas (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
        `Coordinates (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`
      );

  return (
    <section
      id="earthdata"
      className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden"
    >
      {/* Cabecera de integración NASA Earthdata, Google Earth y Worldview */}
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            {t(
              'Datos terrestres en vivo: NASA Earthdata, Google Earth & Worldview',
              'Live Earth Data: NASA Earthdata, Google Earth & Worldview'
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t(
              'Observaciones horarias reales (NASA POWER), imágenes satelitales 2D/3D de Google Earth / Maps, Worldview GIBS y catálogo CMR',
              'Real hourly observations (NASA POWER), Google Earth / Maps 2D/3D satellite imagery, Worldview GIBS, and CMR catalog'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => onToggleNasaEnVivo(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                usarNasaEnVivo
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {t('NASA Earthdata en vivo', 'Live NASA Earthdata')}
            </button>
            <button
              type="button"
              onClick={() => onToggleNasaEnVivo(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                !usarNasaEnVivo
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {t('Modelo sintético (analogo.py)', 'Synthetic model (analogo.py)')}
            </button>
          </div>
        </div>
      </div>

      {/* Selector de análogo terrestre, coordenadas y fechas */}
      <div className="px-5 py-4 bg-[#0B0E17] border-b border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="select-tierra-preset"
              className="text-xs font-medium text-slate-400 whitespace-nowrap"
            >
              {t('Análogos terrestres', 'Earth analogues')} ({ANALOGOS_TERRESTRES_NASA.length}):
            </label>
            <select
              id="select-tierra-preset"
              value={presetSeleccionado === 'personalizado' ? '' : presetSeleccionado}
              onChange={(e) => {
                if (e.target.value) handleSeleccionarPreset(e.target.value);
              }}
              className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100 font-medium"
            >
              {presetSeleccionado === 'personalizado' && (
                <option value="">
                  {t('Coordenadas personalizadas', 'Custom coordinates')}
                </option>
              )}
              {ANALOGOS_TERRESTRES_NASA.map((p) => (
                <option key={p.id} value={p.id}>
                  {translateSiteName(p.nombre, lang)} ({p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°)
                </option>
              ))}
            </select>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {t('Selección rápida o coordenadas manuales', 'Quick preset or manual coordinates')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {ANALOGOS_TERRESTRES_NASA.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSeleccionarPreset(p.id)}
              className={`px-2 py-1 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
                presetSeleccionado === p.id
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              {translateSiteName(p.nombre, lang)}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleAplicarCoordenadas}
          className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end"
        >
          <div>
            <label
              htmlFor="nasa-lat"
              className="block text-[11px] font-medium text-slate-400 mb-1"
            >
              {t('Latitud (°)', 'Latitude (°)')}
            </label>
            <input
              id="nasa-lat"
              type="number"
              step="0.01"
              min="-89.5"
              max="89.5"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 text-slate-100 rounded"
            />
          </div>
          <div>
            <label
              htmlFor="nasa-lon"
              className="block text-[11px] font-medium text-slate-400 mb-1"
            >
              {t('Longitud (°)', 'Longitude (°)')}
            </label>
            <input
              id="nasa-lon"
              type="number"
              step="0.01"
              min="-180"
              max="180"
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 text-slate-100 rounded"
            />
          </div>
          <div>
            <label
              htmlFor="nasa-start"
              className="block text-[11px] font-medium text-slate-400 mb-1"
            >
              {t('Fecha inicio', 'Start date')}
            </label>
            <input
              id="nasa-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setImgError(false);
                onChangeFechas(e.target.value, endDate);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 text-slate-100 rounded"
            />
          </div>
          <div>
            <label
              htmlFor="nasa-end"
              className="block text-[11px] font-medium text-slate-400 mb-1"
            >
              {t('Fecha fin', 'End date')}
            </label>
            <input
              id="nasa-end"
              type="date"
              value={endDate}
              onChange={(e) => onChangeFechas(startDate, e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 text-slate-100 rounded"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={cargandoPower}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${cargandoPower ? 'animate-spin' : ''}`}
              />
              {cargandoPower
                ? t('Consultando NASA...', 'Querying NASA...')
                : t('Actualizar datos NASA', 'Refresh NASA data')}
            </button>
            {serieActual && (
              <span className="text-[11px] font-mono tabular-nums text-slate-400 truncate">
                {serieActual.horas.length} h · {t('elev.', 'elev.')}{' '}
                {serieActual.elevacionM !== null
                  ? `${serieActual.elevacionM.toFixed(0)} m`
                  : 'N/A'}
              </span>
            )}
          </div>
        </form>

        {errorPower && (
          <div className="text-xs text-rose-400 font-medium">
            {t('Error NASA POWER:', 'NASA POWER Error:')} {errorPower}
          </div>
        )}
      </div>

      {/* Dos columnas: Visor Satelital + Catálogo NASA Earthdata Search */}
      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
        {/* Visor Satelital Dual: Google Earth / Maps & NASA Worldview */}
        <div className="xl:col-span-6 p-5 flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {visorSatelital === 'worldview'
                  ? t('Visor satelital NASA Worldview (GIBS)', 'NASA Worldview Satellite Viewer (GIBS)')
                  : visorSatelital === 'google-3d'
                    ? t('Visor orbital Google Earth 3D (Maps JS)', 'Google Earth 3D Orbital Viewer (Maps JS)')
                    : t('Visor satelital Google Maps / Earth (2D)', 'Google Maps / Earth Satellite Viewer (2D)')}
              </h3>
              <p className="text-[11px] font-mono tabular-nums text-slate-400">
                {t('Centro', 'Center')} ({lat.toFixed(4)}°, {lon.toFixed(4)}°)
                {visorSatelital === 'worldview'
                  ? ` · ${t('fecha', 'date')} ${startDate} · ±${spanWorldview}°`
                  : ` · ${etiquetaMapaActual}`}
              </p>
            </div>
            <a
              href={
                visorSatelital === 'worldview'
                  ? worldviewDeepLink
                  : googleEarthDeepLink
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline whitespace-nowrap shrink-0"
            >
              {visorSatelital === 'worldview'
                ? t('Abrir en Worldview', 'Open in Worldview')
                : t('Abrir en Google Earth', 'Open in Google Earth')}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md w-fit">
            <button
              type="button"
              onClick={() => setVisorSatelital('google-2d')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                visorSatelital === 'google-2d'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {t('Google Satélite', 'Google Satellite')}
            </button>
            <button
              type="button"
              onClick={() => setVisorSatelital('google-3d')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                visorSatelital === 'google-3d'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Google Earth 3D
            </button>
            <button
              type="button"
              onClick={() => setVisorSatelital('worldview')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                visorSatelital === 'worldview'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              NASA Worldview (GIBS)
            </button>
          </div>

          {visorSatelital !== 'worldview' ? (
            <GoogleSatelliteMap
              lat={lat}
              lon={lon}
              siteLabel={etiquetaMapaActual}
              viewMode={visorSatelital === 'google-3d' ? '3d' : '2d'}
              onSelectCoords={(clickedLat, clickedLon) => {
                setPresetSeleccionado('personalizado');
                setImgError(false);
                onChangeUbicacion(
                  clickedLat,
                  clickedLon,
                  `Tierra (${clickedLat.toFixed(2)}°, ${clickedLon.toFixed(2)}° · Satélite)`
                );
              }}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={capaWorldview}
                  onChange={(e) => {
                    setImgError(false);
                    setCapaWorldview(e.target.value);
                  }}
                  aria-label={t('Capa satelital de NASA Worldview', 'NASA Worldview satellite layer')}
                  className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100"
                >
                  {CAPAS_WORLDVIEW.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'en' ? c.nombreEn : c.nombre}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded">
                  {[1, 2.5, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setImgError(false);
                        setSpanWorldview(s);
                      }}
                      className={`px-2 py-1 text-[11px] font-mono rounded whitespace-nowrap ${
                        spanWorldview === s
                          ? 'bg-slate-800 text-slate-100'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      ±{s}°
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative h-[380px] sm:h-[400px] w-full bg-[#07090E] rounded-md overflow-hidden border border-slate-800">
                {!imgError ? (
                  <img
                    src={worldviewImgUrl}
                    alt={t(
                      `Imagen satelital NASA Worldview para ${lat.toFixed(2)}, ${lon.toFixed(2)}`,
                      `NASA Worldview satellite image for ${lat.toFixed(2)}, ${lon.toFixed(2)}`
                    )}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#07090E] text-slate-300">
                    <p className="text-xs font-medium">
                      {t(
                        `Capa satelital sin cobertura para la fecha ${startDate}`,
                        `No satellite coverage for date ${startDate}`
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {t(
                        'Prueba otra fecha o cambia entre MODIS Terra y VIIRS SNPP.',
                        'Try another date or switch between MODIS Terra and VIIRS SNPP.'
                      )}
                    </p>
                  </div>
                )}

                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <div className="w-6 h-6 border border-cyan-300/80 rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-amber-400 rounded-full" />
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 bg-slate-950/80 text-white text-[11px] font-mono tabular-nums rounded">
                  <span>{capaWorldview.replace(/_/g, ' ')}</span>
                  <span>
                    {lat.toFixed(2)}°, {lon.toFixed(2)}°
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Explorador de Colecciones NASA Earthdata Search (CMR) */}
        <div className="xl:col-span-6 p-5 flex flex-col space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {t('Catálogo NASA Earthdata Search (CMR)', 'NASA Earthdata Search Catalog (CMR)')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('Colecciones satelitales e in-situ indexadas en', 'Satellite and in-situ collections indexed at')}{' '}
                <span className="font-mono text-slate-300">search.earthdata.nasa.gov</span>
              </p>
            </div>
            <a
              href={earthdataSearchDeepLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline whitespace-nowrap shrink-0"
            >
              {t('Abrir en Earthdata Search', 'Open in Earthdata Search')}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              buscarCmr(cmrQuery, cmrFiltrarPunto, lat, lon);
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                value={cmrQuery}
                onChange={(e) => setCmrQuery(e.target.value)}
                placeholder={t(
                  'Buscar colección (ej. Atacama, MERRA-2, MODIS)...',
                  'Search collection (e.g. Atacama, MERRA-2, MODIS)...'
                )}
                aria-label={t('Término de búsqueda en NASA Earthdata', 'NASA Earthdata search term')}
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-950 border border-slate-700 text-slate-100 rounded focus:outline-none focus:border-cyan-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2" />
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={cmrFiltrarPunto}
                onChange={(e) => {
                  const next = e.target.checked;
                  setCmrFiltrarPunto(next);
                  buscarCmr(cmrQuery, next, lat, lon);
                }}
                className="rounded border-slate-700 bg-slate-950 text-cyan-400"
              />
              {t('Filtrar por punto', 'Filter by point')}
            </label>

            <button
              type="submit"
              disabled={cargandoCmr}
              className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-950 border border-slate-700 rounded hover:border-cyan-500/50 whitespace-nowrap shrink-0"
            >
              {cargandoCmr ? t('Buscando...', 'Searching...') : t('Buscar', 'Search')}
            </button>
          </form>

          {errorCmr && (
            <div className="text-xs text-rose-400">{errorCmr}</div>
          )}

          <div className="text-[11px] font-mono tabular-nums text-slate-400">
            {cmrHits.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')}{' '}
            {t('colecciones coincidentes en CMR', 'matching collections in CMR')}
          </div>

          <div className="flex-1 divide-y divide-slate-800 border border-slate-800 bg-[#07090E] rounded-md overflow-hidden">
            {cmrResultados.length === 0 && !cargandoCmr ? (
              <div className="p-4 text-xs text-slate-400">
                {t(
                  'No se encontraron colecciones con ese filtro. Prueba un término más amplio como «MERRA-2» o «MODIS».',
                  'No collections matched that filter. Try a broader term like "MERRA-2" or "MODIS".'
                )}
              </div>
            ) : (
              cmrResultados.map((item) => (
                <div
                  key={item.id}
                  className="p-3 hover:bg-slate-900/60 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <a
                      href={item.earthdataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-slate-100 hover:text-cyan-300 line-clamp-1"
                    >
                      {item.title}
                    </a>
                    <div className="mt-0.5 text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-1.5">
                      <span>{item.shortName || item.id}</span>
                      {item.versionId && (
                        <>
                          <span>·</span>
                          <span>v{item.versionId}</span>
                        </>
                      )}
                      {item.dataCenter && (
                        <>
                          <span>·</span>
                          <span>{item.dataCenter}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <a
                    href={item.earthdataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-medium text-cyan-400 hover:underline whitespace-nowrap shrink-0 mt-0.5"
                  >
                    {t('Ver gránulos', 'View granules')}
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Subpanel: Contexto geográfico en vivo con Google Maps Grounding */}
      <div className="border-t border-slate-800 p-5 bg-[#0B0E17] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400" />
              {t('Contexto geográfico con Google Maps Grounding', 'Geographic Context with Google Maps Grounding')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t(
                `Consulta lugares, accesos logísticos, estaciones científicas y reseñas reales ancladas a las coordenadas actuales (${lat.toFixed(2)}°, ${lon.toFixed(2)}°).`,
                `Query nearby places, logistics access, research stations, and real reviews anchored to (${lat.toFixed(2)}°, ${lon.toFixed(2)}°).`
              )}
            </p>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            toolConfig.latLng · Google Maps Grounding
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            consultarMaps(lat, lon);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={mapsQuery}
            onChange={(e) => setMapsQuery(e.target.value)}
            placeholder={t(
              'Ej. Estaciones de campo, accesos o puntos de interés geológico cercanos...',
              'e.g. Field stations, access roads, or nearby geological landmarks...'
            )}
            aria-label={t('Consulta para Google Maps Grounding', 'Google Maps Grounding query')}
            className="flex-1 min-w-[240px] px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 text-slate-100 rounded focus:outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={usarMiUbicacionMaps}
            disabled={mapsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-700 rounded hover:border-cyan-500/40 whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            {t('Usar mi ubicación', 'Use my location')}
          </button>
          <button
            type="submit"
            disabled={mapsLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <MapPin className="w-3.5 h-3.5" />
            {mapsLoading
              ? t('Consultando Maps...', 'Querying Maps...')
              : t('Consultar Google Maps', 'Query Google Maps')}
          </button>
        </form>

        {geoStatus && (
          <div className="text-[11px] font-mono tabular-nums text-emerald-400">
            {geoStatus}
          </div>
        )}

        {mapsError && (
          <div className="p-3 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-md">
            {mapsError}
          </div>
        )}

        {mapsResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
            <div className="lg:col-span-7 bg-[#07090E] border border-slate-800 rounded-md p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-200">
                  {t('Síntesis territorial verificada', 'Verified Territorial Summary')}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {mapsResult.lat !== null && mapsResult.lon !== null
                    ? `${mapsResult.lat.toFixed(2)}°, ${mapsResult.lon.toFixed(2)}°`
                    : t('Sin ancla', 'Unanchored')}
                </span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {mapsResult.respuestaMarkdown}
              </div>
            </div>

            <div className="lg:col-span-5 bg-[#07090E] border border-slate-800 rounded-md p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-200">
                  {t('Lugares y fuentes de Google Maps', 'Google Maps Places & Sources')} ({mapsResult.lugares.length})
                </span>
              </div>

              {mapsResult.lugares.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {t(
                    'La consulta no devolvió fichas individuales de Google Maps para este punto remoto; prueba ampliar el radio o consultar el centro poblado más cercano.',
                    'No individual Google Maps place cards were returned for this remote point; try widening the search or querying the nearest town.'
                  )}
                </p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {mapsResult.lugares.map((lugar, idx) => (
                    <div
                      key={`${lugar.placeId ?? lugar.uri}-${idx}`}
                      className="py-2.5 first:pt-0 last:pb-0 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={lugar.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-cyan-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{lugar.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {lugar.placeId && (
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {lugar.placeId.slice(0, 12)}
                          </span>
                        )}
                      </div>

                      {lugar.reviewSnippets.length > 0 && (
                        <div className="space-y-1 pl-2.5 border-l border-slate-800">
                          {lugar.reviewSnippets.map((snippet, sIdx) => (
                            <div key={sIdx} className="text-[11px] text-slate-400">
                              <p className="line-clamp-3">«{snippet.text}»</p>
                              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                                {snippet.author && <span>— {snippet.author}</span>}
                                {snippet.uri && (
                                  <a
                                    href={snippet.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    {t('Ver reseña en Google Maps', 'View review on Google Maps')}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
