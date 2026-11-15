import type { Lang } from './i18n';
import type {
  RecomendacionAnalogo,
  VariableAnalogo,
} from './analogo';
import type {
  BlindajeMaterialId,
  ComponentPinDiagnostic,
  HardwareSpec,
  MaterialTipo,
  RecubrimientoTipo,
  WearMetricsResult,
  ZonaDespliegueId,
} from './wearEngine';

const VAR_LABELS_EN: Record<VariableAnalogo, string> = {
  temperatura: 'Temperature',
  presion: 'Pressure',
  viento: 'Wind',
  luz: 'Irradiance',
  gravedad: 'Gravity',
  radiacion: 'Radiation',
  aire: 'Air / Exosphere',
  suelo: 'Soil / Regolith',
  terreno: 'Terrain',
};

const VAR_LABELS_ES: Record<VariableAnalogo, string> = {
  temperatura: 'Temperatura',
  presion: 'Presión',
  viento: 'Viento',
  luz: 'Irradiancia',
  gravedad: 'Gravedad',
  radiacion: 'Radiación',
  aire: 'Aire / Exosfera',
  suelo: 'Suelo / Regolito',
  terreno: 'Terreno',
};

const VAR_TRANSFORMS_EN: Record<VariableAnalogo, string> = {
  temperatura: 'Linear (K) · tol. 60 K',
  presion: 'log₁₀(Pa) · tol. 3.0 dec.',
  viento: 'Linear (m/s) · tol. 15 m/s',
  luz: 'Linear (W/m²) · tol. 700 W/m²',
  gravedad: 'Linear (m/s²) · tol. 9.81 m/s²',
  radiacion: 'log₁₀(µSv/h) · tol. 2.0 dec.',
  aire: '1 − TV(mol) · composition',
  suelo: '1 − TV(oxides) · mineralogy',
  terreno: 'Slope / 30° + Roughness / 0.2 m',
};

const VAR_TRANSFORMS_ES: Record<VariableAnalogo, string> = {
  temperatura: 'Lineal (K) · tol. 60 K',
  presion: 'log₁₀(Pa) · tol. 3.0 déc.',
  viento: 'Lineal (m/s) · tol. 15 m/s',
  luz: 'Lineal (W/m²) · tol. 700 W/m²',
  gravedad: 'Lineal (m/s²) · tol. 9.81 m/s²',
  radiacion: 'log₁₀(µSv/h) · tol. 2.0 déc.',
  aire: '1 − TV(mol) · composición',
  suelo: '1 − TV(óxidos) · mineralogía',
  terreno: 'Pendiente / 30° + Rugosidad / 0.2 m',
};

export function translateVariableLabel(v: VariableAnalogo, lang: Lang): string {
  return lang === 'en' ? VAR_LABELS_EN[v] : VAR_LABELS_ES[v];
}

export function translateVariableTransform(v: VariableAnalogo, lang: Lang): string {
  return lang === 'en' ? VAR_TRANSFORMS_EN[v] : VAR_TRANSFORMS_ES[v];
}

const SITE_NAME_EN_EXACT: Record<string, string> = {
  'Tierra (Atacama, 2400 m)': 'Earth (Atacama, 2400 m)',
  'Tierra (Atacama · NASA Earthdata)': 'Earth (Atacama · NASA Earthdata)',
  'Marte (Cráter Gale)': 'Mars (Gale Crater)',
  'Luna (ecuador, mare)': 'Moon (equator, mare)',
  'Desierto de Atacama · Yungay': 'Atacama Desert · Yungay',
  'Valles Secos de McMurdo': 'McMurdo Dry Valleys',
  'Río Tinto (Huelva)': 'Río Tinto (Huelva)',
  'Desierto de Mojave': 'Mojave Desert',
  'Caldera de Askja (Islandia)': 'Askja Caldera (Iceland)',
  'Cráter Haughton (Isla Devon)': 'Haughton Crater (Devon Island)',
  'Estación MDRS (Utah)': 'MDRS Station (Utah)',
  'Svalbard · Ny-Ålesund': 'Svalbard · Ny-Ålesund',
  'Mauna Loa (Hawái · 3400 m)': 'Mauna Loa (Hawaii · 3400 m)',
  'Depresión de Danakil': 'Danakil Depression',
  'Cuenca de Qaidam': 'Qaidam Basin',
  'White Sands (Nuevo México)': 'White Sands (New Mexico)',
  'Salar de Uyuni (3656 m)': 'Uyuni Salt Flat (3656 m)',
  'Cratón de Pilbara': 'Pilbara Craton',
  'Timanfaya (Lanzarote)': 'Timanfaya (Lanzarote)',
  'Tierra (Desierto de Mojave · Earthdata)': 'Earth (Mojave Desert · Earthdata)',
  'Tierra (Askja Islandia · Earthdata)': 'Earth (Askja Iceland · Earthdata)',
  'Tierra (Cráter Haughton · Earthdata)': 'Earth (Haughton Crater · Earthdata)',
  'Tierra (Salar de Uyuni · Earthdata)': 'Earth (Uyuni Salt Flat · Earthdata)',
  'Mare Tranquillitatis (Apollo 11)': 'Mare Tranquillitatis (Apollo 11)',
  'Cráter Tycho (Tierras Altas)': 'Tycho Crater (Highlands)',
  'Luna (Cráter Tycho · PDS LRO)': 'Moon (Tycho Crater · PDS LRO)',
  'Meseta de Aristarchus': 'Aristarchus Plateau',
  'Luna (Meseta Aristarchus · PDS LRO)': 'Moon (Aristarchus Plateau · PDS LRO)',
  'Cráter Copernicus': 'Copernicus Crater',
  'Luna (Cráter Copernicus · PDS LRO)': 'Moon (Copernicus Crater · PDS LRO)',
  'Polo Sur · Borde de Shackleton': 'South Pole · Shackleton Rim',
  'Luna (Polo Sur Shackleton · PDS LRO)': 'Moon (South Pole Shackleton · PDS LRO)',
  'Oceanus Procellarum': 'Oceanus Procellarum',
  'Mare Imbrium': 'Mare Imbrium',
  'Valle Taurus–Littrow (Apollo 17)': 'Taurus–Littrow Valley (Apollo 17)',
  'Cráter Von Kármán (Cara Oculta)': 'Von Kármán Crater (Far Side)',
  'Luna (Cráter Von Kármán · PDS LRO)': 'Moon (Von Kármán Crater · PDS LRO)',
  'Colinas Marius (Tubos de Lava)': 'Marius Hills (Lava Tubes)',
  'Luna (Colinas Marius · PDS LRO)': 'Moon (Marius Hills · PDS LRO)',
  'Cráter Plato': 'Plato Crater',
  'Luna (Cráter Plato · PDS LRO)': 'Moon (Plato Crater · PDS LRO)',
  'Rima Hadley / Apenninus (Apollo 15)': 'Hadley Rille / Apenninus (Apollo 15)',
  'Luna (Rima Hadley · PDS LRO)': 'Moon (Hadley Rille · PDS LRO)',
  'Cráter Alphonsus': 'Alphonsus Crater',
  'Luna (Cráter Alphonsus · PDS LRO)': 'Moon (Alphonsus Crater · PDS LRO)',
  'Cráter Gale (Curiosity)': 'Gale Crater (Curiosity)',
  'Marte (Cráter Gale · PDS REMS)': 'Mars (Gale Crater · PDS REMS)',
  'Cráter Jezero (Perseverance)': 'Jezero Crater (Perseverance)',
  'Marte (Cráter Jezero · PDS MEDA)': 'Mars (Jezero Crater · PDS MEDA)',
  'Elysium Planitia (InSight)': 'Elysium Planitia (InSight)',
  'Arcadia Planitia (Hielo somero)': 'Arcadia Planitia (Shallow ice)',
  'Cuenca Hellas Planitia': 'Hellas Planitia Basin',
  'Valles Marineris (Coprates)': 'Valles Marineris (Coprates)',
  'Olympus Mons (Cumbre 21 km)': 'Olympus Mons (21 km Summit)',
  'Utopia Planitia (Viking 2)': 'Utopia Planitia (Viking 2)',
  'Meridiani Planum (Opportunity)': 'Meridiani Planum (Opportunity)',
  'Cráter Gusev (Spirit)': 'Gusev Crater (Spirit)',
  'Marte (Cráter Gusev · PDS MER)': 'Mars (Gusev Crater · PDS MER)',
  'Chryse Planitia (Viking 1)': 'Chryse Planitia (Viking 1)',
  'Vastitas Borealis (Phoenix)': 'Vastitas Borealis (Phoenix)',
  'Oxia Planum (Zona ExoMars)': 'Oxia Planum (ExoMars Zone)',
};

export function translateSiteName(name: string, lang: Lang): string {
  if (lang === 'es' || !name) return name;
  if (SITE_NAME_EN_EXACT[name]) return SITE_NAME_EN_EXACT[name];
  return name
    .replace(/^Tierra\b/, 'Earth')
    .replace(/^Marte\b/, 'Mars')
    .replace(/^Luna\b/, 'Moon')
    .replace(/\bCráter\b/g, 'Crater')
    .replace(/\bPolo Sur\b/g, 'South Pole')
    .replace(/\bMeseta\b/g, 'Plateau')
    .replace(/\bColinas\b/g, 'Hills')
    .replace(/\bRima\b/g, 'Rille')
    .replace(/\bValle\b/g, 'Valley')
    .replace(/\bCuenca\b/g, 'Basin')
    .replace(/\bMapa PDS\b/g, 'PDS Map')
    .replace(/\bSatélite\b/g, 'Satellite')
    .replace(/\ben vivo\b/g, 'live')
    .replace(/\bCalibrado\b/g, 'Calibrated');
}

const PRESET_DESC_EN: Record<string, string> = {
  'atacama-yungay': 'Hyperarid analog with nitrates and perchlorates for Mars rovers.',
  'valles-secos-mcmurdo': 'Cold permafrost and katabatic winds ideal for thermal and seal testing.',
  'rio-tinto': 'Iron oxide- and sulfate-rich soil akin to Meridiani Planum.',
  'mojave-baker': 'Historic JPL testbed for 6x6 mobility trials over sand and basalt.',
  'askja-islandia': 'Highly abrasive volcanic tephra and basalt used in Apollo and lunar EVA training.',
  'devon-haughton': 'Arctic impact structure with breccia and polar cycle for suits and habitats.',
  'utah-mdrs': 'Ferric clays and sandstones used in simulated Mars base campaigns.',
  'svalbard-ny-alesund': 'High-latitude periglacial soil used in AMASE campaigns for Mars 2020.',
  'mauna-loa': 'Sharp high-altitude basaltic scoria, standard for wheel and EVA boot wear.',
  'danakil-etiopia': 'Salt crusts, brines, and sulfur for validating astrobiological sensors.',
  'qaidam-china': 'Evaporitic playas, yardangs, and high-altitude fine dust analogous to Martian basins.',
  'white-sands': 'High-albedo gypsum dunes useful for photometry and loose-powder traction.',
  'salar-uyuni': 'High-UV evaporitic salt flat at low atmospheric pressure.',
  'pilbara-australia': 'Archean banded-iron formations parallel to potential biosignatures in Jezero.',
  'lanzarote-timanfaya': 'Basaltic volcanic fields for ESA PANGAEA geological training.',
};

export function translateEarthRecommendationSummary(
  rec: RecomendacionAnalogo,
  lang: Lang
): string {
  if (lang === 'es') return rec.resumenIngenieria;
  const desc = PRESET_DESC_EN[rec.preset.id] ?? rec.preset.descripcion;
  const f0 = rec.factoresFuertes[0];
  const f1 = rec.factoresFuertes[1];
  const v0 = f0 ? translateVariableLabel(f0.variable, 'en').toLowerCase() : '';
  const v1 = f1 ? translateVariableLabel(f1.variable, 'en').toLowerCase() : '';
  return `${desc} Excels in ${v0} (${f0?.valor.toFixed(0) ?? '0'}%) and ${v1} (${f1?.valor.toFixed(0) ?? '0'}%).`;
}

const HARDWARE_EN: Record<string, { nombre: string; descripcion: string }> = {
  'rover-6x6': {
    nombre: '6×6 Explorer Rover',
    descripcion: '6-wheel rocker-bogie mobile platform with optical mast, robotic arm, and RTG/solar deck.',
  },
  'traje-eva': {
    nombre: 'EVA Space Suit (xEMU)',
    descripcion: 'Pressurized extravehicular unit with gold visor, PLSS backpack, and rotary bearings.',
  },
  'base-permanente': {
    nombre: 'Permanent Base (Dome + Airlock)',
    descripcion: 'Pressurized geodesic habitat at 70 kPa with dust-mitigation airlock and PV array.',
  },
};

export function translateHardwareInfo(
  hw: HardwareSpec,
  lang: Lang
): { nombre: string; descripcion: string } {
  if (lang === 'es') return { nombre: hw.nombre, descripcion: hw.descripcion };
  return HARDWARE_EN[hw.id] ?? { nombre: hw.nombre, descripcion: hw.descripcion };
}

const MATERIAL_EN: Record<
  MaterialTipo,
  { nombre: string; referenciaNasa: string; notasFalla: string }
> = {
  ti6al4v: {
    nombre: 'Titanium Ti-6Al-4V (Aerospace Grade)',
    referenciaNasa: 'NASA-STD-6016 / Mars 2020 Chassis & Suspension',
    notasFalla: 'Excellent thermal stability; susceptible to galling in dust without solid lubricant.',
  },
  al7075: {
    nombre: 'Aluminum 7075-T651',
    referenciaNasa: 'NASA-TM-2019 / Primary Structure & Wheels',
    notasFalla: 'High thermal expansion (CTE) accelerates joint fatigue across >150 K swings.',
  },
  kevlar_vectran: {
    nombre: 'Orthofabric Composite (Kevlar / Vectran)',
    referenciaNasa: 'NASA xEMU / Artemis Outer TMG Layers',
    notasFalla: 'Glassy lunar regolith grains sever microfibers after repeated flex cycles.',
  },
  regolito_sinterizado: {
    nombre: 'Sintered Basaltic Regolith (ISRU)',
    referenciaNasa: 'NASA STMD Moon-to-Mars ISRU Construction',
    notasFalla: 'High surface hardness against dust, but lower toughness under thermal tension.',
  },
  fibra_carbono: {
    nombre: 'High-Modulus Epoxy CFRP (M55J)',
    referenciaNasa: 'NASA JPL Composite Mast & Arms',
    notasFalla: 'UV and ionizing radiation gradually degrade the outer polymer matrix.',
  },
};

export function translateMaterialInfo(
  id: MaterialTipo,
  fallback: { nombre: string; referenciaNasa: string; notasFalla: string },
  lang: Lang
): { nombre: string; referenciaNasa: string; notasFalla: string } {
  if (lang === 'es') return fallback;
  return MATERIAL_EN[id] ?? fallback;
}

const COATING_EN: Record<RecubrimientoTipo, { nombre: string; referenciaNasa: string }> = {
  ninguno: {
    nombre: 'Uncoated (Bare Substrate)',
    referenciaNasa: 'Standard surface with no protective coating',
  },
  hbn_ceramico: {
    nombre: 'Hexagonal Boron Nitride + EDS Ceramic',
    referenciaNasa: 'NASA KSC Electrodynamic Dust Shield (CLPS)',
  },
  kapton_mli: {
    nombre: 'Aluminized Kapton MLI Thermal Blanket',
    referenciaNasa: 'NASA-HDBK-4002 Thermal Control Blanket',
  },
  anodizado_duro: {
    nombre: 'MIL-A-8625 Type III Hard Anodizing',
    referenciaNasa: 'NASA JPL Mars Surface Tribology',
  },
  ti_al_nitruro: {
    nombre: 'PVD TiAlN Coating (High Hardness)',
    referenciaNasa: 'NASA GRC Regolith Abrasion Coating',
  },
};

export function translateCoatingInfo(
  id: RecubrimientoTipo,
  fallback: { nombre: string; referenciaNasa: string },
  lang: Lang
): { nombre: string; referenciaNasa: string } {
  if (lang === 'es') return fallback;
  return COATING_EN[id] ?? fallback;
}

const ZONE_EN: Record<ZonaDespliegueId, string> = {
  planicie: 'Compacted Regolith Plain (Nominal)',
  pendiente_rocosa: 'Rocky Slope & Breccia (>15°)',
  crater_sombra: 'Cryogenic Shadowed Crater Rim',
  tormenta_polvo: 'Aeolian Corridor / Dust Storm',
};

export function translateZoneName(
  id: ZonaDespliegueId,
  fallbackName: string,
  lang: Lang
): string {
  if (lang === 'es') return fallbackName;
  return ZONE_EN[id] ?? fallbackName;
}

const SHIELD_EN: Record<BlindajeMaterialId, { nombre: string; notaNasa: string }> = {
  polietileno: {
    nombre: 'High-Density Polyethylene (HDPE)',
    notaNasa: 'Mass-optimal due to high hydrogen content; minimizes secondary GCR neutrons.',
  },
  agua: {
    nombre: 'Potable Water / Hydrogel Wall',
    notaNasa: 'Dual life-support + SPE solar proton attenuation in crew storm shelters.',
  },
  aluminio: {
    nombre: 'Structural Aluminum 2219 / 7075',
    notaNasa: 'Pressurized hull standard; excessive thickness produces secondary cascades unless paired with H₂.',
  },
  regolito: {
    nombre: 'Compacted Regolith Bags / Bricks',
    notaNasa: 'Cost-effective in-situ mass shielding for permanent lunar & Martian habitats (>40 cm ideal).',
  },
  plomo_compuesto: {
    nombre: 'Polymer–Lead / Tantalum Composite',
    notaNasa: 'Compact for sensitive electronics, but penalizes launch mass on large habitats.',
  },
};

export function translateShieldInfo(
  id: BlindajeMaterialId,
  fallback: { nombre: string; notaNasa: string },
  lang: Lang
): { nombre: string; notaNasa: string } {
  if (lang === 'es') return fallback;
  return SHIELD_EN[id] ?? fallback;
}

export function translateWearState(
  estado: 'Nominal' | 'Vigilancia' | 'Crítico',
  lang: Lang
): string {
  if (lang === 'es') return estado;
  if (estado === 'Crítico') return 'Critical';
  if (estado === 'Vigilancia') return 'Watch';
  return 'Nominal';
}

const PIN_EN: Record<
  string,
  {
    titulo: string;
    subtitulo: string;
    mecanismoDominante: string;
    recomendacionNasa: string;
  }
> = {
  visor: {
    titulo: 'Polycarbonate + Gold Visor',
    subtitulo: 'UV/IR & micro-impact protection',
    mecanismoDominante: 'Fine electrostatic dust scratching',
    recomendacionNasa: 'Apply replaceable tear-off shield and non-contact EDS cleaning.',
  },
  juntas: {
    titulo: 'Elbow/Shoulder Bearings & Seals',
    subtitulo: 'Sealed at pressurized differential',
    mecanismoDominante: 'Regolith infiltration & elastomer fatigue',
    recomendacionNasa: 'Vectran protective bellows + dual fluorosilicone dust seals.',
  },
  plss: {
    titulo: 'PLSS Backpack & Sublimator',
    subtitulo: 'Thermal control & life-support avionics',
    mecanismoDominante: 'Day–night thermal cycling + radiation',
    recomendacionNasa: 'Multi-layer MLI blanket and high-emissivity radiator.',
  },
  botas: {
    titulo: 'Lunar/Martian Soles & Gaiters',
    subtitulo: 'Direct regolith ground contact',
    mecanismoDominante: 'Sharp basalt & breccia cutting abrasion',
    recomendacionNasa: 'Fluoroelastomer tread reinforced with Ti-6Al-4V metallic inserts.',
  },
  domo: {
    titulo: 'Main Pressurized Dome',
    subtitulo: 'Internal habitat pressure vessel',
    mecanismoDominante: 'Differential pressure stress & ΔT gradient fatigue',
    recomendacionNasa: 'Sintered regolith overburden (≥35 cm) to buffer ΔT and radiation.',
  },
  esclusa: {
    titulo: 'EVA Airlock & Hatch Seals',
    subtitulo: 'Dust ingress during egress/ingress cycles',
    mecanismoDominante: 'Seal abrasion from electrostatic regolith',
    recomendacionNasa: 'Rear suitports + electrodynamic dust shield (EDS) at threshold.',
  },
  paneles: {
    titulo: 'External Photovoltaic Array',
    subtitulo: 'Surface power generation',
    mecanismoDominante: 'Dust settling & solar-cell ionizing damage',
    recomendacionNasa: 'Anti-adhesion h-BN coating and electrostatic dust sweeping.',
  },
  cimentacion: {
    titulo: 'Anchoring & Thermal Foundation',
    subtitulo: 'Terrain slope bearing interface',
    mecanismoDominante: 'Soil–structure differential thermal expansion',
    recomendacionNasa: 'Sliding expansion joints with Ti-6Al-4V shear pins.',
  },
  ruedas: {
    titulo: 'Metallic Wheels & Grouser Treads',
    subtitulo: 'Continuous regolith traction',
    mecanismoDominante: 'Mineral abrasion & rock-torsion fatigue',
    recomendacionNasa: 'Compliant Nitinol / Ti-6Al-4V tires with hard-anodized grousers.',
  },
  chasis: {
    titulo: 'Warm Electronics Box (WEB) & Avionics',
    subtitulo: 'Flight computers & batteries',
    mecanismoDominante: 'Thermal cycling & accumulated ionizing dose',
    recomendacionNasa: 'Aerogel insulation + ≥4 g/cm² local HDPE radiation shielding.',
  },
  mastil: {
    titulo: 'Remote Sensing Mast & Optical Head',
    subtitulo: 'Cameras, spectrometer & actuators',
    mecanismoDominante: 'Gear-train dust & night condensation',
    recomendacionNasa: 'Labyrinth seals + heated optical window covers.',
  },
  energia: {
    titulo: 'Solar Deck / RTG Radiator',
    subtitulo: 'Power harvesting & heat rejection',
    mecanismoDominante: 'Fine dust obscuration & aeolian erosion',
    recomendacionNasa: 'Low-triboelectric h-BN ceramic surface treatment.',
  },
};

export function translatePinDiagnostic(
  pin: ComponentPinDiagnostic,
  hw: HardwareSpec,
  slopeDeg: number,
  lang: Lang
): ComponentPinDiagnostic {
  if (lang === 'es') return pin;
  const en = PIN_EN[pin.id];
  if (!en) {
    return {
      ...pin,
      estado: translateWearState(pin.estado, lang) as ComponentPinDiagnostic['estado'],
    };
  }
  let subtitulo = en.subtitulo;
  if (pin.id === 'juntas') subtitulo = `Sealed at ${hw.selladoKpa} kPa`;
  if (pin.id === 'domo') subtitulo = `Internal pressure ${hw.selladoKpa} kPa`;
  if (pin.id === 'cimentacion') subtitulo = `Slope ${slopeDeg}°`;

  return {
    ...pin,
    titulo: en.titulo,
    subtitulo,
    estado: translateWearState(pin.estado, lang) as ComponentPinDiagnostic['estado'],
    mecanismoDominante: en.mecanismoDominante,
    recomendacionNasa: en.recomendacionNasa,
  };
}

export function translateWearAlert(
  metrics: WearMetricsResult,
  hw: HardwareSpec,
  dias: number,
  lang: Lang
): string | null {
  if (!metrics.alertaCritica) return null;
  if (lang === 'es') return metrics.alertaCritica;

  if (metrics.tMinLocalK < hw.tempMinK - 10) {
    return `Thermal alert: local minimum temperature (${metrics.tMinLocalK.toFixed(0)} K) below nominal limit (${hw.tempMinK} K). Seal embrittlement risk.`;
  }
  if (metrics.tMaxLocalK > hw.tempMaxK + 10) {
    return `Local overheating (${metrics.tMaxLocalK.toFixed(0)} K > ${hw.tempMaxK} K). Additional MLI insulation or radiator recommended.`;
  }
  if (metrics.integridadGlobal < 45) {
    return `Critical global integrity (${metrics.integridadGlobal.toFixed(1)}%) at day ${dias}. Preventive maintenance or coating upgrade required.`;
  }
  return metrics.alertaCritica;
}

export function translateShieldAssessment(
  fraccionLimiteNasa600MsvPct: number,
  dosisTotalMisionMsv: number,
  lang: Lang
): { nivelSeguridadTripulacion: string; riesgoElectronica: string } {
  if (lang === 'es') {
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
    return { nivelSeguridadTripulacion, riesgoElectronica };
  }

  let nivelSeguridadTripulacion = 'Optimal (Within NASA ALARA limit)';
  if (fraccionLimiteNasa600MsvPct > 100) {
    nivelSeguridadTripulacion = 'Exceeds NASA career limit (600 mSv)';
  } else if (fraccionLimiteNasa600MsvPct > 45) {
    nivelSeguridadTripulacion = 'Moderate margin (reinforce SPE shelter)';
  }

  let riesgoElectronica = 'Low (Radiation-tolerant COTS sufficient)';
  if (dosisTotalMisionMsv > 180) {
    riesgoElectronica = 'High (Rad-Hard / TMR components required)';
  } else if (dosisTotalMisionMsv > 60) {
    riesgoElectronica = 'Medium (ECC memory & watchdog recommended)';
  }

  return { nivelSeguridadTripulacion, riesgoElectronica };
}
