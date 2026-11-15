import { SitioAmbiental } from './analogo';

export type WearVisualMode = 'fisico' | 'termico' | 'mecanico' | 'radiacion';

export type MaterialTipo =
  | 'ti6al4v'
  | 'al7075'
  | 'kevlar_vectran'
  | 'regolito_sinterizado'
  | 'fibra_carbono';

export type RecubrimientoTipo =
  | 'ninguno'
  | 'hbn_ceramico'
  | 'kapton_mli'
  | 'anodizado_duro'
  | 'ti_al_nitruro';

export type ZonaDespliegueId =
  | 'planicie'
  | 'pendiente_rocosa'
  | 'crater_sombra'
  | 'tormenta_polvo';

export type BlindajeMaterialId =
  | 'aluminio'
  | 'polietileno'
  | 'agua'
  | 'regolito'
  | 'plomo_compuesto';

export interface CustomModelPayload {
  format: 'obj' | 'json';
  fileName: string;
  vertices?: Float32Array;
  normals?: Float32Array;
  bounds?: {
    size: [number, number, number];
    center: [number, number, number];
  };
  boxes?: Array<{
    name?: string;
    pos: [number, number, number];
    size: [number, number, number];
    color?: string;
  }>;
}

export interface HardwareSpec {
  id: string;
  nombre: string;
  tipo: 'rover' | 'traje' | 'base' | 'custom';
  descripcion: string;
  material: MaterialTipo;
  masaKg: number;
  selladoKpa: number;
  tempMinK: number;
  tempMaxK: number;
  blindajeBase: number;
  anchoRel: number;
  altoRel: number;
  customModel?: CustomModelPayload;
}

export interface ZonaDespliegue {
  id: ZonaDespliegueId;
  nombre: string;
  factorAbrasion: number;
  factorTermico: number;
  factorPolvo: number;
  factorEstresMecanico: number;
}

export interface MaterialEngineeringInfo {
  id: MaterialTipo;
  nombre: string;
  durezaMohs: number;
  ctePpmK: number;
  limiteFluenciaMpa: number;
  zEfectivo: number;
  densidadRelativa: number;
  resAbrasion: number;
  resTermica: number;
  resRadiacion: number;
  referenciaNasa: string;
  notasFalla: string;
}

export interface RecubrimientoNasaInfo {
  id: RecubrimientoTipo;
  nombre: string;
  factorAbrasion: number;
  factorTermico: number;
  factorPolvo: number;
  factorRadiacion: number;
  referenciaNasa: string;
}

export interface BlindajeRadiacionInfo {
  id: BlindajeMaterialId;
  nombre: string;
  densidadGcm3: number;
  hvlGcm2: number;
  notaNasa: string;
}

export interface ComponentPinDiagnostic {
  id: string;
  titulo: string;
  subtitulo: string;
  desgastePct: number;
  estado: 'Nominal' | 'Vigilancia' | 'Crítico';
  mecanismoDominante: string;
  tempMinK: number;
  tempMaxK: number;
  recomendacionNasa: string;
  pos3d: [number, number, number];
}

export interface WearCurvePoint {
  dia: number;
  integridad: number;
  abrasion: number;
  termica: number;
  radiacion: number;
}

export interface ThermalCyclePoint {
  ciclo: number;
  integridadEstructural: number;
  retencionPotencia: number;
  fatigaSellos: number;
}

export interface LabTelemetryBridge {
  sitioTierra: SitioAmbiental;
  sitioMarte: SitioAmbiental;
  sitioLuna: SitioAmbiental;
  sitioActivoA: SitioAmbiental;
  sitioActivoB: SitioAmbiental;
  similitudTotalPct: number;
  usaNasaEnVivo: boolean;
  earthLat: number;
  earthLon: number;
  earthStartDate: string;
  earthEndDate: string;
  proyeccionMarteActiva: boolean;
  proyeccionLunaActiva: boolean;
  proyeccionTierraActiva: boolean;
}

export interface WearMetricsResult {
  tMinLocalK: number;
  tMaxLocalK: number;
  alertaCritica: string | null;
  integridadGlobal: number;
  vidaUtilEstimadaDias: number;
  abrasionMecanica: number;
  fatigaTermica: number;
  estresPresion: number;
  degradacionRadiacion: number;
  obstruccionPolvo: number;
}

export const MATERIALES_INGENIERIA: Record<MaterialTipo, MaterialEngineeringInfo> = {
  ti6al4v: {
    id: 'ti6al4v',
    nombre: 'Titanio Ti-6Al-4V (Grado Aeroespacial)',
    durezaMohs: 6.0,
    ctePpmK: 8.6,
    limiteFluenciaMpa: 880,
    zEfectivo: 21.4,
    densidadRelativa: 1.0,
    resAbrasion: 1.25,
    resTermica: 1.35,
    resRadiacion: 1.1,
    referenciaNasa: 'NASA-STD-6016 / Chasis y suspensión Mars 2020',
    notasFalla: 'Excelente estabilidad térmica; susceptible a galling en polvo sin lubricante sólido.',
  },
  al7075: {
    id: 'al7075',
    nombre: 'Aluminio 7075-T651',
    durezaMohs: 3.5,
    ctePpmK: 23.6,
    limiteFluenciaMpa: 503,
    zEfectivo: 13.0,
    densidadRelativa: 0.64,
    resAbrasion: 0.78,
    resTermica: 0.85,
    resRadiacion: 1.22,
    referenciaNasa: 'NASA-TM-2019 / Estructura primaria y ruedas',
    notasFalla: 'Alto coeficiente de expansión (CTE) acelera fatiga en uniones con saltos >150 K.',
  },
  kevlar_vectran: {
    id: 'kevlar_vectran',
    nombre: 'Compuesto Orthofabric (Kevlar / Vectran)',
    durezaMohs: 2.8,
    ctePpmK: 4.5,
    limiteFluenciaMpa: 3600,
    zEfectivo: 6.2,
    densidadRelativa: 0.35,
    resAbrasion: 0.65,
    resTermica: 1.05,
    resRadiacion: 1.32,
    referenciaNasa: 'NASA xEMU / Capas exteriores TMG Artemis',
    notasFalla: 'Los granos vítreos de regolito lunar cortan microfibras tras ciclos de flexión.',
  },
  regolito_sinterizado: {
    id: 'regolito_sinterizado',
    nombre: 'Regolito Basáltico Sinterizado (ISRU)',
    durezaMohs: 6.8,
    ctePpmK: 7.2,
    limiteFluenciaMpa: 185,
    zEfectivo: 12.1,
    densidadRelativa: 0.72,
    resAbrasion: 1.45,
    resTermica: 1.15,
    resRadiacion: 1.38,
    referenciaNasa: 'NASA STMD Moon-to-Mars ISRU Construction',
    notasFalla: 'Alta dureza superficial frente a polvo, pero baja tenacidad ante tracción térmica.',
  },
  fibra_carbono: {
    id: 'fibra_carbono',
    nombre: 'CFRP Epoxi Alto Módulo (M55J)',
    durezaMohs: 4.2,
    ctePpmK: 0.8,
    limiteFluenciaMpa: 1950,
    zEfectivo: 6.5,
    densidadRelativa: 0.41,
    resAbrasion: 0.88,
    resTermica: 1.28,
    resRadiacion: 0.92,
    referenciaNasa: 'NASA JPL Mástil y brazos compuestos',
    notasFalla: 'La radiación UV/ionizante degrada gradualmente la matriz polimérica superficial.',
  },
};

export const RECUBRIMIENTOS_NASA: Record<RecubrimientoTipo, RecubrimientoNasaInfo> = {
  ninguno: {
    id: 'ninguno',
    nombre: 'Sin recubrimiento adicional (Base desnuda)',
    factorAbrasion: 1.0,
    factorTermico: 1.0,
    factorPolvo: 1.0,
    factorRadiacion: 1.0,
    referenciaNasa: 'Superficie estándar sin tratamiento superficial',
  },
  hbn_ceramico: {
    id: 'hbn_ceramico',
    nombre: 'Nitruro de Boro Hexagonal + Cerámico EDS',
    factorAbrasion: 0.68,
    factorTermico: 0.78,
    factorPolvo: 0.52,
    factorRadiacion: 0.9,
    referenciaNasa: 'NASA KSC Electrodynamic Dust Shield (CLPS)',
  },
  kapton_mli: {
    id: 'kapton_mli',
    nombre: 'Manta Térmica MLI Kapton Aluminizado',
    factorAbrasion: 0.92,
    factorTermico: 0.52,
    factorPolvo: 0.85,
    factorRadiacion: 0.88,
    referenciaNasa: 'NASA-HDBK-4002 Thermal Control Blanket',
  },
  anodizado_duro: {
    id: 'anodizado_duro',
    nombre: 'Anodizado Duro MIL-A-8625 Tipo III',
    factorAbrasion: 0.72,
    factorTermico: 0.86,
    factorPolvo: 0.78,
    factorRadiacion: 0.96,
    referenciaNasa: 'NASA JPL Mars Surface Tribology',
  },
  ti_al_nitruro: {
    id: 'ti_al_nitruro',
    nombre: 'Recubrimiento PVD TiAlN (Alta Dureza)',
    factorAbrasion: 0.56,
    factorTermico: 0.74,
    factorPolvo: 0.68,
    factorRadiacion: 0.94,
    referenciaNasa: 'NASA GRC Regolith Abrasion Coating',
  },
};

export const ZONAS_DESPLIEGUE: ZonaDespliegue[] = [
  {
    id: 'planicie',
    nombre: 'Planicie de regolito compactado (Nominal)',
    factorAbrasion: 1.0,
    factorTermico: 1.0,
    factorPolvo: 1.0,
    factorEstresMecanico: 1.0,
  },
  {
    id: 'pendiente_rocosa',
    nombre: 'Pendiente rocosa y brechas (>15°)',
    factorAbrasion: 1.42,
    factorTermico: 1.08,
    factorPolvo: 1.18,
    factorEstresMecanico: 1.48,
  },
  {
    id: 'crater_sombra',
    nombre: 'Borde de cráter en sombra criogénica',
    factorAbrasion: 1.15,
    factorTermico: 1.55,
    factorPolvo: 1.1,
    factorEstresMecanico: 1.25,
  },
  {
    id: 'tormenta_polvo',
    nombre: 'Corredor eólico / tormenta de polvo',
    factorAbrasion: 1.35,
    factorTermico: 0.92,
    factorPolvo: 1.75,
    factorEstresMecanico: 1.2,
  },
];

export const BLINDAJES_RADIACION: Record<BlindajeMaterialId, BlindajeRadiacionInfo> = {
  polietileno: {
    id: 'polietileno',
    nombre: 'Polietileno de Alta Densidad (HDPE)',
    densidadGcm3: 0.96,
    hvlGcm2: 18.5,
    notaNasa: 'Óptimo por masa gracias a su alto contenido en hidrógeno; minimiza neutrones secundarios GCR.',
  },
  agua: {
    id: 'agua',
    nombre: 'Muro de Agua Potable / Hidrogel',
    densidadGcm3: 1.0,
    hvlGcm2: 19.2,
    notaNasa: 'Doble función soporte vital + atenuación de protones solares SPE en refugios de tripulación.',
  },
  aluminio: {
    id: 'aluminio',
    nombre: 'Aluminio Estructural 2219 / 7075',
    densidadGcm3: 2.78,
    hvlGcm2: 34.0,
    notaNasa: 'Estándar de casco presurizado; espesores excesivos generan cascada secundaria si no se combina con H₂.',
  },
  regolito: {
    id: 'regolito',
    nombre: 'Sacos / Ladrillos de Regolito Compactado',
    densidadGcm3: 1.85,
    hvlGcm2: 26.5,
    notaNasa: 'Mass-shielding in situ económico para hábitats permanentes lunares y marcianos (>40 cm ideales).',
  },
  plomo_compuesto: {
    id: 'plomo_compuesto',
    nombre: 'Compuesto Polímero–Plomo / Tantalio',
    densidadGcm3: 6.4,
    hvlGcm2: 29.0,
    notaNasa: 'Compacto para electrónica sensible, pero penaliza la masa de lanzamiento en hábitats grandes.',
  },
};

export const PRESET_HARDWARE_SPECS: HardwareSpec[] = [
  {
    id: 'rover-6x6',
    nombre: 'Rover 6×6 Explorador',
    tipo: 'rover',
    descripcion: 'Plataforma móvil de 6 ruedas rocker-bogie con mástil óptico, brazo y panel RTG/solar.',
    material: 'ti6al4v',
    masaKg: 899,
    selladoKpa: 10,
    tempMinK: 135,
    tempMaxK: 395,
    blindajeBase: 1.25,
    anchoRel: 1.0,
    altoRel: 1.0,
  },
  {
    id: 'traje-eva',
    nombre: 'Traje Espacial EVA (xEMU)',
    tipo: 'traje',
    descripcion: 'Unidad extravehicular presurizada con visor dorado, mochila PLSS y juntas rotatorias.',
    material: 'kevlar_vectran',
    masaKg: 136,
    selladoKpa: 30,
    tempMinK: 120,
    tempMaxK: 390,
    blindajeBase: 0.9,
    anchoRel: 0.75,
    altoRel: 1.2,
  },
  {
    id: 'base-permanente',
    nombre: 'Base Permanente (Domo + Esclusa)',
    tipo: 'base',
    descripcion: 'Hábitat geodésico presurizado a 70 kPa con esclusa de descontaminación y campo fotovoltaico.',
    material: 'regolito_sinterizado',
    masaKg: 18500,
    selladoKpa: 70,
    tempMinK: 110,
    tempMaxK: 380,
    blindajeBase: 1.85,
    anchoRel: 1.8,
    altoRel: 1.35,
  },
];

export const SAMPLE_OBJ_ROVER = `# Prototipo Rover Ligero Análogo Planetario
o Chasis_Principal
v -0.9 0.35 -0.6
v 0.9 0.35 -0.6
v 0.9 0.35 0.6
v -0.9 0.35 0.6
v -0.9 0.85 -0.6
v 0.9 0.85 -0.6
v 0.9 0.85 0.6
v -0.9 0.85 0.6
f 1 2 3
f 1 3 4
f 5 7 6
f 5 8 7
f 1 5 6
f 1 6 2
f 2 6 7
f 2 7 3
f 3 7 8
f 3 8 4
f 4 8 5
f 4 5 1
o Mastil_Sensor
v 0.45 0.85 -0.12
v 0.65 0.85 -0.12
v 0.65 0.85 0.12
v 0.45 0.85 0.12
v 0.48 1.65 -0.1
v 0.62 1.65 -0.1
v 0.62 1.65 0.1
v 0.48 1.65 0.1
f 9 10 11
f 9 11 12
f 13 15 14
f 13 16 15
f 9 13 14
f 9 14 10
f 10 14 15
f 10 15 11
f 11 15 16
f 11 16 12
f 12 16 13
f 12 13 9
o Cabezal_Optico
v 0.35 1.65 -0.22
v 0.78 1.65 -0.22
v 0.78 1.65 0.22
v 0.35 1.65 0.22
v 0.35 1.88 -0.22
v 0.78 1.88 -0.22
v 0.78 1.88 0.22
v 0.35 1.88 0.22
f 17 18 19
f 17 19 20
f 21 23 22
f 21 24 23
f 17 21 22
f 17 22 18
f 18 22 23
f 18 23 19
f 19 23 24
f 19 24 20
f 20 24 21
f 20 21 17
`;

export function parseObjModel(text: string, fileName: string): CustomModelPayload {
  const rawVerts: Array<[number, number, number]> = [];
  const triPositions: number[] = [];

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v' && parts.length >= 4) {
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        rawVerts.push([x, y, z]);
      }
    } else if (parts[0] === 'f' && parts.length >= 4) {
      const indices: number[] = [];
      for (let i = 1; i < parts.length; i++) {
        const vIdxStr = parts[i].split('/')[0];
        let vIdx = Number.parseInt(vIdxStr, 10);
        if (!Number.isFinite(vIdx)) continue;
        if (vIdx < 0) vIdx = rawVerts.length + vIdx;
        else vIdx -= 1;
        if (vIdx >= 0 && vIdx < rawVerts.length) indices.push(vIdx);
      }
      for (let i = 1; i < indices.length - 1; i++) {
        const a = rawVerts[indices[0]];
        const b = rawVerts[indices[i]];
        const c = rawVerts[indices[i + 1]];
        triPositions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      }
    }
  }

  if (triPositions.length < 9) {
    throw new Error('El archivo .OBJ no contiene caras triangulares válidas.');
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < triPositions.length; i += 3) {
    minX = Math.min(minX, triPositions[i]);
    minY = Math.min(minY, triPositions[i + 1]);
    minZ = Math.min(minZ, triPositions[i + 2]);
    maxX = Math.max(maxX, triPositions[i]);
    maxY = Math.max(maxY, triPositions[i + 1]);
    maxZ = Math.max(maxZ, triPositions[i + 2]);
  }

  const sizeX = Math.max(0.01, maxX - minX);
  const sizeY = Math.max(0.01, maxY - minY);
  const sizeZ = Math.max(0.01, maxZ - minZ);
  const maxDim = Math.max(sizeX, sizeY, sizeZ);
  const scale = 2.4 / maxDim;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const vertices = new Float32Array(triPositions.length);
  const normals = new Float32Array(triPositions.length);

  for (let i = 0; i < triPositions.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const idx = i + k * 3;
      vertices[idx] = (triPositions[idx] - cx) * scale;
      vertices[idx + 1] = (triPositions[idx + 1] - minY) * scale;
      vertices[idx + 2] = (triPositions[idx + 2] - cz) * scale;
    }
    const ax = vertices[i];
    const ay = vertices[i + 1];
    const az = vertices[i + 2];
    const bx = vertices[i + 3] - ax;
    const by = vertices[i + 4] - ay;
    const bz = vertices[i + 5] - az;
    const dx = vertices[i + 6] - ax;
    const dy = vertices[i + 7] - ay;
    const dz = vertices[i + 8] - az;
    let nx = by * dz - bz * dy;
    let ny = bz * dx - bx * dz;
    let nz = bx * dy - by * dx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (let k = 0; k < 3; k++) {
      const idx = i + k * 3;
      normals[idx] = nx;
      normals[idx + 1] = ny;
      normals[idx + 2] = nz;
    }
  }

  return {
    format: 'obj',
    fileName,
    vertices,
    normals,
    bounds: {
      size: [sizeX * scale, sizeY * scale, sizeZ * scale],
      center: [0, (sizeY * scale) / 2, 0],
    },
  };
}

export function parseCustomJsonSpec(
  text: string,
  fileName: string
): { specPatch: Partial<HardwareSpec>; payload: CustomModelPayload } {
  const parsed = JSON.parse(text) as {
    nombre?: string;
    descripcion?: string;
    material?: MaterialTipo;
    masaKg?: number;
    selladoKpa?: number;
    tempMinK?: number;
    tempMaxK?: number;
    blindajeBase?: number;
    boxes?: Array<{
      name?: string;
      pos: [number, number, number];
      size: [number, number, number];
      color?: string;
    }>;
  };

  const boxes = Array.isArray(parsed.boxes) && parsed.boxes.length
    ? parsed.boxes
    : [
        { name: 'Cuerpo principal', pos: [0, 0.55, 0] as [number, number, number], size: [1.5, 0.65, 1.1] as [number, number, number] },
        { name: 'Módulo de carga', pos: [0.35, 1.15, 0] as [number, number, number], size: [0.6, 0.55, 0.6] as [number, number, number] },
      ];

  const validMaterial = parsed.material && parsed.material in MATERIALES_INGENIERIA
    ? parsed.material
    : 'ti6al4v';

  return {
    specPatch: {
      nombre: parsed.nombre,
      descripcion: parsed.descripcion,
      material: validMaterial,
      masaKg: typeof parsed.masaKg === 'number' ? parsed.masaKg : 480,
      selladoKpa: typeof parsed.selladoKpa === 'number' ? parsed.selladoKpa : 20,
      tempMinK: typeof parsed.tempMinK === 'number' ? parsed.tempMinK : 135,
      tempMaxK: typeof parsed.tempMaxK === 'number' ? parsed.tempMaxK : 390,
      blindajeBase: typeof parsed.blindajeBase === 'number' ? parsed.blindajeBase : 1.2,
    },
    payload: {
      format: 'json',
      fileName,
      boxes,
    },
  };
}

export function calcularDesgasteEnDia(
  sitio: SitioAmbiental,
  hw: HardwareSpec,
  zona: ZonaDespliegue,
  dias: number,
  recubrimiento: RecubrimientoTipo = 'ninguno'
): WearMetricsResult {
  const mat = MATERIALES_INGENIERIA[hw.material];
  const coat = RECUBRIMIENTOS_NASA[recubrimiento];

  const ampLocal = sitio.T[1] * zona.factorTermico;
  const tMinLocalK = Math.max(20, sitio.T[0] - ampLocal);
  const tMaxLocalK = sitio.T[0] + ampLocal;
  const deltaT = tMaxLocalK - tMinLocalK;

  // Silicatos + Fe2O3 generan mayor abrasividad mineral
  const silicaRatio = (sitio.suelo.SiO2 ?? 0.45) + 0.6 * (sitio.suelo.Fe2O3 ?? 0.12);
  const factorAbrasionSuelo =
    (0.75 + silicaRatio * 0.65 + sitio.rugosidad * 4.5 + sitio.pendiente * 0.015) *
    zona.factorAbrasion;
  const windAbrasion = 1 + sitio.viento[0] * 0.045;

  const abrasionRate =
    ((0.065 * factorAbrasionSuelo * windAbrasion) / mat.resAbrasion) * coat.factorAbrasion;
  const abrasionMecanica = Math.min(100, abrasionRate * dias * (hw.tipo === 'base' ? 0.55 : 1.0));

  const ciclosPorDia = 24 / Math.max(12, sitio.periodo);
  const ciclosTotales = Math.max(1, dias * ciclosPorDia);
  const excesoTermico =
    Math.max(0, hw.tempMinK - tMinLocalK) * 0.04 +
    Math.max(0, tMaxLocalK - hw.tempMaxK) * 0.05;
  const cteStress = (mat.ctePpmK / 10) * Math.pow(Math.max(20, deltaT) / 90, 1.35);
  const fatigaTermica = Math.min(
    100,
    ((cteStress * 0.24 * Math.pow(ciclosTotales, 0.72)) / mat.resTermica) *
      coat.factorTermico +
      excesoTermico * Math.min(30, dias * 0.25)
  );

  const deltaPresionKpa = Math.abs(hw.selladoKpa - sitio.P[0] / 1000);
  const estresPresion = Math.min(
    100,
    deltaPresionKpa * 0.28 * zona.factorEstresMecanico * (1 + Math.log10(1 + dias) * 0.35)
  );

  const radFactor = Math.max(0.05, sitio.radiacion) / 30;
  const degradacionRadiacion = Math.min(
    100,
    ((0.032 * radFactor * dias) / (mat.resRadiacion * hw.blindajeBase)) *
      coat.factorRadiacion
  );

  const polvoExposicion =
    (sitio.viento[0] > 0.2 ? 0.9 + sitio.viento[0] * 0.11 : 0.75) *
    zona.factorPolvo *
    coat.factorPolvo;
  const obstruccionPolvo = Math.min(100, 0.14 * dias * polvoExposicion);

  const ponderadoDano =
    0.34 * abrasionMecanica +
    0.3 * fatigaTermica +
    0.16 * estresPresion +
    0.14 * degradacionRadiacion +
    0.06 * obstruccionPolvo;

  const integridadGlobal = Math.max(0, Math.min(100, 100 - ponderadoDano));

  const tasaDiaria = Math.max(0.015, ponderadoDano / Math.max(1, dias));
  const vidaUtilEstimadaDias = Math.min(3650, Math.round(50 / tasaDiaria));

  let alertaCritica: string | null = null;
  if (tMinLocalK < hw.tempMinK - 10) {
    alertaCritica = `Alerta térmica: temperatura mínima local (${tMinLocalK.toFixed(0)} K) por debajo del límite nominal (${hw.tempMinK} K). Riesgo de fragilización en sellos.`;
  } else if (tMaxLocalK > hw.tempMaxK + 10) {
    alertaCritica = `Sobrecalentamiento local (${tMaxLocalK.toFixed(0)} K > ${hw.tempMaxK} K). Se recomienda aislamiento MLI o radiador adicional.`;
  } else if (integridadGlobal < 45) {
    alertaCritica = `Integridad global crítica (${integridadGlobal.toFixed(1)}%) a los ${dias} días. Mantenimiento preventivo o cambio de recubrimiento requerido.`;
  }

  return {
    tMinLocalK,
    tMaxLocalK,
    alertaCritica,
    integridadGlobal,
    vidaUtilEstimadaDias,
    abrasionMecanica,
    fatigaTermica,
    estresPresion,
    degradacionRadiacion,
    obstruccionPolvo,
  };
}

export function simularCurvaDesgaste(
  sitio: SitioAmbiental,
  hw: HardwareSpec,
  zona: ZonaDespliegue,
  maxDias: number = 730,
  pasos: number = 60,
  recubrimiento: RecubrimientoTipo = 'ninguno'
): WearCurvePoint[] {
  const pts: WearCurvePoint[] = [];
  for (let i = 0; i <= pasos; i++) {
    const dia = Math.max(1, Math.round((i / pasos) * maxDias));
    const m = calcularDesgasteEnDia(sitio, hw, zona, dia, recubrimiento);
    pts.push({
      dia,
      integridad: m.integridadGlobal,
      abrasion: m.abrasionMecanica,
      termica: m.fatigaTermica,
      radiacion: m.degradacionRadiacion,
    });
  }
  return pts;
}

export function diagnosticarComponentesHardware(
  sitio: SitioAmbiental,
  hw: HardwareSpec,
  zona: ZonaDespliegue,
  dias: number,
  recubrimiento: RecubrimientoTipo = 'ninguno'
): ComponentPinDiagnostic[] {
  const m = calcularDesgasteEnDia(sitio, hw, zona, dias, recubrimiento);
  const clasificar = (d: number): 'Nominal' | 'Vigilancia' | 'Crítico' =>
    d >= 45 ? 'Crítico' : d >= 22 ? 'Vigilancia' : 'Nominal';

  if (hw.tipo === 'traje') {
    const dVisor = Math.min(100, m.abrasionMecanica * 0.7 + m.obstruccionPolvo * 0.45);
    const dJuntas = Math.min(100, m.abrasionMecanica * 1.15 + m.estresPresion * 0.55);
    const dPlss = Math.min(100, m.fatigaTermica * 0.95 + m.degradacionRadiacion * 0.7);
    const dBotas = Math.min(100, m.abrasionMecanica * 1.35);
    return [
      {
        id: 'visor',
        titulo: 'Visor Policarbonato + Oro',
        subtitulo: 'Protección UV/IR y microimpactos',
        desgastePct: dVisor,
        estado: clasificar(dVisor),
        mecanismoDominante: 'Rayado por polvo fino y electrostática',
        tempMinK: m.tMinLocalK + 18,
        tempMaxK: m.tMaxLocalK - 12,
        recomendacionNasa: 'Aplicar lámina reemplazable y limpieza sin contacto (EDS).',
        pos3d: [0, 1.56, 0.2],
      },
      {
        id: 'juntas',
        titulo: 'Rodamientos y Juntas de Codo/Hombro',
        subtitulo: `Sellado a ${hw.selladoKpa} kPa`,
        desgastePct: dJuntas,
        estado: clasificar(dJuntas),
        mecanismoDominante: 'Infiltración de regolito y fatiga elastomérica',
        tempMinK: m.tMinLocalK + 8,
        tempMaxK: m.tMaxLocalK - 5,
        recomendacionNasa: 'Fuelles protectores de Vectran + sellos dobles de fluorosilicona.',
        pos3d: [0.42, 1.18, 0.05],
      },
      {
        id: 'plss',
        titulo: 'Mochila PLSS y Sublimador',
        subtitulo: 'Control térmico y aviónica vital',
        desgastePct: dPlss,
        estado: clasificar(dPlss),
        mecanismoDominante: 'Ciclado térmico día–noche + radiación',
        tempMinK: m.tMinLocalK + 22,
        tempMaxK: m.tMaxLocalK - 15,
        recomendacionNasa: 'Manta MLI multicapa y radiador de alta emisividad.',
        pos3d: [0, 1.18, -0.35],
      },
      {
        id: 'botas',
        titulo: 'Suelas y Polainas Lunares/Marcianas',
        subtitulo: 'Contacto directo con regolito',
        desgastePct: dBotas,
        estado: clasificar(dBotas),
        mecanismoDominante: 'Abrasión cortante por basalto y brechas',
        tempMinK: m.tMinLocalK,
        tempMaxK: m.tMaxLocalK,
        recomendacionNasa: 'Refuerzo de caucho fluorado con inserto metálico Ti-6Al-4V.',
        pos3d: [-0.18, 0.14, 0.1],
      },
    ];
  }

  if (hw.tipo === 'base') {
    const dDomo = Math.min(100, m.estresPresion * 0.9 + m.fatigaTermica * 0.65 + m.degradacionRadiacion * 0.45);
    const dEsclusa = Math.min(100, m.abrasionMecanica * 1.1 + m.obstruccionPolvo * 0.65);
    const dSolar = Math.min(100, m.obstruccionPolvo * 1.2 + m.degradacionRadiacion * 0.6);
    const dCimentacion = Math.min(100, m.fatigaTermica * 0.8 + m.abrasionMecanica * 0.55);
    return [
      {
        id: 'domo',
        titulo: 'Cúpula Presurizada Principal',
        subtitulo: `Presión interna ${hw.selladoKpa} kPa`,
        desgastePct: dDomo,
        estado: clasificar(dDomo),
        mecanismoDominante: 'Tensión diferencial y fatiga por gradiente ΔT',
        tempMinK: m.tMinLocalK + 25,
        tempMaxK: m.tMaxLocalK - 20,
        recomendacionNasa: 'Sobrecubierta de regolito sinterizado (≥35 cm) para amortiguar ΔT y radiación.',
        pos3d: [0, 1.25, 0],
      },
      {
        id: 'esclusa',
        titulo: 'Esclusa EVA y Sellos de Compuerta',
        subtitulo: 'Transferencia de polvo en ciclos de salida',
        desgastePct: dEsclusa,
        estado: clasificar(dEsclusa),
        mecanismoDominante: 'Abrasión de juntas por regolito electrostático',
        tempMinK: m.tMinLocalK + 10,
        tempMaxK: m.tMaxLocalK - 8,
        recomendacionNasa: 'Suitports traseros + cortina electrodinámica EDS en umbral.',
        pos3d: [1.35, 0.55, 0],
      },
      {
        id: 'paneles',
        titulo: 'Matriz Fotovoltaica Externa',
        subtitulo: 'Generación energética superficial',
        desgastePct: dSolar,
        estado: clasificar(dSolar),
        mecanismoDominante: 'Deposición de polvo e ionización de celdas',
        tempMinK: m.tMinLocalK - 4,
        tempMaxK: m.tMaxLocalK + 12,
        recomendacionNasa: 'Recubrimiento antiadherente h-BN y barrido electrostático.',
        pos3d: [-1.45, 0.45, 0.6],
      },
      {
        id: 'cimentacion',
        titulo: 'Anclaje y Cimentación Térmica',
        subtitulo: `Pendiente ${sitio.pendiente}°`,
        desgastePct: dCimentacion,
        estado: clasificar(dCimentacion),
        mecanismoDominante: 'Dilatación diferencial suelo–estructura',
        tempMinK: m.tMinLocalK + 15,
        tempMaxK: m.tMaxLocalK - 25,
        recomendacionNasa: 'Juntas deslizantes con pasadores de titanio Ti-6Al-4V.',
        pos3d: [0, 0.15, 1.15],
      },
    ];
  }

  // Rover 6x6 o custom
  const dRuedas = Math.min(100, m.abrasionMecanica * 1.25);
  const dChasis = Math.min(100, m.fatigaTermica * 0.85 + m.degradacionRadiacion * 0.55);
  const dMastil = Math.min(100, m.obstruccionPolvo * 0.9 + m.fatigaTermica * 0.6);
  const dPanel = Math.min(100, m.obstruccionPolvo * 1.15 + m.degradacionRadiacion * 0.65);

  return [
    {
      id: 'ruedas',
      titulo: 'Ruedas Metálicas y Bandas de Rodadura',
      subtitulo: 'Interacción continua con regolito',
      desgastePct: dRuedas,
      estado: clasificar(dRuedas),
      mecanismoDominante: 'Abrasión mineral y fatiga por torsión en rocas',
      tempMinK: m.tMinLocalK,
      tempMaxK: m.tMaxLocalK,
      recomendacionNasa: 'Llantas flexibles de Nitinol / Ti-6Al-4V con garras anodizadas.',
      pos3d: [0.85, 0.25, 0.72],
    },
    {
      id: 'chasis',
      titulo: 'Caja Térmica (WEB) y Aviónica',
      subtitulo: 'Electrónica de vuelo y baterías',
      desgastePct: dChasis,
      estado: clasificar(dChasis),
      mecanismoDominante: 'Ciclado térmico y dosis ionizante acumulada',
      tempMinK: m.tMinLocalK + 28,
      tempMaxK: m.tMaxLocalK - 24,
      recomendacionNasa: 'Aislamiento aerogel + blindaje HDPE local de ≥4 g/cm².',
      pos3d: [0, 0.66, 0],
    },
    {
      id: 'mastil',
      titulo: 'Mástil y Cabezal Óptico',
      subtitulo: 'Cámaras, espectrómetro y actuadores',
      desgastePct: dMastil,
      estado: clasificar(dMastil),
      mecanismoDominante: 'Polvo en engranajes y condensación nocturna',
      tempMinK: m.tMinLocalK + 5,
      tempMaxK: m.tMaxLocalK - 4,
      recomendacionNasa: 'Sellos laberínticos + cubierta calefactada para lentes.',
      pos3d: [0.55, 1.52, 0.2],
    },
    {
      id: 'energia',
      titulo: 'Cubierta Solar / Radiador RTG',
      subtitulo: 'Disipación y captación energética',
      desgastePct: dPanel,
      estado: clasificar(dPanel),
      mecanismoDominante: 'Obstrucción por polvo fino y erosión eólica',
      tempMinK: m.tMinLocalK - 5,
      tempMaxK: m.tMaxLocalK + 14,
      recomendacionNasa: 'Tratamiento cerámico h-BN de baja adhesión triboeléctrica.',
      pos3d: [-0.45, 0.92, -0.15],
    },
  ];
}

export function compararMaterialesYRecubrimientos(
  sitio: SitioAmbiental,
  hw: HardwareSpec,
  zona: ZonaDespliegue,
  dias: number,
  recubrimiento: RecubrimientoTipo
): Array<{
  material: MaterialEngineeringInfo;
  integridadPct: number;
  abrasionPct: number;
  termicaPct: number;
  radiacionPct: number;
  vidaUtilDias: number;
  masaEstimadaKg: number;
}> {
  const baseDens = MATERIALES_INGENIERIA[hw.material].densidadRelativa || 1;
  return Object.values(MATERIALES_INGENIERIA).map((mat) => {
    const res = calcularDesgasteEnDia(
      sitio,
      { ...hw, material: mat.id },
      zona,
      dias,
      recubrimiento
    );
    return {
      material: mat,
      integridadPct: res.integridadGlobal,
      abrasionPct: res.abrasionMecanica,
      termicaPct: res.fatigaTermica,
      radiacionPct: res.degradacionRadiacion,
      vidaUtilDias: res.vidaUtilEstimadaDias,
      masaEstimadaKg: Math.round(hw.masaKg * (mat.densidadRelativa / baseDens)),
    };
  });
}

export function calcularBlindajeRadiacion(
  sitio: SitioAmbiental,
  shieldMaterial: BlindajeMaterialId,
  espesorCm: number,
  dias: number
): {
  arealDensityGcm2: number;
  dosisAtenuadaMsvDia: number;
  atenuacionPct: number;
  dosisTotalMisionMsv: number;
  fraccionLimiteNasa600MsvPct: number;
  nivelSeguridadTripulacion: string;
  riesgoElectronica: string;
} {
  const info = BLINDAJES_RADIACION[shieldMaterial];
  const arealDensityGcm2 = info.densidadGcm3 * Math.max(0.1, espesorCm);
  const dosisBaseMsvDia = (Math.max(0.01, sitio.radiacion) * 24) / 1000;
  const factorAtenuacion = Math.exp(-arealDensityGcm2 / info.hvlGcm2);
  const dosisAtenuadaMsvDia = dosisBaseMsvDia * factorAtenuacion;
  const atenuacionPct = (1 - factorAtenuacion) * 100;
  const dosisTotalMisionMsv = dosisAtenuadaMsvDia * Math.max(1, dias);
  const fraccionLimiteNasa600MsvPct = (dosisTotalMisionMsv / 600) * 100;

  let nivelSeguridadTripulacion = 'Óptimo (Bajo límite ALARA NASA)';
  if (fraccionLimiteNasa600MsvPct > 100) {
    nivelSeguridadTripulacion = 'Excede límite de carrera NASA (600 mSv)';
  } else if (fraccionLimiteNasa600MsvPct > 45) {
    nivelSeguridadTripulacion = 'Margen moderado (reforzar refugio SPE)';
  }

  let riesgoElectronica = 'Bajo (COTS tolerante suficiente)';
  if (dosisTotalMisionMsv > 180) {
    riesgoElectronica = 'Alto (requiere componentes Rad-Hard / TMR)';
  } else if (dosisTotalMisionMsv > 60) {
    riesgoElectronica = 'Medio (se recomienda memoria ECC y watchdog)';
  }

  return {
    arealDensityGcm2,
    dosisAtenuadaMsvDia,
    atenuacionPct,
    dosisTotalMisionMsv,
    fraccionLimiteNasa600MsvPct,
    nivelSeguridadTripulacion,
    riesgoElectronica,
  };
}

export function simularFatigaCiclosDiaNoche(
  sitio: SitioAmbiental,
  hw: HardwareSpec,
  zona: ZonaDespliegue,
  recubrimiento: RecubrimientoTipo,
  maxCiclos: number = 1000
): {
  deltaTCicloK: number;
  ciclosHastaFalla50: number;
  puntos: ThermalCyclePoint[];
} {
  const mat = MATERIALES_INGENIERIA[hw.material];
  const coat = RECUBRIMIENTOS_NASA[recubrimiento];
  const deltaTCicloK = Math.max(10, 2 * sitio.T[1] * zona.factorTermico);

  // Relación tipo Coffin-Manson ajustada por CTE y recubrimiento
  const factorSeveridad =
    (mat.ctePpmK / 12 + 0.35) *
    Math.pow(deltaTCicloK / 110, 1.65) *
    (coat.factorTermico / mat.resTermica) *
    zona.factorEstresMecanico;

  const nfBase = Math.max(120, Math.round(1450 / Math.max(0.25, factorSeveridad)));
  const pasos = 50;
  const puntos: ThermalCyclePoint[] = [];

  for (let i = 0; i <= pasos; i++) {
    const ciclo = Math.round((i / pasos) * maxCiclos);
    const ratio = ciclo / nfBase;
    const dano = 50 * Math.pow(ratio, 0.85);
    const integridadEstructural = Math.max(0, Math.min(100, 100 - dano));
    const retencionPotencia = Math.max(
      15,
      Math.min(100, 100 - dano * 0.62 - Math.min(28, (ciclo / maxCiclos) * 18 * zona.factorPolvo * coat.factorPolvo))
    );
    const fatigaSellos = Math.max(0, Math.min(100, dano * 1.18));
    puntos.push({
      ciclo,
      integridadEstructural,
      retencionPotencia,
      fatigaSellos,
    });
  }

  return {
    deltaTCicloK,
    ciclosHastaFalla50: nfBase,
    puntos,
  };
}
