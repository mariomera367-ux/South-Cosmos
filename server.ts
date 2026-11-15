import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { ejecutarCiclo, faltanSitiosEnDb, sembrar } from './server/ciclo.ts';
import { cambiarEstado, guardar, iniciar } from './server/db.ts';
import { consultarGoogleMapsGrounding } from './server/maps.ts';
import {
  cargarModelo,
  entrenarTodo,
  obtenerEstadoModelos,
  predecirPar,
} from './server/ml.ts';
import { verificarConGoogleSearch } from './server/verifier.ts';
import {
  actualizarDominioWhitelist,
  agregarDominioWhitelist,
  asegurarSemillaWhitelist,
  buscarReglaListaBlanca,
  eliminarDominioWhitelist,
  extraerDominio,
  listarWhitelist,
} from './server/whitelist.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function bootstrap() {
  iniciar();
  asegurarSemillaWhitelist();

  // Sembrado rápido en SQLite sin bloquear el arranque si los modelos ya existen
  if (faltanSitiosEnDb()) {
    try {
      sembrar(0);
    } catch (err) {
      console.warn('Advertencia sembrando base SQLite inicial:', err);
    }
  }

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. NASA POWER (Series horarias terrestres)
  app.get('/api/earthdata/power', async (req, res) => {
    try {
      const lat = Number(req.query.lat ?? -24.1);
      const lon = Number(req.query.lon ?? -69.9);
      const start = String(req.query.start ?? '20260615').replace(/[^0-9]/g, '').slice(0, 8);
      const end = String(req.query.end ?? '20260616').replace(/[^0-9]/g, '').slice(0, 8);

      const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,PS,WS10M,ALLSKY_SFC_SW_DWN&community=RE&longitude=${encodeURIComponent(
        lon
      )}&latitude=${encodeURIComponent(lat)}&start=${start}&end=${end}&format=JSON`;

      const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!upstream.ok) {
        return res.status(502).json({
          error: `NASA POWER respondió HTTP ${upstream.status}`,
        });
      }
      const data = (await upstream.json()) as {
        geometry?: { coordinates?: number[] };
        properties?: { parameter?: Record<string, Record<string, number>> };
      };

      const p = data.properties?.parameter;
      if (!p?.T2M) {
        return res.status(502).json({
          error: 'Respuesta incompleta de NASA POWER para estas coordenadas/fechas.',
        });
      }

      const keys = Object.keys(p.T2M).sort();
      const horas: number[] = [];
      const etiquetas: string[] = [];
      const temperaturaK: number[] = [];
      const presionPa: number[] = [];
      const vientoMs: number[] = [];
      const luzWm2: number[] = [];

      keys.forEach((k, idx) => {
        const tC = p.T2M[k];
        const psKpa = p.PS?.[k];
        const ws = p.WS10M?.[k];
        const sw = p.ALLSKY_SFC_SW_DWN?.[k];
        if (tC < -200 || psKpa < 0 || ws < 0 || sw < -50) return;
        horas.push(idx);
        etiquetas.push(`${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)} ${k.slice(8, 10)}:00`);
        temperaturaK.push(Number((tC + 273.15).toFixed(2)));
        presionPa.push(Number((psKpa * 1000).toFixed(1)));
        vientoMs.push(Number(Math.max(0, ws).toFixed(2)));
        luzWm2.push(Number(Math.max(0, sw).toFixed(1)));
      });

      if (horas.length === 0) {
        return res.status(404).json({
          error: 'NASA POWER no tiene datos horarios válidos en el rango de fechas elegido.',
        });
      }

      const coords = data.geometry?.coordinates ?? [];
      res.json({
        source: 'NASA POWER (MERRA-2 / CERES)',
        lat,
        lon,
        elevacionM: typeof coords[2] === 'number' ? Math.round(coords[2]) : null,
        start,
        end,
        horas,
        etiquetas,
        temperaturaK,
        presionPa,
        vientoMs,
        luzWm2,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Error consultando NASA POWER',
      });
    }
  });

  // 2. NASA Earthdata CMR Collections
  app.get('/api/earthdata/cmr', async (req, res) => {
    try {
      const keyword = String(req.query.keyword ?? 'MERRA-2').trim();
      const pageSize = Math.min(12, Math.max(1, Number(req.query.page_size ?? 5)));
      const params = new URLSearchParams({
        keyword,
        page_size: String(pageSize),
      });
      if (req.query.lat !== undefined && req.query.lon !== undefined) {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          params.set('point', `${lon.toFixed(3)},${lat.toFixed(3)}`);
        }
      }

      const url = `https://cmr.earthdata.nasa.gov/search/collections.json?${params.toString()}`;
      const upstream = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(9000),
      });
      if (!upstream.ok) {
        return res.status(502).json({ error: `CMR HTTP ${upstream.status}` });
      }
      const totalHits = Number(upstream.headers.get('cmr-hits') || 0);
      const data = (await upstream.json()) as {
        feed?: {
          entry?: Array<{
            id: string;
            title?: string;
            short_name?: string;
            version_id?: string;
            data_center?: string;
            summary?: string;
            time_start?: string;
            time_end?: string;
          }>;
        };
      };

      const entries = (data.feed?.entry ?? []).map((e) => ({
        id: e.id,
        title: e.title || e.short_name || e.id,
        shortName: e.short_name || '',
        versionId: e.version_id || '',
        dataCenter: e.data_center || '',
        summary: e.summary || '',
        timeStart: e.time_start ?? null,
        timeEnd: e.time_end ?? null,
        earthdataUrl: `https://search.earthdata.nasa.gov/search/granules?p=${encodeURIComponent(
          e.id
        )}`,
      }));

      res.json({ totalHits: totalHits || entries.length, entries });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Error consultando NASA CMR',
      });
    }
  });

  // 3. NASA Worldview / GIBS WMS Image Proxy
  app.get('/api/earthdata/worldview', async (req, res) => {
    try {
      const lat = Number(req.query.lat ?? -24.1);
      const lon = Number(req.query.lon ?? -69.9);
      const span = Math.max(0.2, Math.min(25, Number(req.query.span ?? 2.5)));
      const date = String(req.query.date ?? '2026-06-15').slice(0, 10);
      const layer = String(
        req.query.layer ?? 'MODIS_Terra_CorrectedReflectance_TrueColor'
      );

      const minLat = Math.max(-89.9, lat - span);
      const maxLat = Math.min(89.9, lat + span);
      const minLon = Math.max(-180, lon - span);
      const maxLon = Math.min(180, lon + span);

      const wmsUrl = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${encodeURIComponent(
        layer
      )}&STYLES=&FORMAT=image/jpeg&TRANSPARENT=FALSE&HEIGHT=512&WIDTH=512&CRS=EPSG:4326&BBOX=${minLat},${minLon},${maxLat},${maxLon}&TIME=${encodeURIComponent(
        date
      )}`;

      const upstream = await fetch(wmsUrl, { signal: AbortSignal.timeout(10000) });
      if (!upstream.ok) {
        return res.status(502).send('GIBS WMS unavailable');
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(buf);
    } catch {
      res.status(502).send('Error proxy Worldview');
    }
  });

  // 4. Google Maps Grounding via Gemini API
  app.post('/api/earthdata/maps-grounding', async (req, res) => {
    try {
      const { consulta, lat, lon } = req.body ?? {};
      if (!consulta || typeof consulta !== 'string') {
        return res.status(400).json({ error: 'Falta el campo consulta.' });
      }
      const result = await consultarGoogleMapsGrounding({
        consulta,
        lat: typeof lat === 'number' ? lat : null,
        lon: typeof lon === 'number' ? lon : null,
      });
      res.json(result);
    } catch (err) {
      const code = (err as Error & { statusCode?: number }).statusCode || 500;
      res.status(code).json({
        error:
          err instanceof Error
            ? err.message
            : 'Error consultando Google Maps Grounding',
      });
    }
  });

  // 5. WUSTL Geosciences ODE Products
  app.get('/api/pds/ode', async (req, res) => {
    try {
      const target = String(req.query.target ?? 'moon');
      const ihid = String(req.query.ihid ?? 'LRO');
      const iid = String(req.query.iid ?? 'DLRE');
      const pt = String(req.query.pt ?? 'GDR_L2');
      const lat = Number(req.query.lat ?? 0.67);
      const lon = Number(req.query.lon ?? 23.47);
      const span = Number(req.query.span ?? 8);
      const limit = Math.min(10, Math.max(1, Number(req.query.limit ?? 5)));

      const minLat = Math.max(-90, lat - span);
      const maxLat = Math.min(90, lat + span);
      const minLon = lon - span;
      const maxLon = lon + span;

      const url = `https://oderest.rsl.wustl.edu/live2/?query=product&results=m&output=JSON&target=${encodeURIComponent(
        target
      )}&ihid=${encodeURIComponent(ihid)}&iid=${encodeURIComponent(
        iid
      )}&pt=${encodeURIComponent(
        pt
      )}&minlat=${minLat}&maxlat=${maxLat}&westernlon=${minLon}&easternlon=${maxLon}&limit=${limit}`;

      const upstream = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!upstream.ok) {
        return res.json({
          products: [],
          warning: `WUSTL ODE respondió HTTP ${upstream.status}`,
        });
      }
      const raw = (await upstream.json()) as {
        ODEResults?: {
          Products?: {
            Product?:
              | Array<Record<string, unknown>>
              | Record<string, unknown>;
          };
        };
      };
      const rawProds = raw.ODEResults?.Products?.Product;
      const arr = Array.isArray(rawProds)
        ? rawProds
        : rawProds
          ? [rawProds]
          : [];

      const products = arr.map((p, idx) => ({
        name: String(
          p.pdsid ||
            p.Product_id ||
            p.Product_name ||
            p.ode_id ||
            `Producto PDS #${idx + 1}`
        ),
        description: String(p.Description || p.Product_type || ''),
        productUrl: String(
          p.ProductURL ||
            p.Product_url ||
            p.External_url ||
            p.LabelURL ||
            p.Label_url ||
            ''
        ),
        labelUrl: String(p.LabelURL || p.Label_url || ''),
        filesUrl: String(
          p.FilesURL ||
            p.Files_url ||
            p.Browse_url ||
            p.LabelURL ||
            p.Label_url ||
            ''
        ),
        utcStart: p.UTC_start_time ? String(p.UTC_start_time) : null,
        utcStop: p.UTC_stop_time ? String(p.UTC_stop_time) : null,
        mapScale: p.Map_scale ? String(p.Map_scale) : null,
      }));

      res.json({ products });
    } catch (err) {
      res.json({
        products: [],
        warning:
          err instanceof Error
            ? `WUSTL ODE temporalmente inaccesible (${err.message})`
            : 'Error consultando WUSTL ODE',
      });
    }
  });

  // 6. NASA PDS4 Search
  app.get('/api/pds/search', async (req, res) => {
    try {
      const target = String(req.query.target ?? 'Moon');
      const keyword = String(req.query.keyword ?? 'LRO').trim();
      const qParts = [`target_name:${target}`, 'product_class:Product_Bundle'];
      if (keyword) qParts.push(`title:*${keyword}*`);
      const url = `https://pds.nasa.gov/api/search/1/products?q=${encodeURIComponent(
        qParts.join(' AND ')
      )}&limit=9`;

      const upstream = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(9000),
      });
      if (!upstream.ok) {
        return res.json({ totalHits: 0, bundles: [] });
      }
      const raw = (await upstream.json()) as {
        summary?: { hits?: number };
        data?: Array<{
          id?: string;
          properties?: Record<string, unknown>;
        }>;
      };

      const bundles = (raw.data ?? []).map((d) => {
        const props = d.properties ?? {};
        const lid = String(props['lid'] ?? d.id ?? '');
        const titleArr = props['pds:Citation_Information.pds:title'];
        const title = Array.isArray(titleArr)
          ? String(titleArr[0] ?? lid)
          : String(props['title'] ?? lid);
        const invArr = props['pds:Investigation_Area.pds:name'];
        const nodeArr = props['ops:Harvest_Info.ops:node_name'];
        return {
          id: d.id || lid,
          lid,
          title,
          description: '',
          investigation: Array.isArray(invArr) ? String(invArr[0] ?? '') : '',
          nodeName: Array.isArray(nodeArr) ? String(nodeArr[0] ?? 'PDS') : 'PDS',
          startTime: null,
          stopTime: null,
          pdsUrl: `https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=${encodeURIComponent(
            lid
          )}`,
        };
      });

      res.json({
        totalHits: raw.summary?.hits ?? bundles.length,
        bundles,
      });
    } catch {
      res.json({ totalHits: 0, bundles: [] });
    }
  });

  // 7. NASA Moon/Mars Trek WMTS Tile Proxy
  app.get('/api/pds/trek', async (req, res) => {
    try {
      const body = String(req.query.body ?? 'Moon') === 'Mars' ? 'Mars' : 'Moon';
      const layer = String(
        req.query.layer ??
          (body === 'Moon'
            ? 'LRO_WAC_Mosaic_Global_303ppd_v02'
            : 'Mars_Viking_MDIM21_ClrMosaic_global_232m')
      );
      const z = Number(req.query.z ?? 2);
      const row = Number(req.query.row ?? 0);
      const col = Number(req.query.col ?? 0);

      const url = `https://trek.nasa.gov/tiles/${body}/EQ/${encodeURIComponent(
        layer
      )}/1.0.0/default/default028mm/${z}/${row}/${col}.png`;

      const upstream = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!upstream.ok) {
        return res.status(404).end();
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') || 'image/png'
      );
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buf);
    } catch {
      res.status(404).end();
    }
  });

  // 8. ML Status
  app.get('/api/ml/status', (_req, res) => {
    try {
      res.json(obtenerEstadoModelos());
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error consultando ML',
      });
    }
  });

  // 9. ML Train
  app.post('/api/ml/train', async (req, res) => {
    try {
      const result = await ejecutarCiclo(req.body ?? {});
      res.json({
        ...result,
        status: obtenerEstadoModelos(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error entrenando modelos ML',
      });
    }
  });

  // 10. ML Predict
  app.post('/api/ml/predict', (req, res) => {
    try {
      const { sitioA, sitioB, t0, t1 } = req.body ?? {};
      const out = predecirPar({
        sitioA: String(sitioA || 'Tierra (Atacama, 2400 m)'),
        sitioB: String(sitioB || 'Marte (Cráter Gale)'),
        t0: Number(t0 ?? 0),
        t1: Number(t1 ?? 48),
      });
      res.json(out);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error en predicción ML',
      });
    }
  });

  // 11. ML Insert Record
  app.post('/api/ml/records', (req, res) => {
    try {
      const { tipo, x, y, origen, fuente, url, confianza } = req.body ?? {};
      if (tipo !== 'clima' && tipo !== 'similitud') {
        return res.status(400).json({ error: 'tipo debe ser clima o similitud.' });
      }
      const parsedX = typeof x === 'string' ? JSON.parse(x) : x;
      const parsedY = typeof y === 'string' ? JSON.parse(y) : y;
      const estado = guardar(
        tipo,
        parsedX,
        parsedY,
        origen === 'editor' ? 'editor' : 'autonomo',
        String(fuente || 'manual'),
        String(url || ''),
        Number(confianza ?? (origen === 'editor' ? 1.0 : 0.7))
      );
      res.json({ estado });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Datos inválidos',
      });
    }
  });

  // 12. ML Approve / Reject Pending Record
  app.post('/api/ml/records/:id/estado', (req, res) => {
    try {
      const id = Number(req.params.id);
      const estado = req.body?.estado;
      if (!Number.isFinite(id) || (estado !== 'aprobado' && estado !== 'rechazado')) {
        return res.status(400).json({ error: 'Parámetros inválidos.' });
      }
      cambiarEstado(id, estado);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error actualizando registro',
      });
    }
  });

  // 13. Whitelist CRUD
  app.get('/api/ml/whitelist', (_req, res) => {
    res.json({ dominios: listarWhitelist() });
  });

  app.post('/api/ml/whitelist', (req, res) => {
    try {
      const item = agregarDominioWhitelist(req.body ?? {});
      res.json({ item, dominios: listarWhitelist() });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Dominio inválido',
      });
    }
  });

  app.patch('/api/ml/whitelist/:id', (req, res) => {
    const id = Number(req.params.id);
    const item = actualizarDominioWhitelist(id, req.body ?? {});
    if (!item) return res.status(404).json({ error: 'Dominio no encontrado' });
    res.json({ item, dominios: listarWhitelist() });
  });

  app.delete('/api/ml/whitelist/:id', (req, res) => {
    const id = Number(req.params.id);
    const ok = eliminarDominioWhitelist(id);
    if (!ok) return res.status(404).json({ error: 'Dominio no encontrado' });
    res.json({ ok: true, dominios: listarWhitelist() });
  });

  // 14. Whitelist Ingest
  app.post('/api/ml/whitelist-ingest', (req, res) => {
    try {
      const {
        sitio,
        sourceUrl,
        hora,
        temperatura,
        presion,
        viento,
        luz,
        entrenarAhora,
      } = req.body ?? {};
      const dominioDetectado = extraerDominio(String(sourceUrl || ''));
      const reglaMatch = buscarReglaListaBlanca(String(sourceUrl || ''));
      const enListaBlanca = Boolean(reglaMatch);

      const estado = guardar(
        'clima',
        { sitio: String(sitio), hora: Number(hora ?? 12) },
        {
          temperatura: Number(temperatura),
          presion: Number(presion),
          viento: Number(viento),
          luz: Number(luz),
        },
        'autonomo',
        reglaMatch ? reglaMatch.categoria : dominioDetectado || 'externo',
        String(sourceUrl || ''),
        enListaBlanca ? 0.95 : 0.65,
        enListaBlanca
      );

      let entrenamiento = null;
      if (enListaBlanca && entrenarAhora && reglaMatch?.auto_entrenar === 1) {
        entrenamiento = entrenarTodo(800);
      }

      res.json({
        estado,
        enListaBlanca,
        dominioDetectado,
        reglaMatch,
        entrenamiento,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error ingiriendo observación',
      });
    }
  });

  // 15. Verify Search Grounding
  app.post('/api/ml/verify-search', async (req, res) => {
    try {
      const {
        consulta,
        sitio,
        sourceUrl,
        temperatura,
        presion,
        viento,
        luz,
        autoGuardar,
        autoEntrenar,
      } = req.body ?? {};

      const verificacion = await verificarConGoogleSearch({
        consulta: String(consulta || ''),
        sitio: String(sitio || 'Marte (Cráter Gale)'),
        sourceUrl: sourceUrl ? String(sourceUrl) : undefined,
        temperatura,
        presion,
        viento,
        luz,
      });

      let estadoGuardado: string | null = null;
      let entrenamiento: Record<string, number | string> | null = null;

      if (
        autoGuardar &&
        verificacion.valores.temperatura !== null &&
        verificacion.valores.presion !== null &&
        verificacion.valores.viento !== null &&
        verificacion.valores.luz !== null
      ) {
        const aprobar =
          verificacion.enListaBlanca ||
          (verificacion.verificado && verificacion.confianza >= 0.78);
        estadoGuardado = guardar(
          'clima',
          {
            sitio: verificacion.sitioSugerido,
            hora: verificacion.valores.hora,
          },
          {
            temperatura: verificacion.valores.temperatura,
            presion: verificacion.valores.presion,
            viento: verificacion.valores.viento,
            luz: verificacion.valores.luz,
          },
          'autonomo',
          verificacion.enListaBlanca ? 'NASA' : 'GoogleSearch',
          String(sourceUrl || verificacion.fuentes[0]?.uri || ''),
          verificacion.confianza,
          aprobar
        );
        if (autoEntrenar && aprobar && estadoGuardado !== 'duplicado') {
          entrenamiento = entrenarTodo(800);
        }
      }

      res.json({ verificacion, estadoGuardado, entrenamiento });
    } catch (err) {
      const code = (err as Error & { statusCode?: number }).statusCode || 500;
      res.status(code).json({
        error:
          err instanceof Error
            ? err.message
            : 'Error verificando con Google Search',
      });
    }
  });

  // Vite Dev Middleware o Dist estático en producción
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const idx = path.join(distDir, 'index.html');
      if (fs.existsSync(idx)) res.sendFile(idx);
      else res.status(404).send('Build dist/ no encontrado.');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Análogo Planetario escuchando en http://0.0.0.0:${PORT}`);
    if (!cargarModelo('clima') || !cargarModelo('similitud')) {
      setImmediate(() => {
        try {
          entrenarTodo(800);
        } catch (err) {
          console.warn('Advertencia entrenando modelos ML en segundo plano:', err);
        }
      });
    }
  });
}

bootstrap().catch((err) => {
  console.error('Error fatal al iniciar servidor:', err);
  process.exit(1);
});
