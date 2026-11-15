import { GoogleGenAI, Type } from '@google/genai';
import {
  buscarReglaListaBlanca,
  extraerDominio,
} from './whitelist.ts';

export interface GroundingFuente {
  title: string;
  uri: string;
  dominio: string | null;
  enListaBlanca: boolean;
}

export interface SearchVerificationResult {
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

const MODEL_ID = 'gemini-4-hydrogen';

export async function verificarConGoogleSearch(input: {
  consulta: string;
  sitio: string;
  sourceUrl?: string;
  temperatura?: number | string;
  presion?: number | string;
  viento?: number | string;
  luz?: number | string;
}): Promise<SearchVerificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY no está configurada en los secretos del entorno.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const prompt = [
    `Sitio objetivo: ${input.sitio}`,
    `Consulta científica: ${input.consulta}`,
    input.sourceUrl ? `URL propuesta por el usuario: ${input.sourceUrl}` : '',
    `Valores propuestos (SI): temperatura=${input.temperatura ?? 'N/D'} K, presion=${input.presion ?? 'N/D'} Pa, viento=${input.viento ?? 'N/D'} m/s, luz=${input.luz ?? 'N/D'} W/m².`,
    'Verifica con Google Search si los valores físicos son consistentes con observaciones reales de NASA, PDS, ESA, NOAA o literatura científica. Extrae los valores más representativos en SI (temperatura en Kelvin [0..1000], presión en Pascales [0..1e7], viento en m/s [0..150], irradiancia en W/m² [0..1500]).',
  ]
    .filter(Boolean)
    .join('\n');

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction:
          'Eres un auditor de datos planetarios. Responde estrictamente con JSON válido en español evaluando los datos ambientales frente a fuentes científicas encontradas mediante Google Search.',
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verificado: { type: Type.BOOLEAN },
            confianza: { type: Type.NUMBER },
            resumen: { type: Type.STRING },
            sitioSugerido: { type: Type.STRING },
            temperatura: { type: Type.NUMBER, nullable: true },
            presion: { type: Type.NUMBER, nullable: true },
            viento: { type: Type.NUMBER, nullable: true },
            luz: { type: Type.NUMBER, nullable: true },
            hora: { type: Type.NUMBER },
          },
          required: ['verificado', 'confianza', 'resumen', 'sitioSugerido'],
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      const quotaErr = new Error(
        'Cuota de Gemini API / Google Search alcanzada temporalmente (429 RESOURCE_EXHAUSTED). Puedes seguir usando fuentes de la lista blanca oficial.'
      );
      (quotaErr as Error & { statusCode?: number }).statusCode = 429;
      throw quotaErr;
    }
    throw err;
  }

  let parsed: {
    verificado?: boolean;
    confianza?: number;
    resumen?: string;
    sitioSugerido?: string;
    temperatura?: number | null;
    presion?: number | null;
    viento?: number | null;
    luz?: number | null;
    hora?: number;
  } = {};

  try {
    parsed = JSON.parse((response.text ?? '{}').trim());
  } catch {
    parsed = {
      verificado: false,
      confianza: 0.4,
      resumen: response.text || 'Sin respuesta estructurada.',
      sitioSugerido: input.sitio,
    };
  }

  const candidate = response.candidates?.[0] as
    | {
        groundingMetadata?: {
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string };
          }>;
        };
      }
    | undefined;

  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const fuentes: GroundingFuente[] = [];
  for (const ch of chunks) {
    const uri = ch.web?.uri;
    if (!uri) continue;
    const dom = extraerDominio(uri);
    const match = buscarReglaListaBlanca(uri);
    fuentes.push({
      title: ch.web?.title || dom || 'Fuente web',
      uri,
      dominio: dom,
      enListaBlanca: Boolean(match),
    });
  }

  const urlMatch = input.sourceUrl ? buscarReglaListaBlanca(input.sourceUrl) : null;
  const enListaBlanca = Boolean(urlMatch || fuentes.some((f) => f.enListaBlanca));

  return {
    verificado: Boolean(parsed.verificado),
    confianza: Math.max(0, Math.min(1, Number(parsed.confianza) || 0.5)),
    resumen: parsed.resumen || 'Verificación completada.',
    sitioSugerido: parsed.sitioSugerido || input.sitio,
    valores: {
      temperatura:
        typeof parsed.temperatura === 'number' && Number.isFinite(parsed.temperatura)
          ? parsed.temperatura
          : Number.isFinite(Number(input.temperatura))
            ? Number(input.temperatura)
            : null,
      presion:
        typeof parsed.presion === 'number' && Number.isFinite(parsed.presion)
          ? parsed.presion
          : Number.isFinite(Number(input.presion))
            ? Number(input.presion)
            : null,
      viento:
        typeof parsed.viento === 'number' && Number.isFinite(parsed.viento)
          ? parsed.viento
          : Number.isFinite(Number(input.viento))
            ? Number(input.viento)
            : null,
      luz:
        typeof parsed.luz === 'number' && Number.isFinite(parsed.luz)
          ? parsed.luz
          : Number.isFinite(Number(input.luz))
            ? Number(input.luz)
            : null,
      hora:
        typeof parsed.hora === 'number' && Number.isFinite(parsed.hora)
          ? parsed.hora
          : 12,
    },
    fuentes,
    enListaBlanca,
    modelo: MODEL_ID,
  };
}
