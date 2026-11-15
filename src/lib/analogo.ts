export type VariableContinua =
  | 'temperatura'
  | 'presion'
  | 'viento'
  | 'luz'
  | 'gravedad'
  | 'radiacion';

export type VariableAnalogo =
  | VariableContinua
  | 'aire'
  | 'suelo'
  | 'terreno';

export type ModoComparacion = 'reloj' | 'ciclo';
export type ModoProyeccionLatitud = 'lineal' | 'sinusoidal';
export type PerfilRecomendacion = 'rover' | 'traje' | 'base' | 'equilibrado';

export interface ProyeccionLatitudConfig {
  activa: boolean;
  latDestino: number;
  modo: ModoProyeccionLatitud;
  gradienteLineal: number;
  deltaEpSin: number;
  escalarAmplitud: boolean;
}

export interface DesplazamientoTemp {
  deltaMedia: number;
  factorAmplitud: number;
  latOrigen: number;
  latDestino: number;
  modo: ModoProyeccionLatitud;
}

export interface SerieMedidaNASA {
  fuente: string;
  lat: number;
  lon: number;
  elevacionM: number | null;
  start: string;
  end: string;
  horas: number[];
  etiquetas: string[];
  temperaturaK: number[];
  presionPa: number[];
  vientoMs: number[];
  luzWm2: number[];
}

export interface SitioAmbiental {
  id: string;
  nombre: string;
  lat?: number;
  lon?: number;
  fuenteDatos?: string;
  periodo: number;
  T: [number, number];
  P: [number, number];
  viento: [number, number];
  luz: [number, number | null];
  g: number;
  radiacion: number;
  aire: Record<string, number>;
  suelo: Record<string, number>;
  pendiente: number;
  rugosidad: number;
  usarSerieMedida?: boolean;
  serieMedida?: SerieMedidaNASA | null;
  desplazamientoTemp?: DesplazamientoTemp;
}

export interface AnalogoTerrestrePreset {
  id: string;
  nombre: string;
  etiquetaSitio: string;
  lat: number;
  lon: number;
  T: [number, number];
  P: [number, number];
  viento: [number, number];
  luz: [number, number | null];
  suelo: Record<string, number>;
  pendiente: number;
  rugosidad: number;
  radiacion: number;
  queryCmr: string;
  descripcion: string;
}

export interface AnalogoPlanetarioPds {
  id: string;
  cuerpo: 'luna' | 'marte';
  nombre: string;
  etiquetaSitio: string;
  lat: number;
  lon: number;
  misionFuente: string;
  periodo: number;
  T: [number, number];
  P: [number, number];
  viento: [number, number];
  luz: [number, number | null];
  g: number;
  radiacion: number;
  aire: Record<string, number>;
  suelo: Record<string, number>;
  pendiente: number;
  rugosidad: number;
  queryPds: string;
}

export interface SeriesSitio {
  t: number[];
  temperatura: number[];
  presion: number[];
  viento: number[];
  luz: number[];
  gravedad: number[];
  radiacion: number[];
}

export interface ResultadoComparacion {
  sitioA: string;
  sitioB: string;
  ventana: [number, number];
  modo: ModoComparacion;
  n: number;
  porVariable: Record<VariableAnalogo, number>;
  correlacionTemporal: Record<
    'temperatura' | 'presion' | 'viento' | 'luz',
    number | null
  >;
  tvAire: number;
  tvSuelo: number;
  mediaSimple: number;
  total: number;
  penalizado: boolean;
  peorCritica: { variable: VariableAnalogo; valor: number };
  seriesA: SeriesSitio;
  seriesB: SeriesSitio;
}

export interface RecomendacionAnalogo {
  preset: AnalogoTerrestrePreset;
  sitio: SitioAmbiental;
  resultado: ResultadoComparacion;
  puntuacionPrueba: number;
  factoresFuertes: Array<{
    variable: VariableAnalogo;
    etiqueta: string;
    valor: number;
  }>;
  brechasACompensar: Array<{
    variable: VariableAnalogo;
    etiqueta: string;
    valor: number;
  }>;
  resumenIngenieria: string;
}

export const ORDEN_VARIABLES: VariableAnalogo[] = [
  'temperatura',
  'presion',
  'viento',
  'luz',
  'gravedad',
  'radiacion',
  'aire',
  'suelo',
  'terreno',
];

export const METADATOS_VARIABLES: Record<
  VariableAnalogo,
  { etiqueta: string; unidad: string; transformacion: string }
> = {
  temperatura: {
    etiqueta: 'Temperatura',
    unidad: 'K',
    transformacion: 'Lineal (K) · tol. 60 K',
  },
  presion: {
    etiqueta: 'Presión',
    unidad: 'Pa',
    transformacion: 'log₁₀(Pa) · tol. 3.0 déc.',
  },
  viento: {
    etiqueta: 'Viento',
    unidad: 'm/s',
    transformacion: 'Lineal (m/s) · tol. 15 m/s',
  },
  luz: {
    etiqueta: 'Irradiancia',
    unidad: 'W/m²',
    transformacion: 'Lineal (W/m²) · tol. 700 W/m²',
  },
  gravedad: {
    etiqueta: 'Gravedad',
    unidad: 'm/s²',
    transformacion: 'Lineal (m/s²) · tol. 9.81 m/s²',
  },
  radiacion: {
    etiqueta: 'Radiación',
    unidad: 'µSv/h',
    transformacion: 'log₁₀(µSv/h) · tol. 2.0 déc.',
  },
  aire: {
    etiqueta: 'Aire / Exosfera',
    unidad: 'frac.',
    transformacion: '1 − TV(mol) · composición',
  },
  suelo: {
    etiqueta: 'Suelo / Regolito',
    unidad: 'frac.',
    transformacion: '1 − TV(óxidos) · mineralogía',
  },
  terreno: {
    etiqueta: 'Terreno',
    unidad: '°, m',
    transformacion: 'Pendiente / 30° + Rugosidad / 0.2 m',
  },
};

export const PESOS_DEFAULT: Record<VariableAnalogo, number> = {
  temperatura: 2,
  presion: 3,
  viento: 1,
  luz: 1.5,
  gravedad: 2,
  radiacion: 1.5,
  aire: 3,
  suelo: 2,
  terreno: 1,
};

export const CRITICAS_DEFAULT: VariableAnalogo[] = [
  'presion',
  'gravedad',
  'aire',
];

export const ESCALAS_DEFAULT: Record<VariableContinua, number> = {
  temperatura: 60.0,
  presion: 3.0,
  viento: 15.0,
  luz: 700.0,
  gravedad: 9.81,
  radiacion: 2.0,
};

const AIRE_TERRESTRE = {
  N2: 0.78,
  O2: 0.21,
  Ar: 0.0093,
  CO2: 0.0004,
  otros: 0.0003,
};

const AIRE_MARCIANO = {
  N2: 0.027,
  O2: 0.0013,
  Ar: 0.016,
  CO2: 0.953,
  otros: 0.0027,
};

const AIRE_LUNAR = {
  N2: 0,
  O2: 0,
  Ar: 0.35,
  CO2: 0,
  otros: 0.65,
};

export const SITIOS_INICIALES: SitioAmbiental[] = [
  {
    id: 'tierra-atacama',
    nombre: 'Tierra (Atacama, 2400 m)',
    lat: -24.1,
    lon: -69.9,
    fuenteDatos: 'Calibrado · NASA Earthdata',
    periodo: 24.0,
    T: [290, 12],
    P: [75000, 0.005],
    viento: [4, 0.5],
    luz: [1100, null],
    g: 9.81,
    radiacion: 0.05,
    aire: { ...AIRE_TERRESTRE },
    suelo: {
      SiO2: 0.6,
      Al2O3: 0.15,
      Fe2O3: 0.06,
      CaO: 0.05,
      MgO: 0.03,
      otros: 0.11,
    },
    pendiente: 5,
    rugosidad: 0.03,
    usarSerieMedida: false,
    serieMedida: null,
  },
  {
    id: 'marte-gale',
    nombre: 'Marte (Cráter Gale)',
    lat: -4.59,
    lon: 137.44,
    fuenteDatos: 'Curiosity REMS / RAD',
    periodo: 24.66,
    T: [218, 45],
    P: [750, 0.05],
    viento: [4, 0.6],
    luz: [500, null],
    g: 3.71,
    radiacion: 28,
    aire: { ...AIRE_MARCIANO },
    suelo: {
      SiO2: 0.43,
      Al2O3: 0.09,
      Fe2O3: 0.19,
      CaO: 0.07,
      MgO: 0.09,
      otros: 0.13,
    },
    pendiente: 5,
    rugosidad: 0.05,
  },
  {
    id: 'luna-mare',
    nombre: 'Luna (ecuador, mare)',
    lat: 0.67,
    lon: 23.47,
    fuenteDatos: 'Apollo 11 / LRO Diviner',
    periodo: 708.7,
    T: [245, 145],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1361, null],
    g: 1.62,
    radiacion: 60,
    aire: { ...AIRE_LUNAR },
    suelo: {
      SiO2: 0.45,
      Al2O3: 0.14,
      Fe2O3: 0.17,
      CaO: 0.12,
      MgO: 0.08,
      otros: 0.04,
    },
    pendiente: 5,
    rugosidad: 0.04,
  },
];

export const ANALOGOS_TERRESTRES_NASA: AnalogoTerrestrePreset[] = [
  {
    id: 'atacama-yungay',
    nombre: 'Desierto de Atacama · Yungay',
    etiquetaSitio: 'Tierra (Atacama Yungay · Earthdata)',
    lat: -24.1,
    lon: -69.9,
    T: [289, 13],
    P: [90000, 0.005],
    viento: [4.2, 0.5],
    luz: [1120, null],
    suelo: { SiO2: 0.61, Al2O3: 0.14, Fe2O3: 0.07, CaO: 0.05, MgO: 0.03, otros: 0.1 },
    pendiente: 5,
    rugosidad: 0.03,
    radiacion: 0.06,
    queryCmr: 'Atacama MERRA-2',
    descripcion: 'Análogo hiperárido con nitratos y percloratos para rovers marcianos.',
  },
  {
    id: 'valles-secos-mcmurdo',
    nombre: 'Valles Secos de McMurdo',
    etiquetaSitio: 'Tierra (McMurdo Dry Valleys · Earthdata)',
    lat: -77.47,
    lon: 162.52,
    T: [253, 9],
    P: [97000, 0.01],
    viento: [7.5, 0.65],
    luz: [520, null],
    suelo: { SiO2: 0.56, Al2O3: 0.14, Fe2O3: 0.09, CaO: 0.06, MgO: 0.06, otros: 0.09 },
    pendiente: 9,
    rugosidad: 0.06,
    radiacion: 0.09,
    queryCmr: 'Antarctica Dry Valleys',
    descripcion: 'Permafrost frío y viento catabático ideal para ensayos térmicos y sellos.',
  },
  {
    id: 'rio-tinto',
    nombre: 'Río Tinto (Huelva)',
    etiquetaSitio: 'Tierra (Río Tinto · Earthdata)',
    lat: 37.7,
    lon: -6.55,
    T: [291, 10],
    P: [98500, 0.005],
    viento: [3.6, 0.45],
    luz: [940, null],
    suelo: { SiO2: 0.44, Al2O3: 0.1, Fe2O3: 0.25, CaO: 0.03, MgO: 0.04, otros: 0.14 },
    pendiente: 8,
    rugosidad: 0.05,
    radiacion: 0.05,
    queryCmr: 'Spain iron sulfate MODIS',
    descripcion: 'Suelo rico en óxidos de hierro y sulfatos afín a Meridiani Planum.',
  },
  {
    id: 'mojave-baker',
    nombre: 'Desierto de Mojave',
    etiquetaSitio: 'Tierra (Desierto de Mojave · Earthdata)',
    lat: 35.14,
    lon: -116.1,
    T: [294, 14],
    P: [96500, 0.006],
    viento: [5.1, 0.55],
    luz: [1040, null],
    suelo: { SiO2: 0.58, Al2O3: 0.15, Fe2O3: 0.08, CaO: 0.06, MgO: 0.04, otros: 0.09 },
    pendiente: 6,
    rugosidad: 0.04,
    radiacion: 0.05,
    queryCmr: 'Mojave JPL',
    descripcion: 'Campo histórico JPL para pruebas de movilidad 6x6 sobre arena y basalto.',
  },
  {
    id: 'askja-islandia',
    nombre: 'Caldera de Askja (Islandia)',
    etiquetaSitio: 'Tierra (Askja Islandia · Earthdata)',
    lat: 65.03,
    lon: -16.75,
    T: [272, 7],
    P: [91500, 0.015],
    viento: [8.8, 0.7],
    luz: [420, null],
    suelo: { SiO2: 0.49, Al2O3: 0.14, Fe2O3: 0.14, CaO: 0.1, MgO: 0.07, otros: 0.06 },
    pendiente: 11,
    rugosidad: 0.08,
    radiacion: 0.06,
    queryCmr: 'Iceland basalt volcanic',
    descripcion: 'Tefra y basalto vítreo muy abrasivo usado en entrenamiento Apollo y EVA lunar.',
  },
  {
    id: 'devon-haughton',
    nombre: 'Cráter Haughton (Isla Devon)',
    etiquetaSitio: 'Tierra (Cráter Haughton · Earthdata)',
    lat: 75.37,
    lon: -89.68,
    T: [258, 8],
    P: [98000, 0.012],
    viento: [6.4, 0.6],
    luz: [380, null],
    suelo: { SiO2: 0.46, Al2O3: 0.11, Fe2O3: 0.08, CaO: 0.16, MgO: 0.08, otros: 0.11 },
    pendiente: 7,
    rugosidad: 0.07,
    radiacion: 0.08,
    queryCmr: 'Devon Island Arctic',
    descripcion: 'Estructura de impacto ártica con brechas y ciclo polar para trajes y hábitats.',
  },
  {
    id: 'utah-mdrs',
    nombre: 'Estación MDRS (Utah)',
    etiquetaSitio: 'Tierra (Utah MDRS · Earthdata)',
    lat: 38.41,
    lon: -110.79,
    T: [285, 13],
    P: [86500, 0.008],
    viento: [4.8, 0.5],
    luz: [980, null],
    suelo: { SiO2: 0.55, Al2O3: 0.12, Fe2O3: 0.13, CaO: 0.07, MgO: 0.04, otros: 0.09 },
    pendiente: 6,
    rugosidad: 0.05,
    radiacion: 0.06,
    queryCmr: 'San Rafael Swell Utah',
    descripcion: 'Arcillas y areniscas férricas empleadas en campañas simuladas de base marciana.',
  },
  {
    id: 'svalbard-ny-alesund',
    nombre: 'Svalbard · Ny-Ålesund',
    etiquetaSitio: 'Tierra (Svalbard · Earthdata)',
    lat: 78.92,
    lon: 11.93,
    T: [268, 5],
    P: [100200, 0.014],
    viento: [6.9, 0.65],
    luz: [330, null],
    suelo: { SiO2: 0.5, Al2O3: 0.13, Fe2O3: 0.11, CaO: 0.09, MgO: 0.06, otros: 0.11 },
    pendiente: 10,
    rugosidad: 0.06,
    radiacion: 0.08,
    queryCmr: 'Svalbard AMASE',
    descripcion: 'Suelo periglacial de alta latitud utilizado en campañas AMASE para Mars 2020.',
  },
  {
    id: 'mauna-loa',
    nombre: 'Mauna Loa (Hawái · 3400 m)',
    etiquetaSitio: 'Tierra (Mauna Loa · Earthdata)',
    lat: 19.54,
    lon: -155.58,
    T: [281, 9],
    P: [68000, 0.006],
    viento: [5.4, 0.5],
    luz: [1180, null],
    suelo: { SiO2: 0.48, Al2O3: 0.14, Fe2O3: 0.13, CaO: 0.11, MgO: 0.08, otros: 0.06 },
    pendiente: 9,
    rugosidad: 0.09,
    radiacion: 0.08,
    queryCmr: 'Mauna Loa HI-SEAS',
    descripcion: 'Escoria basáltica afilada en altura, estándar para desgaste de ruedas y botas EVA.',
  },
  {
    id: 'danakil-etiopia',
    nombre: 'Depresión de Danakil',
    etiquetaSitio: 'Tierra (Danakil · Earthdata)',
    lat: 14.24,
    lon: 40.3,
    T: [307, 11],
    P: [101800, 0.004],
    viento: [4.6, 0.45],
    luz: [1090, null],
    suelo: { SiO2: 0.41, Al2O3: 0.09, Fe2O3: 0.15, CaO: 0.1, MgO: 0.05, otros: 0.2 },
    pendiente: 4,
    rugosidad: 0.06,
    radiacion: 0.05,
    queryCmr: 'Danakil Afar',
    descripcion: 'Costras salinas, salmueras y azufre para validar sensores astrobiológicos.',
  },
  {
    id: 'qaidam-china',
    nombre: 'Cuenca de Qaidam',
    etiquetaSitio: 'Tierra (Qaidam · Earthdata)',
    lat: 37.5,
    lon: 94.0,
    T: [279, 14],
    P: [71500, 0.007],
    viento: [5.9, 0.6],
    luz: [1020, null],
    suelo: { SiO2: 0.52, Al2O3: 0.13, Fe2O3: 0.1, CaO: 0.09, MgO: 0.05, otros: 0.11 },
    pendiente: 5,
    rugosidad: 0.04,
    radiacion: 0.07,
    queryCmr: 'Qaidam Basin MERRA-2',
    descripcion: 'Playas evaporíticas, yardangs y polvo fino en altura análogos a cuencas marcianas.',
  },
  {
    id: 'white-sands',
    nombre: 'White Sands (Nuevo México)',
    etiquetaSitio: 'Tierra (White Sands · Earthdata)',
    lat: 32.78,
    lon: -106.33,
    T: [290, 14],
    P: [88000, 0.006],
    viento: [4.9, 0.55],
    luz: [1060, null],
    suelo: { SiO2: 0.34, Al2O3: 0.07, Fe2O3: 0.04, CaO: 0.28, MgO: 0.04, otros: 0.23 },
    pendiente: 4,
    rugosidad: 0.03,
    radiacion: 0.06,
    queryCmr: 'White Sands gypsum',
    descripcion: 'Dunas de yeso de alto albedo útiles para fotometría y rodadura en polvo suelto.',
  },
  {
    id: 'salar-uyuni',
    nombre: 'Salar de Uyuni (3656 m)',
    etiquetaSitio: 'Tierra (Salar de Uyuni · Earthdata)',
    lat: -20.13,
    lon: -67.49,
    T: [280, 15],
    P: [65500, 0.005],
    viento: [5.3, 0.55],
    luz: [1220, null],
    suelo: { SiO2: 0.36, Al2O3: 0.08, Fe2O3: 0.05, CaO: 0.14, MgO: 0.06, otros: 0.31 },
    pendiente: 1,
    rugosidad: 0.02,
    radiacion: 0.09,
    queryCmr: 'Uyuni altimetry MODIS',
    descripcion: 'Planicie evaporítica de alta radiación UV y baja presión atmosférica.',
  },
  {
    id: 'pilbara-australia',
    nombre: 'Cratón de Pilbara',
    etiquetaSitio: 'Tierra (Pilbara · Earthdata)',
    lat: -21.2,
    lon: 119.3,
    T: [299, 12],
    P: [98800, 0.005],
    viento: [4.5, 0.45],
    luz: [1080, null],
    suelo: { SiO2: 0.47, Al2O3: 0.1, Fe2O3: 0.24, CaO: 0.05, MgO: 0.06, otros: 0.08 },
    pendiente: 6,
    rugosidad: 0.05,
    radiacion: 0.05,
    queryCmr: 'Pilbara stromatolites',
    descripcion: 'Formaciones bandeado-férricas arcaicas paralelas a biofirmas potenciales en Jezero.',
  },
  {
    id: 'lanzarote-timanfaya',
    nombre: 'Timanfaya (Lanzarote)',
    etiquetaSitio: 'Tierra (Lanzarote · Earthdata)',
    lat: 29.0,
    lon: -13.75,
    T: [293, 6],
    P: [99500, 0.004],
    viento: [6.2, 0.5],
    luz: [960, null],
    suelo: { SiO2: 0.46, Al2O3: 0.14, Fe2O3: 0.15, CaO: 0.1, MgO: 0.09, otros: 0.06 },
    pendiente: 10,
    rugosidad: 0.08,
    radiacion: 0.05,
    queryCmr: 'Lanzarote ESA PANGAEA',
    descripcion: 'Campos volcánicos basálticos de entrenamiento geológico ESA PANGAEA.',
  },
];

export const ANALOGOS_LUNA_MARTE_PDS: AnalogoPlanetarioPds[] = [
  // LUNA (13)
  {
    id: 'luna-mare-ecuador',
    cuerpo: 'luna',
    nombre: 'Mare Tranquillitatis (Apollo 11)',
    etiquetaSitio: 'Luna (Mare Tranquillitatis · PDS LRO)',
    lat: 0.67,
    lon: 23.47,
    misionFuente: 'Apollo 11 / LRO Diviner',
    periodo: 708.7,
    T: [245, 145],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1361, null],
    g: 1.62,
    radiacion: 60,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.42, Al2O3: 0.13, Fe2O3: 0.18, CaO: 0.12, MgO: 0.08, otros: 0.07 },
    pendiente: 4,
    rugosidad: 0.04,
    queryPds: 'LRO',
  },
  {
    id: 'luna-tycho',
    cuerpo: 'luna',
    nombre: 'Cráter Tycho (Tierras Altas)',
    etiquetaSitio: 'Luna (Cráter Tycho · PDS LRO)',
    lat: -43.31,
    lon: -11.36,
    misionFuente: 'LRO Diviner / LOLA',
    periodo: 708.7,
    T: [222, 130],
    P: [2e-10, 0],
    viento: [0, 0],
    luz: [1010, null],
    g: 1.62,
    radiacion: 64,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.45, Al2O3: 0.26, Fe2O3: 0.06, CaO: 0.15, MgO: 0.06, otros: 0.02 },
    pendiente: 16,
    rugosidad: 0.11,
    queryPds: 'LRO Tycho',
  },
  {
    id: 'luna-aristarchus',
    cuerpo: 'luna',
    nombre: 'Meseta de Aristarchus',
    etiquetaSitio: 'Luna (Meseta Aristarchus · PDS LRO)',
    lat: 23.73,
    lon: -47.49,
    misionFuente: 'LRO LROC / Moon Mineralogy Mapper',
    periodo: 708.7,
    T: [238, 138],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1245, null],
    g: 1.62,
    radiacion: 62,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.47, Al2O3: 0.15, Fe2O3: 0.14, CaO: 0.11, MgO: 0.07, otros: 0.06 },
    pendiente: 9,
    rugosidad: 0.07,
    queryPds: 'LRO Aristarchus',
  },
  {
    id: 'luna-copernicus',
    cuerpo: 'luna',
    nombre: 'Cráter Copernicus',
    etiquetaSitio: 'Luna (Cráter Copernicus · PDS LRO)',
    lat: 9.62,
    lon: -20.08,
    misionFuente: 'LRO LOLA / Diviner',
    periodo: 708.7,
    T: [242, 142],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1340, null],
    g: 1.62,
    radiacion: 60,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.46, Al2O3: 0.19, Fe2O3: 0.1, CaO: 0.12, MgO: 0.09, otros: 0.04 },
    pendiente: 12,
    rugosidad: 0.08,
    queryPds: 'LRO Copernicus',
  },
  {
    id: 'luna-shackleton',
    cuerpo: 'luna',
    nombre: 'Polo Sur · Borde de Shackleton',
    etiquetaSitio: 'Luna (Polo Sur Shackleton · PDS LRO)',
    lat: -89.67,
    lon: 129.78,
    misionFuente: 'LRO LOLA / LAMP / Diviner',
    periodo: 708.7,
    T: [115, 58],
    P: [1e-10, 0],
    viento: [0, 0],
    luz: [220, null],
    g: 1.63,
    radiacion: 72,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.45, Al2O3: 0.25, Fe2O3: 0.06, CaO: 0.15, MgO: 0.05, otros: 0.04 },
    pendiente: 18,
    rugosidad: 0.09,
    queryPds: 'LRO Shackleton Artemis',
  },
  {
    id: 'luna-oceanus-procellarum',
    cuerpo: 'luna',
    nombre: 'Oceanus Procellarum',
    etiquetaSitio: 'Luna (Oceanus Procellarum · PDS LRO)',
    lat: 18.4,
    lon: -57.4,
    misionFuente: 'LRO / Chang’e-5 / Apollo 12',
    periodo: 708.7,
    T: [241, 140],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1290, null],
    g: 1.62,
    radiacion: 61,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.42, Al2O3: 0.12, Fe2O3: 0.2, CaO: 0.11, MgO: 0.08, otros: 0.07 },
    pendiente: 3,
    rugosidad: 0.03,
    queryPds: 'LRO Procellarum',
  },
  {
    id: 'luna-mare-imbrium',
    cuerpo: 'luna',
    nombre: 'Mare Imbrium',
    etiquetaSitio: 'Luna (Mare Imbrium · PDS LRO)',
    lat: 32.8,
    lon: -15.6,
    misionFuente: 'LRO / Lunokhod 1',
    periodo: 708.7,
    T: [232, 134],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1145, null],
    g: 1.62,
    radiacion: 62,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.44, Al2O3: 0.14, Fe2O3: 0.17, CaO: 0.11, MgO: 0.09, otros: 0.05 },
    pendiente: 4,
    rugosidad: 0.04,
    queryPds: 'LRO Imbrium',
  },
  {
    id: 'luna-taurus-littrow',
    cuerpo: 'luna',
    nombre: 'Valle Taurus–Littrow (Apollo 17)',
    etiquetaSitio: 'Luna (Taurus–Littrow · PDS LRO)',
    lat: 20.19,
    lon: 30.77,
    misionFuente: 'Apollo 17 / LRO LROC',
    periodo: 708.7,
    T: [239, 139],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1275, null],
    g: 1.62,
    radiacion: 61,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.41, Al2O3: 0.14, Fe2O3: 0.17, CaO: 0.11, MgO: 0.09, otros: 0.08 },
    pendiente: 8,
    rugosidad: 0.06,
    queryPds: 'Apollo 17 LROC',
  },
  {
    id: 'luna-von-karman',
    cuerpo: 'luna',
    nombre: 'Cráter Von Kármán (Cara Oculta)',
    etiquetaSitio: 'Luna (Cráter Von Kármán · PDS LRO)',
    lat: -45.46,
    lon: 175.93,
    misionFuente: 'LRO / SPA Basin',
    periodo: 708.7,
    T: [220, 128],
    P: [2e-10, 0],
    viento: [0, 0],
    luz: [960, null],
    g: 1.62,
    radiacion: 65,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.45, Al2O3: 0.17, Fe2O3: 0.14, CaO: 0.12, MgO: 0.09, otros: 0.03 },
    pendiente: 5,
    rugosidad: 0.05,
    queryPds: 'LRO South Pole Aitken',
  },
  {
    id: 'luna-marius-hills',
    cuerpo: 'luna',
    nombre: 'Colinas Marius (Tubos de Lava)',
    etiquetaSitio: 'Luna (Colinas Marius · PDS LRO)',
    lat: 14.1,
    lon: -56.1,
    misionFuente: 'LRO LROC / GRAIL',
    periodo: 708.7,
    T: [243, 141],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1320, null],
    g: 1.62,
    radiacion: 60,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.43, Al2O3: 0.13, Fe2O3: 0.19, CaO: 0.11, MgO: 0.08, otros: 0.06 },
    pendiente: 10,
    rugosidad: 0.07,
    queryPds: 'LRO Marius GRAIL',
  },
  {
    id: 'luna-plato',
    cuerpo: 'luna',
    nombre: 'Cráter Plato',
    etiquetaSitio: 'Luna (Cráter Plato · PDS LRO)',
    lat: 51.62,
    lon: -9.38,
    misionFuente: 'LRO LOLA / Diviner',
    periodo: 708.7,
    T: [209, 118],
    P: [2e-10, 0],
    viento: [0, 0],
    luz: [845, null],
    g: 1.62,
    radiacion: 65,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.44, Al2O3: 0.15, Fe2O3: 0.16, CaO: 0.12, MgO: 0.08, otros: 0.05 },
    pendiente: 3,
    rugosidad: 0.03,
    queryPds: 'LRO Plato',
  },
  {
    id: 'luna-mons-hadley',
    cuerpo: 'luna',
    nombre: 'Rima Hadley / Apenninus (Apollo 15)',
    etiquetaSitio: 'Luna (Rima Hadley · PDS LRO)',
    lat: 26.13,
    lon: 3.63,
    misionFuente: 'Apollo 15 / LRO LOLA',
    periodo: 708.7,
    T: [236, 136],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1220, null],
    g: 1.62,
    radiacion: 61,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.46, Al2O3: 0.17, Fe2O3: 0.14, CaO: 0.11, MgO: 0.09, otros: 0.03 },
    pendiente: 13,
    rugosidad: 0.08,
    queryPds: 'Apollo 15 LRO',
  },
  {
    id: 'luna-alphonsus',
    cuerpo: 'luna',
    nombre: 'Cráter Alphonsus',
    etiquetaSitio: 'Luna (Cráter Alphonsus · PDS LRO)',
    lat: -13.39,
    lon: -2.85,
    misionFuente: 'Ranger 9 / LRO LROC',
    periodo: 708.7,
    T: [243, 142],
    P: [3e-10, 0],
    viento: [0, 0],
    luz: [1325, null],
    g: 1.62,
    radiacion: 60,
    aire: { ...AIRE_LUNAR },
    suelo: { SiO2: 0.46, Al2O3: 0.21, Fe2O3: 0.11, CaO: 0.13, MgO: 0.06, otros: 0.03 },
    pendiente: 7,
    rugosidad: 0.05,
    queryPds: 'LRO Alphonsus',
  },

  // MARTE (13)
  {
    id: 'marte-gale-msl',
    cuerpo: 'marte',
    nombre: 'Cráter Gale (Curiosity)',
    etiquetaSitio: 'Marte (Cráter Gale · PDS REMS)',
    lat: -4.59,
    lon: 137.44,
    misionFuente: 'MSL Curiosity REMS / RAD',
    periodo: 24.66,
    T: [218, 45],
    P: [750, 0.05],
    viento: [4.2, 0.6],
    luz: [500, null],
    g: 3.71,
    radiacion: 28,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.43, Al2O3: 0.09, Fe2O3: 0.19, CaO: 0.07, MgO: 0.09, otros: 0.13 },
    pendiente: 5,
    rugosidad: 0.05,
    queryPds: 'MSL REMS',
  },
  {
    id: 'marte-jezero-2020',
    cuerpo: 'marte',
    nombre: 'Cráter Jezero (Perseverance)',
    etiquetaSitio: 'Marte (Cráter Jezero · PDS MEDA)',
    lat: 18.38,
    lon: 77.58,
    misionFuente: 'Mars 2020 MEDA / PIXL',
    periodo: 24.66,
    T: [215, 43],
    P: [730, 0.055],
    viento: [5.2, 0.65],
    luz: [520, null],
    g: 3.71,
    radiacion: 29,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.44, Al2O3: 0.09, Fe2O3: 0.18, CaO: 0.08, MgO: 0.1, otros: 0.11 },
    pendiente: 6,
    rugosidad: 0.06,
    queryPds: 'Mars 2020 MEDA',
  },
  {
    id: 'marte-elysium-insight',
    cuerpo: 'marte',
    nombre: 'Elysium Planitia (InSight)',
    etiquetaSitio: 'Marte (Elysium Planitia · PDS InSight)',
    lat: 4.5,
    lon: 135.62,
    misionFuente: 'InSight TWINS / APSS',
    periodo: 24.66,
    T: [214, 42],
    P: [720, 0.045],
    viento: [5.6, 0.7],
    luz: [510, null],
    g: 3.71,
    radiacion: 28,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.45, Al2O3: 0.1, Fe2O3: 0.18, CaO: 0.07, MgO: 0.08, otros: 0.12 },
    pendiente: 2,
    rugosidad: 0.03,
    queryPds: 'InSight TWINS',
  },
  {
    id: 'marte-arcadia-planitia',
    cuerpo: 'marte',
    nombre: 'Arcadia Planitia (Hielo somero)',
    etiquetaSitio: 'Marte (Arcadia Planitia · PDS MRO)',
    lat: 39.2,
    lon: -171.0,
    misionFuente: 'MRO SHARAD / HiRISE',
    periodo: 24.66,
    T: [198, 36],
    P: [860, 0.05],
    viento: [6.4, 0.65],
    luz: [390, null],
    g: 3.72,
    radiacion: 31,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.46, Al2O3: 0.1, Fe2O3: 0.16, CaO: 0.06, MgO: 0.08, otros: 0.14 },
    pendiente: 2,
    rugosidad: 0.03,
    queryPds: 'MRO SHARAD Arcadia',
  },
  {
    id: 'marte-hellas-planitia',
    cuerpo: 'marte',
    nombre: 'Cuenca Hellas Planitia',
    etiquetaSitio: 'Marte (Hellas Planitia · PDS MOLA)',
    lat: -42.4,
    lon: 70.5,
    misionFuente: 'MGS MOLA / TES',
    periodo: 24.66,
    T: [204, 40],
    P: [1150, 0.06],
    viento: [7.8, 0.75],
    luz: [410, null],
    g: 3.72,
    radiacion: 24,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.44, Al2O3: 0.09, Fe2O3: 0.19, CaO: 0.07, MgO: 0.09, otros: 0.12 },
    pendiente: 4,
    rugosidad: 0.04,
    queryPds: 'MGS MOLA Hellas',
  },
  {
    id: 'marte-valles-marineris',
    cuerpo: 'marte',
    nombre: 'Valles Marineris (Coprates)',
    etiquetaSitio: 'Marte (Valles Marineris · PDS CRISM)',
    lat: -13.9,
    lon: -59.2,
    misionFuente: 'MRO CRISM / HiRISE',
    periodo: 24.66,
    T: [219, 44],
    P: [920, 0.05],
    viento: [8.4, 0.7],
    luz: [485, null],
    g: 3.71,
    radiacion: 26,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.43, Al2O3: 0.09, Fe2O3: 0.2, CaO: 0.07, MgO: 0.09, otros: 0.12 },
    pendiente: 17,
    rugosidad: 0.09,
    queryPds: 'MRO CRISM Marineris',
  },
  {
    id: 'marte-olympus-mons',
    cuerpo: 'marte',
    nombre: 'Olympus Mons (Cumbre 21 km)',
    etiquetaSitio: 'Marte (Olympus Mons · PDS MOLA)',
    lat: 18.65,
    lon: -133.8,
    misionFuente: 'MGS MOLA / Mars Express HRSC',
    periodo: 24.66,
    T: [188, 38],
    P: [72, 0.04],
    viento: [9.5, 0.65],
    luz: [540, null],
    g: 3.69,
    radiacion: 39,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.47, Al2O3: 0.11, Fe2O3: 0.15, CaO: 0.09, MgO: 0.09, otros: 0.09 },
    pendiente: 12,
    rugosidad: 0.08,
    queryPds: 'MGS MOLA Olympus',
  },
  {
    id: 'marte-utopia-planitia',
    cuerpo: 'marte',
    nombre: 'Utopia Planitia (Viking 2)',
    etiquetaSitio: 'Marte (Utopia Planitia · PDS Viking)',
    lat: 47.64,
    lon: 134.29,
    misionFuente: 'Viking 2 / MRO SHARAD',
    periodo: 24.66,
    T: [194, 34],
    P: [890, 0.05],
    viento: [6.8, 0.6],
    luz: [340, null],
    g: 3.72,
    radiacion: 31,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.44, Al2O3: 0.08, Fe2O3: 0.18, CaO: 0.06, MgO: 0.07, otros: 0.17 },
    pendiente: 3,
    rugosidad: 0.05,
    queryPds: 'Viking Lander 2',
  },
  {
    id: 'marte-meridiani-opportunity',
    cuerpo: 'marte',
    nombre: 'Meridiani Planum (Opportunity)',
    etiquetaSitio: 'Marte (Meridiani Planum · PDS MER)',
    lat: -1.95,
    lon: -5.53,
    misionFuente: 'MER-B Opportunity Mini-TES',
    periodo: 24.66,
    T: [220, 46],
    P: [710, 0.05],
    viento: [4.6, 0.55],
    luz: [515, null],
    g: 3.71,
    radiacion: 28,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.39, Al2O3: 0.08, Fe2O3: 0.23, CaO: 0.06, MgO: 0.08, otros: 0.16 },
    pendiente: 3,
    rugosidad: 0.03,
    queryPds: 'MER Opportunity',
  },
  {
    id: 'marte-gusev-spirit',
    cuerpo: 'marte',
    nombre: 'Cráter Gusev (Spirit)',
    etiquetaSitio: 'Marte (Cráter Gusev · PDS MER)',
    lat: -14.57,
    lon: 175.47,
    misionFuente: 'MER-A Spirit APXS / Mini-TES',
    periodo: 24.66,
    T: [217, 45],
    P: [740, 0.05],
    viento: [5.4, 0.7],
    luz: [495, null],
    g: 3.71,
    radiacion: 28,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.45, Al2O3: 0.1, Fe2O3: 0.17, CaO: 0.07, MgO: 0.09, otros: 0.12 },
    pendiente: 7,
    rugosidad: 0.06,
    queryPds: 'MER Spirit Gusev',
  },
  {
    id: 'marte-chryse-viking1',
    cuerpo: 'marte',
    nombre: 'Chryse Planitia (Viking 1)',
    etiquetaSitio: 'Marte (Chryse Planitia · PDS Viking)',
    lat: 22.27,
    lon: -47.95,
    misionFuente: 'Viking 1 Lander / Orbiter',
    periodo: 24.66,
    T: [213, 41],
    P: [780, 0.05],
    viento: [5.0, 0.6],
    luz: [490, null],
    g: 3.71,
    radiacion: 28,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.44, Al2O3: 0.07, Fe2O3: 0.18, CaO: 0.06, MgO: 0.06, otros: 0.19 },
    pendiente: 4,
    rugosidad: 0.05,
    queryPds: 'Viking Lander 1',
  },
  {
    id: 'marte-vastitas-phoenix',
    cuerpo: 'marte',
    nombre: 'Vastitas Borealis (Phoenix)',
    etiquetaSitio: 'Marte (Vastitas Borealis · PDS Phoenix)',
    lat: 68.22,
    lon: -125.7,
    misionFuente: 'Phoenix Mars Lander MET',
    periodo: 24.66,
    T: [186, 26],
    P: [840, 0.04],
    viento: [6.2, 0.55],
    luz: [275, null],
    g: 3.73,
    radiacion: 33,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.42, Al2O3: 0.08, Fe2O3: 0.17, CaO: 0.07, MgO: 0.08, otros: 0.18 },
    pendiente: 2,
    rugosidad: 0.03,
    queryPds: 'Phoenix Mars',
  },
  {
    id: 'marte-oxya-planum',
    cuerpo: 'marte',
    nombre: 'Oxia Planum (Zona ExoMars)',
    etiquetaSitio: 'Marte (Oxia Planum · PDS MRO)',
    lat: 18.2,
    lon: -24.3,
    misionFuente: 'MRO CRISM / ESA ExoMars',
    periodo: 24.66,
    T: [216, 42],
    P: [810, 0.05],
    viento: [4.9, 0.55],
    luz: [505, null],
    g: 3.71,
    radiacion: 28,
    aire: { ...AIRE_MARCIANO },
    suelo: { SiO2: 0.46, Al2O3: 0.11, Fe2O3: 0.16, CaO: 0.06, MgO: 0.1, otros: 0.11 },
    pendiente: 4,
    rugosidad: 0.04,
    queryPds: 'CRISM Oxia',
  },
];

function interpolarSerieHoraria(
  serie: SerieMedidaNASA,
  tHora: number
): { T: number; P: number; viento: number; luz: number } {
  const hrs = serie.horas;
  if (!hrs.length) {
    return { T: 288, P: 90000, viento: 4, luz: 500 };
  }
  const span = Math.max(24, hrs[hrs.length - 1] - hrs[0] || 24);
  const hNorm = (((tHora - hrs[0]) % span) + span) % span + hrs[0];

  let idx = 0;
  while (idx < hrs.length - 2 && hrs[idx + 1] < hNorm) {
    idx++;
  }
  const h0 = hrs[idx];
  const h1 = hrs[Math.min(hrs.length - 1, idx + 1)];
  const frac = h1 > h0 ? Math.max(0, Math.min(1, (hNorm - h0) / (h1 - h0))) : 0;
  const lerp = (arr: number[]) => {
    const a = arr[idx] ?? arr[0] ?? 0;
    const b = arr[Math.min(arr.length - 1, idx + 1)] ?? a;
    return a + (b - a) * frac;
  };
  return {
    T: lerp(serie.temperaturaK),
    P: lerp(serie.presionPa),
    viento: lerp(serie.vientoMs),
    luz: lerp(serie.luzWm2),
  };
}

export function generarSerie(
  sitio: SitioAmbiental,
  horas: [number, number],
  n: number = 240
): SeriesSitio {
  const count = Math.max(2, Math.round(n));
  const [h0, h1] = horas;
  const t: number[] = new Array(count);
  const temperatura: number[] = new Array(count);
  const presion: number[] = new Array(count);
  const viento: number[] = new Array(count);
  const luz: number[] = new Array(count);
  const gravedad: number[] = new Array(count);
  const radiacion: number[] = new Array(count);

  const usarMedida = Boolean(sitio.usarSerieMedida && sitio.serieMedida?.horas?.length);
  const serieMedida = sitio.serieMedida;

  let mediaMedidaT = 0;
  if (usarMedida && serieMedida?.temperaturaK?.length) {
    mediaMedidaT =
      serieMedida.temperaturaK.reduce((a, b) => a + b, 0) /
      serieMedida.temperaturaK.length;
  }

  for (let i = 0; i < count; i++) {
    const ti = count > 1 ? h0 + ((h1 - h0) * i) / (count - 1) : h0;
    t[i] = ti;
    gravedad[i] = sitio.g;
    radiacion[i] = sitio.radiacion;

    if (usarMedida && serieMedida) {
      const m = interpolarSerieHoraria(serieMedida, ti);
      let tVal = m.T;
      if (sitio.desplazamientoTemp) {
        tVal =
          mediaMedidaT +
          sitio.desplazamientoTemp.deltaMedia +
          (m.T - mediaMedidaT) * sitio.desplazamientoTemp.factorAmplitud;
      }
      temperatura[i] = Math.max(20, tVal);
      presion[i] = Math.max(1e-12, m.P);
      viento[i] = Math.max(0, m.viento);
      luz[i] = Math.max(0, m.luz);
    } else {
      const fase = (2 * Math.PI * ti) / Math.max(0.1, sitio.periodo);
      const c = -Math.cos(fase);
      temperatura[i] = Math.max(15, sitio.T[0] + sitio.T[1] * c);
      presion[i] = Math.max(1e-12, sitio.P[0] * (1 + sitio.P[1] * c));
      viento[i] = Math.max(0, sitio.viento[0] * (1 + sitio.viento[1] * Math.sin(fase)));
      luz[i] = sitio.luz[0] * Math.max(0, c);
    }
  }

  return { t, temperatura, presion, viento, luz, gravedad, radiacion };
}

function transformarValor(v: number, variable: VariableContinua): number {
  if (variable === 'presion') return Math.log10(Math.max(v, 1e-12));
  if (variable === 'radiacion') return Math.log10(Math.max(v, 1e-4));
  return v;
}

export function simSerie(
  a: number[],
  b: number[],
  variable: VariableContinua,
  escalaOverride?: number
): number {
  const escala = escalaOverride ?? ESCALAS_DEFAULT[variable];
  const qa = a.map((x) => transformarValor(x, variable)).sort((x, y) => x - y);
  const qb = b.map((x) => transformarValor(x, variable)).sort((x, y) => x - y);
  const len = Math.min(qa.length, qb.length);
  if (len === 0) return 0;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += Math.abs(qa[i] - qb[i]);
  }
  const d = sum / len;
  return 100 * Math.max(0, 1 - d / Math.max(1e-9, escala));
}

export function simForma(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let num = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA < 1e-12 || varB < 1e-12) return null;
  return Math.max(-1, Math.min(1, num / Math.sqrt(varA * varB)));
}

export function simComp(
  p: Record<string, number>,
  q: Record<string, number>
): { similitud: number; tv: number } {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  const sp = Object.values(p).reduce((acc, v) => acc + Math.max(0, v), 0) || 1;
  const sq = Object.values(q).reduce((acc, v) => acc + Math.max(0, v), 0) || 1;
  let diffSum = 0;
  for (const k of keys) {
    diffSum += Math.abs(Math.max(0, p[k] ?? 0) / sp - Math.max(0, q[k] ?? 0) / sq);
  }
  const tv = 0.5 * diffSum;
  return { similitud: 100 * Math.max(0, 1 - tv), tv };
}

export function simTerreno(a: SitioAmbiental, b: SitioAmbiental): number {
  const ds = Math.abs(a.pendiente - b.pendiente) / 30;
  const dr = Math.abs(a.rugosidad - b.rugosidad) / 0.2;
  return 100 * Math.max(0, 1 - 0.5 * (ds + dr));
}

export function compararSitios(
  sitioA: SitioAmbiental,
  sitioB: SitioAmbiental,
  opts?: {
    horas?: [number, number];
    modo?: ModoComparacion;
    n?: number;
    pesos?: Record<VariableAnalogo, number>;
    criticas?: VariableAnalogo[];
    escalas?: Record<VariableContinua, number>;
  }
): ResultadoComparacion {
  const horas = opts?.horas ?? [0, 48];
  const modo = opts?.modo ?? 'reloj';
  const n = opts?.n ?? 240;
  const pesos = opts?.pesos ?? PESOS_DEFAULT;
  const criticas = opts?.criticas?.length ? opts.criticas : CRITICAS_DEFAULT;
  const escalas = opts?.escalas ?? ESCALAS_DEFAULT;

  const seriesA =
    modo === 'ciclo'
      ? generarSerie(sitioA, [0, sitioA.periodo], n)
      : generarSerie(sitioA, horas, n);
  const seriesB =
    modo === 'ciclo'
      ? generarSerie(sitioB, [0, sitioB.periodo], n)
      : generarSerie(sitioB, horas, n);

  const aireComp = simComp(sitioA.aire, sitioB.aire);
  const sueloComp = simComp(sitioA.suelo, sitioB.suelo);

  const porVariable: Record<VariableAnalogo, number> = {
    temperatura: simSerie(seriesA.temperatura, seriesB.temperatura, 'temperatura', escalas.temperatura),
    presion: simSerie(seriesA.presion, seriesB.presion, 'presion', escalas.presion),
    viento: simSerie(seriesA.viento, seriesB.viento, 'viento', escalas.viento),
    luz: simSerie(seriesA.luz, seriesB.luz, 'luz', escalas.luz),
    gravedad: simSerie(seriesA.gravedad, seriesB.gravedad, 'gravedad', escalas.gravedad),
    radiacion: simSerie(seriesA.radiacion, seriesB.radiacion, 'radiacion', escalas.radiacion),
    aire: aireComp.similitud,
    suelo: sueloComp.similitud,
    terreno: simTerreno(sitioA, sitioB),
  };

  const correlacionTemporal = {
    temperatura: simForma(seriesA.temperatura, seriesB.temperatura),
    presion: simForma(seriesA.presion, seriesB.presion),
    viento: simForma(seriesA.viento, seriesB.viento),
    luz: simForma(seriesA.luz, seriesB.luz),
  };

  let sumPesos = 0;
  let sumPond = 0;
  for (const v of ORDEN_VARIABLES) {
    const w = Math.max(0, pesos[v] ?? 0);
    sumPesos += w;
    sumPond += porVariable[v] * w;
  }
  const mediaSimple = sumPesos > 0 ? sumPond / sumPesos : 0;

  let peorVar = criticas[0];
  let peorVal = porVariable[peorVar];
  for (const c of criticas) {
    if (porVariable[c] < peorVal) {
      peorVal = porVariable[c];
      peorVar = c;
    }
  }

  const penalizadoValor = 0.5 * mediaSimple + 0.5 * peorVal;
  const total = Math.min(mediaSimple, penalizadoValor);

  return {
    sitioA: sitioA.nombre,
    sitioB: sitioB.nombre,
    ventana: horas,
    modo,
    n,
    porVariable,
    correlacionTemporal,
    tvAire: aireComp.tv,
    tvSuelo: sueloComp.tv,
    mediaSimple,
    total,
    penalizado: total < mediaSimple - 1e-6,
    peorCritica: { variable: peorVar, valor: peorVal },
    seriesA,
    seriesB,
  };
}

export function sitioDesdePresetPds(preset: AnalogoPlanetarioPds): SitioAmbiental {
  return {
    id: preset.id,
    nombre: preset.etiquetaSitio,
    lat: preset.lat,
    lon: preset.lon,
    fuenteDatos: preset.misionFuente,
    periodo: preset.periodo,
    T: [...preset.T],
    P: [...preset.P],
    viento: [...preset.viento],
    luz: [...preset.luz],
    g: preset.g,
    radiacion: preset.radiacion,
    aire: { ...preset.aire },
    suelo: { ...preset.suelo },
    pendiente: preset.pendiente,
    rugosidad: preset.rugosidad,
  };
}

function sitioDesdePresetTerrestre(preset: AnalogoTerrestrePreset): SitioAmbiental {
  return {
    id: preset.id,
    nombre: preset.etiquetaSitio,
    lat: preset.lat,
    lon: preset.lon,
    fuenteDatos: 'NASA Earthdata Calibrado',
    periodo: 24.0,
    T: [...preset.T],
    P: [...preset.P],
    viento: [...preset.viento],
    luz: [...preset.luz],
    g: 9.81,
    radiacion: preset.radiacion,
    aire: { ...AIRE_TERRESTRE },
    suelo: { ...preset.suelo },
    pendiente: preset.pendiente,
    rugosidad: preset.rugosidad,
  };
}

const PESOS_PERFIL: Record<PerfilRecomendacion, Record<VariableAnalogo, number>> = {
  rover: {
    temperatura: 2.0,
    presion: 1.0,
    viento: 1.5,
    luz: 1.5,
    gravedad: 1.2,
    radiacion: 1.0,
    aire: 0.5,
    suelo: 3.5,
    terreno: 3.5,
  },
  traje: {
    temperatura: 3.0,
    presion: 2.0,
    viento: 1.5,
    luz: 1.5,
    gravedad: 1.5,
    radiacion: 2.0,
    aire: 1.0,
    suelo: 2.5,
    terreno: 2.5,
  },
  base: {
    temperatura: 2.5,
    presion: 2.0,
    viento: 2.0,
    luz: 2.5,
    gravedad: 1.0,
    radiacion: 2.0,
    aire: 1.0,
    suelo: 2.5,
    terreno: 2.0,
  },
  equilibrado: { ...PESOS_DEFAULT },
};

export function recomendarAnalogosTerrestres(
  destino: SitioAmbiental,
  perfil: PerfilRecomendacion = 'equilibrado'
): RecomendacionAnalogo[] {
  const pesosPerfil = PESOS_PERFIL[perfil];
  const recs = ANALOGOS_TERRESTRES_NASA.map((preset) => {
    const sitio = sitioDesdePresetTerrestre(preset);
    const resultado = compararSitios(sitio, destino, {
      horas: [0, 48],
      modo: destino.periodo > 48 ? 'ciclo' : 'reloj',
      n: 120,
      pesos: pesosPerfil,
      criticas: ['suelo', 'temperatura', 'terreno'],
    });

    const ordenadas = ORDEN_VARIABLES.map((v) => ({
      variable: v,
      etiqueta: METADATOS_VARIABLES[v].etiqueta,
      valor: resultado.porVariable[v],
    }));

    const fuertes = [...ordenadas]
      .filter((o) => o.variable !== 'gravedad' && o.variable !== 'aire')
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3);

    const brechas = [...ordenadas]
      .sort((a, b) => a.valor - b.valor)
      .slice(0, 3);

    const wTotal = ORDEN_VARIABLES.reduce((acc, v) => acc + pesosPerfil[v], 0);
    const score =
      ORDEN_VARIABLES.reduce(
        (acc, v) => acc + resultado.porVariable[v] * pesosPerfil[v],
        0
      ) / Math.max(1, wTotal);

    const resumenIngenieria = `${preset.descripcion} Destaca en ${fuertes[0]?.etiqueta.toLowerCase()} (${fuertes[0]?.valor.toFixed(0)}%) y ${fuertes[1]?.etiqueta.toLowerCase()} (${fuertes[1]?.valor.toFixed(0)}%).`;

    return {
      preset,
      sitio,
      resultado,
      puntuacionPrueba: Number(score.toFixed(1)),
      factoresFuertes: fuertes,
      brechasACompensar: brechas,
      resumenIngenieria,
    };
  });

  return recs.sort((a, b) => b.puntuacionPrueba - a.puntuacionPrueba);
}

export function formatoCientifico(val: number, unidad?: string): string {
  if (!Number.isFinite(val)) return '—';
  let str: string;
  if (val === 0) str = '0.0';
  else if (Math.abs(val) < 0.01 || Math.abs(val) >= 1e5) {
    str = val.toExponential(2);
  } else if (Math.abs(val) < 10) {
    str = val.toFixed(2);
  } else {
    str = val.toFixed(1);
  }
  return unidad ? `${str} ${unidad}` : str;
}

const EN_VAR_COL: Record<VariableAnalogo, string> = {
  temperatura: 'temperature',
  presion: 'pressure',
  viento: 'wind',
  luz: 'light',
  gravedad: 'gravity',
  radiacion: 'radiation',
  aire: 'air',
  suelo: 'soil',
  terreno: 'terrain',
};

export function formatearInformeTexto(
  res: ResultadoComparacion,
  lang: 'es' | 'en' = 'es'
): string {
  const modeLabel =
    lang === 'en' ? (res.modo === 'reloj' ? 'clock' : 'cycle') : res.modo;
  const header =
    lang === 'en'
      ? `${res.sitioA}  vs  ${res.sitioB}   | window (${res.ventana[0]}, ${res.ventana[1]}) h | mode ${modeLabel}`
      : `${res.sitioA}  vs  ${res.sitioB}   | ventana (${res.ventana[0]}, ${res.ventana[1]}) h | modo ${res.modo}`;
  const line = '-'.repeat(66);
  const rows = ORDEN_VARIABLES.map((k) => {
    const val = res.porVariable[k].toFixed(1).padStart(5, ' ');
    const c =
      k === 'temperatura' || k === 'luz' || k === 'viento' || k === 'presion'
        ? res.correlacionTemporal[k]
        : null;
    const extra =
      c !== null && c !== undefined
        ? lang === 'en'
          ? `  (temporal shape r=${c >= 0 ? '+' : ''}${c.toFixed(2)})`
          : `  (forma temporal r=${c >= 0 ? '+' : ''}${c.toFixed(2)})`
        : '';
    const keyLabel = lang === 'en' ? EN_VAR_COL[k] : k;
    return `${keyLabel.padEnd(12, ' ')}${val} %${extra}`;
  });
  const totalStr = res.total.toFixed(1).padStart(5, ' ');
  const mediaStr = res.mediaSimple.toFixed(1);
  const meanText =
    lang === 'en'
      ? `weighted mean ${mediaStr} %`
      : `media ponderada ${mediaStr} %`;
  return [
    header,
    line,
    ...rows,
    line,
    `${'TOTAL'.padEnd(12, ' ')}${totalStr} %   (${meanText})`,
  ].join('\n');
}
