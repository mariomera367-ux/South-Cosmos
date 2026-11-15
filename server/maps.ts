import { GoogleGenAI } from '@google/genai';

export interface MapsGroundingSnippet {
  author: string | null;
  text: string;
  uri: string | null;
}

export interface MapsGroundingPlace {
  title: string;
  uri: string;
  placeId: string | null;
  reviewSnippets: MapsGroundingSnippet[];
}

export interface MapsGroundingResult {
  respuestaMarkdown: string;
  lugares: MapsGroundingPlace[];
  lat: number | null;
  lon: number | null;
  consulta: string;
  modelo: string;
}

const MODEL_ID = 'gemini-4-hydrogen';

export async function consultarGoogleMapsGrounding(input: {
  consulta: string;
  lat?: number | null;
  lon?: number | null;
}): Promise<MapsGroundingResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY no está configurada en los secretos del entorno.'
    );
  }

  const lat =
    typeof input.lat === 'number' && Number.isFinite(input.lat)
      ? input.lat
      : null;
  const lon =
    typeof input.lon === 'number' && Number.isFinite(input.lon)
      ? input.lon
      : null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const prompt =
    lat !== null && lon !== null
      ? `Coordenadas de referencia: (${lat.toFixed(4)}, ${lon.toFixed(4)}).\nConsulta: ${input.consulta}\nResponde en español con un resumen geográfico y logístico preciso basado en Google Maps.`
      : `${input.consulta}\nResponde en español con un resumen geográfico preciso basado en Google Maps.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        ...(lat !== null && lon !== null
          ? {
              toolConfig: {
                retrievalConfig: {
                  latLng: { latitude: lat, longitude: lon },
                },
              },
            }
          : {}),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      const quotaErr = new Error(
        'Cuota de Google Maps Grounding alcanzada temporalmente (429 RESOURCE_EXHAUSTED). Intenta nuevamente más tarde.'
      );
      (quotaErr as Error & { statusCode?: number }).statusCode = 429;
      throw quotaErr;
    }
    throw err;
  }

  const candidate = response.candidates?.[0] as
    | {
        groundingMetadata?: {
          groundingChunks?: Array<{
            maps?: {
              uri?: string;
              title?: string;
              placeId?: string;
              placeAnswerSources?: {
                reviewSnippets?: Array<{
                  author?: string;
                  text?: string;
                  googleMapsUri?: string;
                }>;
              };
            };
          }>;
        };
      }
    | undefined;

  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const lugares: MapsGroundingPlace[] = [];

  for (const ch of chunks) {
    const m = ch.maps;
    if (!m?.uri) continue;
    const snippets: MapsGroundingSnippet[] = (
      m.placeAnswerSources?.reviewSnippets ?? []
    )
      .filter((s) => Boolean(s.text))
      .map((s) => ({
        author: s.author ?? null,
        text: s.text ?? '',
        uri: s.googleMapsUri ?? null,
      }));

    lugares.push({
      title: m.title || 'Lugar en Google Maps',
      uri: m.uri,
      placeId: m.placeId ?? null,
      reviewSnippets: snippets,
    });
  }

  return {
    respuestaMarkdown:
      response.text || 'Sin síntesis territorial devuelta por el modelo.',
    lugares,
    lat,
    lon,
    consulta: input.consulta,
    modelo: MODEL_ID,
  };
}
