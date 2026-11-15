import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  CheckCircle2,
  ExternalLink,
  LogIn,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  auth,
  cerrarSesionGoogle,
  eliminarDominioFirestore,
  type FirestoreKnowledgeEntry,
  type FirestoreWhitelistItem,
  guardarDominioFirestore,
  guardarEntradaFirestore,
  iniciarSesionGoogle,
  suscribirDatosUsuario,
  toggleDominioFirestore,
} from '../lib/firebase';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  ANALOGOS_TERRESTRES_NASA,
  SITIOS_INICIALES,
} from '../lib/analogo';
import { useLanguage } from '../lib/i18n';
import { translateSiteName } from '../lib/translations';

interface WhitelistDomainRow {
  id: number;
  dominio: string;
  etiqueta: string;
  categoria: 'NASA' | 'PDS' | 'ESA' | 'USGS' | 'NOAA' | 'Oficial';
  activo: number;
  auto_entrenar: number;
  creado_en: number;
}

interface GroundingFuente {
  title: string;
  uri: string;
  dominio: string | null;
  enListaBlanca: boolean;
}

interface SearchVerificationRes {
  verificado: boolean;
  confianza: number;
  resumen: string;
  sitioSugerido: string;
  valores: {
    temperatura: number | null;
    presion: number | null;
    viento: number | null;
    luz: number | null;
    hora: number;
  };
  fuentes: GroundingFuente[];
  enListaBlanca: boolean;
  modelo: string;
}

interface WhitelistVerifyPanelProps {
  onDatosActualizados: () => void;
}

const SITIOS_OPCIONES = Array.from(
  new Set([
    ...SITIOS_INICIALES.map((s) => s.nombre),
    ...ANALOGOS_TERRESTRES_NASA.map((t) => t.etiquetaSitio),
    ...ANALOGOS_LUNA_MARTE_PDS.map((p) => p.etiquetaSitio),
  ])
);

function extraerHostLocal(urlStr: string): string | null {
  const raw = urlStr.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

const DEFAULT_VERIFY_QUERY_ES =
  'Temperatura media diurna, presión atmosférica y viento en Cráter Jezero medidos por Mars 2020 MEDA';
const DEFAULT_VERIFY_QUERY_EN =
  'Mean daytime temperature, atmospheric pressure, and wind at Jezero Crater measured by Mars 2020 MEDA';

export const WhitelistVerifyPanel: React.FC<WhitelistVerifyPanelProps> = ({
  onDatosActualizados,
}) => {
  const { lang, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<'verificar' | 'whitelist' | 'nube'>('verificar');
  const [dominios, setDominios] = useState<WhitelistDomainRow[]>([]);
  const [cloudWhitelist, setCloudWhitelist] = useState<FirestoreWhitelistItem[]>([]);
  const [cloudEntries, setCloudEntries] = useState<FirestoreKnowledgeEntry[]>([]);

  // Formulario Añadir y Verificar Datos
  const [sitio, setSitio] = useState<string>('Marte (Cráter Jezero · PDS MEDA)');
  const [sourceUrl, setSourceUrl] = useState<string>(
    'https://pds-geosciences.wustl.edu/missions/mars2020/'
  );
  const [consulta, setConsulta] = useState<string>(
    lang === 'en' ? DEFAULT_VERIFY_QUERY_EN : DEFAULT_VERIFY_QUERY_ES
  );

  useEffect(() => {
    setConsulta((prev) => {
      if (prev === DEFAULT_VERIFY_QUERY_ES || prev === DEFAULT_VERIFY_QUERY_EN) {
        return lang === 'en' ? DEFAULT_VERIFY_QUERY_EN : DEFAULT_VERIFY_QUERY_ES;
      }
      return prev;
    });
  }, [lang]);
  const [hora, setHora] = useState<string>('12');
  const [tempK, setTempK] = useState<string>('215');
  const [presionPa, setPresionPa] = useState<string>('730');
  const [vientoMs, setVientoMs] = useState<string>('5.2');
  const [luzWm2, setLuzWm2] = useState<string>('520');
  const [entrenarAuto, setEntrenarAuto] = useState<boolean>(true);

  const [verificando, setVerificando] = useState(false);
  const [ingiriendo, setIngiriendo] = useState(false);
  const [resultadoSearch, setResultadoSearch] =
    useState<SearchVerificationRes | null>(null);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);

  // Formulario Lista Blanca
  const [nuevoDominio, setNuevoDominio] = useState('');
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState<
    'NASA' | 'PDS' | 'ESA' | 'USGS' | 'NOAA' | 'Oficial'
  >('Oficial');
  const [nuevoAutoEntrenar, setNuevoAutoEntrenar] = useState(true);
  const [msgWhitelist, setMsgWhitelist] = useState<string | null>(null);

  const cargarDominios = async () => {
    try {
      const res = await fetch('/api/ml/whitelist');
      if (res.ok) {
        const data = await res.json();
        setDominios(data.dominios ?? []);
      }
    } catch {
      // Ignorar si aún inicia
    }
  };

  useEffect(() => {
    cargarDominios();
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setCloudWhitelist([]);
      setCloudEntries([]);
      return;
    }
    const unsub = suscribirDatosUsuario(user, {
      onWhitelist: setCloudWhitelist,
      onEntries: setCloudEntries,
      onError: (msg) => setAuthError(msg),
    });
    return () => unsub();
  }, [authReady, user]);

  const coincidenciaListaBlanca = useMemo(() => {
    const host = extraerHostLocal(sourceUrl);
    if (!host) return null;
    const activos = dominios
      .filter((d) => d.activo === 1)
      .sort((a, b) => b.dominio.length - a.dominio.length);
    return (
      activos.find((d) => host === d.dominio || host.endsWith(`.${d.dominio}`)) ?? null
    );
  }, [sourceUrl, dominios]);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await iniciarSesionGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : t('No se pudo iniciar sesión con Google', 'Could not sign in with Google')
      );
    }
  };

  const handleLogout = async () => {
    await cerrarSesionGoogle();
  };

  const handleVerificarSearch = async (autoGuardar = false) => {
    setVerificando(true);
    setMensajeEstado(null);
    try {
      const res = await fetch('/api/ml/verify-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consulta,
          sitio,
          sourceUrl,
          temperatura: tempK,
          presion: presionPa,
          viento: vientoMs,
          luz: luzWm2,
          autoGuardar,
          autoEntrenar: autoGuardar && entrenarAuto,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || t('Error verificando con Google Search', 'Error verifying with Google Search')
        );
      }
      const v = data.verificacion as SearchVerificationRes;
      setResultadoSearch(v);

      if (v.valores.temperatura !== null) setTempK(String(v.valores.temperatura));
      if (v.valores.presion !== null) setPresionPa(String(v.valores.presion));
      if (v.valores.viento !== null) setVientoMs(String(v.valores.viento));
      if (v.valores.luz !== null) setLuzWm2(String(v.valores.luz));
      if (v.valores.hora !== null) setHora(String(Math.round(v.valores.hora)));

      if (autoGuardar && data.estadoGuardado) {
        const estadoLbl =
          data.estadoGuardado === 'aprobado'
            ? t('aprobado', 'approved')
            : data.estadoGuardado === 'rechazado'
              ? t('rechazado', 'rejected')
              : t('pendiente', 'pending');
        const mseInfo = data.entrenamiento
          ? t(
              ` · Reentrenado (MSE clima=${data.entrenamiento.clima}, sim=${data.entrenamiento.similitud})`,
              ` · Retrained (Climate MSE=${data.entrenamiento.clima}, sim=${data.entrenamiento.similitud})`
            )
          : '';
        setMensajeEstado(
          t(
            `Dato guardado como «${estadoLbl}» tras verificación Search (${(v.confianza * 100).toFixed(0)}%)${mseInfo}`,
            `Record saved as "${estadoLbl}" after Search verification (${(v.confianza * 100).toFixed(0)}%)${mseInfo}`
          )
        );

        if (
          user &&
          user.emailVerified &&
          v.valores.temperatura !== null &&
          v.valores.presion !== null &&
          v.valores.viento !== null &&
          v.valores.luz !== null
        ) {
          await guardarEntradaFirestore(user, {
            tipo: 'clima',
            sitio: v.sitioSugerido,
            sourceUrl: sourceUrl || v.fuentes[0]?.uri || 'https://nasa.gov',
            sourceDomain:
              extraerHostLocal(sourceUrl) ?? v.fuentes[0]?.dominio ?? 'nasa.gov',
            whitelisted: v.enListaBlanca,
            autoApproved: data.estadoGuardado === 'aprobado',
            verifiedBySearch: v.verificado,
            verificationSummary: v.resumen,
            status:
              data.estadoGuardado === 'aprobado' || data.estadoGuardado === 'rechazado'
                ? data.estadoGuardado
                : 'pendiente',
            temperatura: v.valores.temperatura,
            presion: v.valores.presion,
            viento: v.valores.viento,
            luz: v.valores.luz,
          });
        }
        onDatosActualizados();
      }
    } catch (err) {
      setMensajeEstado(
        err instanceof Error
          ? err.message
          : t('Error consultando Google Search', 'Error querying Google Search')
      );
    } finally {
      setVerificando(false);
    }
  };

  const handleIngestaListaBlanca = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngiriendo(true);
    setMensajeEstado(null);
    try {
      const res = await fetch('/api/ml/whitelist-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sitio,
          sourceUrl,
          hora: Number(hora),
          temperatura: Number(tempK),
          presion: Number(presionPa),
          viento: Number(vientoMs),
          luz: Number(luzWm2),
          entrenarAhora: entrenarAuto,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('Error añadiendo dato', 'Error adding record'));
      }

      const estadoLbl =
        data.estado === 'aprobado'
          ? t('aprobado', 'approved')
          : data.estado === 'rechazado'
            ? t('rechazado', 'rejected')
            : t('pendiente', 'pending');

      if (data.enListaBlanca) {
        const mseText = data.entrenamiento
          ? t(
              ` · Modelo entrenado (MSE clima=${data.entrenamiento.clima}, sim=${data.entrenamiento.similitud})`,
              ` · Model trained (Climate MSE=${data.entrenamiento.clima}, sim=${data.entrenamiento.similitud})`
            )
          : '';
        setMensajeEstado(
          t(
            `Fuente oficial (${data.reglaMatch?.dominio}): añadido como «${estadoLbl}» sin verificación manual${mseText}`,
            `Official source (${data.reglaMatch?.dominio}): added as "${estadoLbl}" without manual review${mseText}`
          )
        );
      } else {
        setMensajeEstado(
          t(
            `Dominio (${data.dominioDetectado ?? 'desconocido'}) fuera de la lista blanca: guardado como «${estadoLbl}» para revisión o verificación Search.`,
            `Domain (${data.dominioDetectado ?? 'unknown'}) outside whitelist: saved as "${estadoLbl}" for review or Search verification.`
          )
        );
      }

      if (user && user.emailVerified) {
        await guardarEntradaFirestore(user, {
          tipo: 'clima',
          sitio,
          sourceUrl,
          sourceDomain: data.dominioDetectado ?? 'desconocido.org',
          whitelisted: Boolean(data.enListaBlanca),
          autoApproved: data.estado === 'aprobado',
          verifiedBySearch: false,
          verificationSummary: data.enListaBlanca
            ? `Auto-aprobado por lista blanca oficial (${data.reglaMatch?.dominio})`
            : 'Pendiente de verificación manual o Google Search',
          status:
            data.estado === 'aprobado' || data.estado === 'rechazado'
              ? data.estado
              : 'pendiente',
          temperatura: Number(tempK),
          presion: Number(presionPa),
          viento: Number(vientoMs),
          luz: Number(luzWm2),
        });
      }

      onDatosActualizados();
    } catch (err) {
      setMensajeEstado(
        err instanceof Error ? err.message : t('Error guardando dato', 'Error saving record')
      );
    } finally {
      setIngiriendo(false);
    }
  };

  const handleAgregarDominio = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgWhitelist(null);
    try {
      const res = await fetch('/api/ml/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dominio: nuevoDominio,
          etiqueta: nuevaEtiqueta,
          categoria: nuevaCategoria,
          autoEntrenar: nuevoAutoEntrenar,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('No se pudo agregar dominio', 'Could not add domain'));
      }
      setDominios(data.dominios ?? []);

      if (user && user.emailVerified && data.item) {
        await guardarDominioFirestore(user, {
          domain: data.item.dominio,
          label: data.item.etiqueta,
          category: data.item.categoria,
          active: data.item.activo === 1,
        });
      }

      setNuevoDominio('');
      setNuevaEtiqueta('');
      setMsgWhitelist(
        t(
          `Dominio oficial «${data.item.dominio}» agregado a la lista blanca.`,
          `Official domain "${data.item.dominio}" added to the whitelist.`
        )
      );
    } catch (err) {
      setMsgWhitelist(
        err instanceof Error ? err.message : t('Dominio inválido', 'Invalid domain')
      );
    }
  };

  const handleToggleDominio = async (d: WhitelistDomainRow) => {
    const nextActivo = d.activo !== 1;
    const res = await fetch(`/api/ml/whitelist/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: nextActivo }),
    });
    if (res.ok) {
      const data = await res.json();
      setDominios(data.dominios ?? []);
      const cloudMatch = cloudWhitelist.find((c) => c.domain === d.dominio);
      if (cloudMatch && user) {
        await toggleDominioFirestore(cloudMatch.id, nextActivo);
      }
    }
  };

  const handleEliminarDominio = async (d: WhitelistDomainRow) => {
    const res = await fetch(`/api/ml/whitelist/${d.id}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setDominios(data.dominios ?? []);
      const cloudMatch = cloudWhitelist.find((c) => c.domain === d.dominio);
      if (cloudMatch && user) {
        await eliminarDominioFirestore(cloudMatch.id);
      }
    }
  };

  return (
    <section
      id="verificacion-whitelist"
      className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden text-slate-100"
    >
      {/* Cabecera + Sesión Google Firebase */}
      <div className="px-5 py-4 border-b border-slate-800 bg-[#0B0E17] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            {t(
              'Ingesta, verificación con Google Search y lista blanca oficial',
              'Ingestion, Google Search Verification & Official Whitelist'
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t(
              'Las páginas en lista blanca oficial aprueban y entrenan el modelo sin verificación manual; el resto se verifica mediante Google Search Grounding',
              'Officially whitelisted pages auto-approve and train the model without manual review; others are verified via Google Search Grounding'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-cyan-300 font-mono truncate max-w-[220px]">
                {user.displayName || user.email} · {t('Firestore activo', 'Firestore active')}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#07090E] border border-slate-700 rounded-md hover:border-slate-500 whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t('Salir', 'Sign out')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t('Conectar con Google (Firestore)', 'Sign in with Google (Firestore)')}
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="px-5 py-2 bg-rose-950/60 border-b border-rose-500/40 text-xs text-rose-300">
          {authError}
        </div>
      )}

      {/* Pestañas funcionales */}
      <div className="px-5 pt-3 border-b border-slate-800 bg-[#0B0E17] flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setTab('verificar')}
          className={`px-3.5 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            tab === 'verificar'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-100'
          }`}
        >
          {t('Añadir y verificar datos', 'Add & verify data')}
        </button>
        <button
          type="button"
          onClick={() => setTab('whitelist')}
          className={`px-3.5 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            tab === 'whitelist'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-100'
          }`}
        >
          {t('Lista blanca oficial', 'Official whitelist')} ({dominios.filter((d) => d.activo === 1).length})
        </button>
        <button
          type="button"
          onClick={() => setTab('nube')}
          className={`px-3.5 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            tab === 'nube'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-100'
          }`}
        >
          {t('Registro en Firestore', 'Firestore Log')} ({cloudEntries.length})
        </button>
      </div>

      <div className="p-5">
        {tab === 'verificar' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Formulario de ingesta y parámetros */}
            <form
              onSubmit={handleIngestaListaBlanca}
              className="xl:col-span-7 space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-400 mb-1">
                    {t('Sitio planetario destino', 'Target planetary site')}
                  </label>
                  <select
                    value={sitio}
                    onChange={(e) => setSitio(e.target.value)}
                    className="w-full px-3 py-2 bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
                  >
                    {SITIOS_OPCIONES.map((s) => (
                      <option key={s} value={s}>
                        {translateSiteName(s, lang)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-400 mb-1">
                    {t('URL de la página fuente', 'Source page URL')}
                  </label>
                  <input
                    type="text"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://pds.nasa.gov/..."
                    className="w-full px-3 py-2 bg-[#07090E] border border-slate-700 rounded-md font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Estado inmediato contra la lista blanca */}
              <div className="px-3 py-2 bg-[#07090E] border border-slate-800 rounded-md flex flex-wrap items-center justify-between gap-2">
                {coincidenciaListaBlanca ? (
                  <span className="text-emerald-400 font-medium inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    {t(
                      `Dominio en lista blanca (${coincidenciaListaBlanca.dominio} · ${coincidenciaListaBlanca.categoria}): aprueba y entrena sin verificar`,
                      `Whitelisted domain (${coincidenciaListaBlanca.dominio} · ${coincidenciaListaBlanca.categoria}): auto-approves & trains without check`
                    )}
                  </span>
                ) : (
                  <span className="text-amber-300 font-medium">
                    {t(
                      'Dominio fuera de lista blanca: usa Google Search Grounding para verificar antes de aprobar',
                      'Domain outside whitelist: use Google Search Grounding to verify before approving'
                    )}
                  </span>
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-400 mb-1">
                  {t(
                    'Consulta o afirmación a verificar con Google Search',
                    'Query or claim to verify with Google Search'
                  )}
                </label>
                <textarea
                  rows={2}
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  className="w-full px-3 py-2 bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">{t('Hora (h)', 'Hour (h)')}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">T (K)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempK}
                    onChange={(e) => setTempK(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">P (Pa)</label>
                  <input
                    type="number"
                    step="any"
                    value={presionPa}
                    onChange={(e) => setPresionPa(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('Viento (m/s)', 'Wind (m/s)')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={vientoMs}
                    onChange={(e) => setVientoMs(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('Luz (W/m²)', 'Light (W/m²)')}
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={luzWm2}
                    onChange={(e) => setLuzWm2(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entrenarAuto}
                    onChange={(e) => setEntrenarAuto(e.target.checked)}
                    className="rounded border-slate-600 bg-[#07090E] accent-cyan-400"
                  />
                  {t('Entrenar modelo automáticamente al aprobar', 'Auto-train model on approval')}
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={verificando || ingiriendo}
                    onClick={() => handleVerificarSearch(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#07090E] border border-slate-700 rounded-md hover:border-slate-500 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {verificando
                      ? t('Verificando...', 'Verifying...')
                      : t('Verificar con Google Search', 'Verify with Google Search')}
                  </button>

                  <button
                    type="submit"
                    disabled={verificando || ingiriendo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {coincidenciaListaBlanca
                      ? ingiriendo
                        ? t('Añadiendo y entrenando...', 'Adding & training...')
                        : t('Añadir sin verificar y entrenar', 'Add & train directly')
                      : ingiriendo
                        ? t('Guardando...', 'Saving...')
                        : t('Guardar como pendiente', 'Save as pending')}
                  </button>
                </div>
              </div>

              {mensajeEstado && (
                <div className="px-3 py-2 bg-cyan-950/40 border border-cyan-500/40 rounded text-xs font-mono text-cyan-200">
                  {mensajeEstado}
                </div>
              )}
            </form>

            {/* Resultado de Google Search Grounding */}
            <div className="xl:col-span-5 border border-slate-800 rounded-md p-4 bg-[#07090E] flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {t('Auditoría Google Search Grounding', 'Google Search Grounding Audit')}
                  </h3>
                  <span className="text-[11px] font-mono text-cyan-400">
                    gemini-4-hydrogen
                  </span>
                </div>

                {resultadoSearch ? (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span
                        className={
                          resultadoSearch.verificado
                            ? 'text-emerald-400 font-semibold'
                            : 'text-amber-300 font-semibold'
                        }
                      >
                        {resultadoSearch.verificado
                          ? t('VERIFICADO', 'VERIFIED')
                          : t('REVISIÓN REQUERIDA', 'REVIEW REQUIRED')}
                      </span>
                      <span className="tabular-nums text-slate-400">
                        {t('Confianza:', 'Confidence:')} {(resultadoSearch.confianza * 100).toFixed(0)}%
                      </span>
                    </div>

                    <p className="text-slate-300 leading-relaxed">
                      {resultadoSearch.resumen}
                    </p>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-slate-400">
                        {t('Fuentes encontradas en Google Search:', 'Sources found on Google Search:')}
                      </div>
                      {resultadoSearch.fuentes.length === 0 ? (
                        <div className="text-[11px] text-slate-500">
                          {t('Sin enlaces web devueltos en esta consulta.', 'No web links returned for this query.')}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {resultadoSearch.fuentes.map((f) => (
                            <div
                              key={f.uri}
                              className="flex items-center justify-between gap-2 bg-[#0D121D] border border-slate-800 rounded px-2.5 py-1.5"
                            >
                              <a
                                href={f.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline truncate inline-flex items-center gap-1"
                              >
                                <span className="truncate">{f.title}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                              <span
                                className={`text-[11px] font-mono whitespace-nowrap shrink-0 ${
                                  f.enListaBlanca ? 'text-emerald-400' : 'text-slate-500'
                                }`}
                              >
                                {f.enListaBlanca ? t('Oficial', 'Official') : f.dominio ?? 'Web'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t(
                      'Pulsa «Verificar con Google Search» para contrastar mediciones en tiempo real con Google Search Grounding y autocompletar valores SI (K, Pa, m/s, W/m²). Si la fuente pertenece a tu lista blanca, también puedes añadirla directamente sin verificación previa.',
                      'Click "Verify with Google Search" to cross-check measurements in real time with Google Search Grounding and autofill SI values (K, Pa, m/s, W/m²). If the source is on your whitelist, you can also add it directly without prior check.'
                    )}
                  </p>
                )}
              </div>

              {resultadoSearch && (
                <button
                  type="button"
                  disabled={verificando}
                  onClick={() => handleVerificarSearch(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('Aprobar dato verificado y entrenar modelo', 'Approve verified record & train model')}
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'whitelist' && (
          <div className="space-y-4">
            <form
              onSubmit={handleAgregarDominio}
              className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end text-xs bg-[#07090E] p-3.5 border border-slate-800 rounded-md"
            >
              <div className="md:col-span-3">
                <label className="block font-medium text-slate-400 mb-1">
                  {t('Dominio o URL oficial', 'Official domain or URL')}
                </label>
                <input
                  type="text"
                  required
                  value={nuevoDominio}
                  onChange={(e) => setNuevoDominio(e.target.value)}
                  placeholder="astrogeology.usgs.gov"
                  className="w-full px-2.5 py-1.5 bg-[#0D121D] border border-slate-700 rounded font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="md:col-span-4">
                <label className="block font-medium text-slate-400 mb-1">
                  {t('Descripción / Institución', 'Description / Institution')}
                </label>
                <input
                  type="text"
                  value={nuevaEtiqueta}
                  onChange={(e) => setNuevaEtiqueta(e.target.value)}
                  placeholder="USGS Planetary Astrogeology"
                  className="w-full px-2.5 py-1.5 bg-[#0D121D] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-medium text-slate-400 mb-1">
                  {t('Agencia', 'Agency')}
                </label>
                <select
                  value={nuevaCategoria}
                  onChange={(e) =>
                    setNuevaCategoria(
                      e.target.value as 'NASA' | 'PDS' | 'ESA' | 'USGS' | 'NOAA' | 'Oficial'
                    )
                  }
                  className="w-full px-2.5 py-1.5 bg-[#0D121D] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="NASA">NASA</option>
                  <option value="PDS">PDS</option>
                  <option value="ESA">ESA</option>
                  <option value="USGS">USGS</option>
                  <option value="NOAA">NOAA</option>
                  <option value="Oficial">{t('Oficial', 'Official')}</option>
                </select>
              </div>
              <div className="md:col-span-3 flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nuevoAutoEntrenar}
                    onChange={(e) => setNuevoAutoEntrenar(e.target.checked)}
                    className="rounded border-slate-600 bg-[#0D121D] accent-cyan-400"
                  />
                  {t('Auto-entrenar', 'Auto-train')}
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('Agregar', 'Add')}
                </button>
              </div>
            </form>

            {msgWhitelist && (
              <div className="text-xs font-mono text-cyan-300">{msgWhitelist}</div>
            )}

            <div className="overflow-x-auto border border-slate-800 rounded-md bg-[#07090E]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0B0E17] border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">{t('Dominio autorizado', 'Authorized domain')}</th>
                    <th className="py-2 px-3">{t('Institución', 'Institution')}</th>
                    <th className="py-2 px-3">{t('Agencia', 'Agency')}</th>
                    <th className="py-2 px-3">{t('Estado', 'Status')}</th>
                    <th className="py-2 px-3 text-right">{t('Acciones', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {dominios.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-900/50">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-100">
                        {d.dominio}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{d.etiqueta}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">
                        {d.categoria}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <span
                          className={
                            d.activo === 1 ? 'text-emerald-400' : 'text-slate-500'
                          }
                        >
                          {d.activo === 1
                            ? d.auto_entrenar === 1
                              ? t('Activo · auto-entrena', 'Active · auto-trains')
                              : t('Activo', 'Active')
                            : t('Inactivo', 'Inactive')}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => handleToggleDominio(d)}
                          className="text-xs font-medium text-cyan-400 hover:underline"
                        >
                          {d.activo === 1 ? t('Desactivar', 'Disable') : t('Activar', 'Enable')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminarDominio(d)}
                          className="inline-flex items-center text-rose-400 hover:text-rose-300"
                          title={t('Eliminar dominio', 'Remove domain')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'nube' && (
          <div className="space-y-3 text-xs">
            {!user ? (
              <div className="p-4 border border-slate-800 rounded-md bg-[#07090E] text-slate-300 flex flex-wrap items-center justify-between gap-3">
                <span>
                  {t(
                    'Inicia sesión con tu cuenta de Google para guardar y sincronizar tus registros verificados y dominios autorizados en Firestore.',
                    'Sign in with your Google account to save and sync your verified records and authorized domains in Firestore.'
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {t('Conectar con Google', 'Sign in with Google')}
                </button>
              </div>
            ) : cloudEntries.length === 0 ? (
              <div className="p-4 border border-slate-800 rounded-md bg-[#07090E] text-slate-400">
                {t(
                  'Aún no has guardado observaciones verificadas en tu colección Firestore. Añade o verifica un dato en la primera pestaña para persistirlo aquí.',
                  'No verified observations saved in your Firestore collection yet. Add or verify a record in the first tab to persist it here.'
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-md bg-[#07090E]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0B0E17] border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">{t('Sitio', 'Site')}</th>
                      <th className="py-2 px-3">{t('Dominio', 'Domain')}</th>
                      <th className="py-2 px-3 text-right">T (K)</th>
                      <th className="py-2 px-3 text-right">P (Pa)</th>
                      <th className="py-2 px-3 text-right">{t('Luz (W/m²)', 'Light (W/m²)')}</th>
                      <th className="py-2 px-3">{t('Estado', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                    {cloudEntries.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 px-3 font-sans font-medium text-slate-100">
                          {translateSiteName(item.sitio, lang)}
                        </td>
                        <td className="py-2 px-3 text-slate-400">{item.sourceDomain}</td>
                        <td className="py-2 px-3 text-right text-slate-200">
                          {item.temperatura.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200">
                          {item.presion.toExponential(1)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200">
                          {item.luz.toFixed(0)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={
                              item.status === 'aprobado'
                                ? 'text-emerald-400'
                                : 'text-amber-300'
                            }
                          >
                            {item.status === 'aprobado'
                              ? t('aprobado', 'approved')
                              : item.status === 'rechazado'
                                ? t('rechazado', 'rejected')
                                : t('pendiente', 'pending')}
                            {item.whitelisted ? ` · ${t('lista blanca', 'whitelist')}` : ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
