import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import {
  compararSitios,
  formatearInformeTexto,
  ResultadoComparacion,
  SitioAmbiental,
} from '../lib/analogo';
import { useLanguage } from '../lib/i18n';

interface ConsoleOutputProps {
  sitios: SitioAmbiental[];
  resultadoActivo: ResultadoComparacion;
}

export const ConsoleOutput: React.FC<ConsoleOutputProps> = ({
  sitios,
  resultadoActivo,
}) => {
  const { lang, t } = useLanguage();
  const [copiado, setCopiado] = useState(false);

  const tSite = sitios[0];
  const m = sitios[1];
  const l = sitios[2];

  const bloqueMain = [
    formatearInformeTexto(compararSitios(tSite, m, { horas: [0, 48], modo: 'reloj' }), lang),
    formatearInformeTexto(compararSitios(tSite, l, { horas: [0, 48], modo: 'reloj' }), lang),
    formatearInformeTexto(compararSitios(m, l, { horas: [0, 48], modo: 'ciclo' }), lang),
  ].join('\n\n');

  const bloqueActivo = formatearInformeTexto(resultadoActivo, lang);

  const textoCompleto = `=== ${t('Comparación activa', 'Active Comparison')} ===\n${bloqueActivo}\n\n=== ${t('Ejecución estándar (__main__ de analogo.py)', 'Standard Run (__main__ of analogo.py)')} ===\n${bloqueMain}\n`;

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCompleto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Silencio si el navegador restringe el portapapeles
    }
  };

  const handleDescargarJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            comparacionActiva: {
              sitioA: resultadoActivo.sitioA,
              sitioB: resultadoActivo.sitioB,
              ventana: resultadoActivo.ventana,
              modo: resultadoActivo.modo,
              n: resultadoActivo.n,
              porVariable: resultadoActivo.porVariable,
              correlacionTemporal: resultadoActivo.correlacionTemporal,
              mediaPonderada: resultadoActivo.mediaSimple,
              total: resultadoActivo.total,
            },
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'informe_analogo.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      id="consola"
      className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            {t('Informe de consola (analogo.py)', 'Console Report (analogo.py)')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t(
              'Salida equivalente a informe(comparar(...)) para la selección actual y los tres casos estándar',
              'Equivalent output to informe(comparar(...)) for the active selection and the three standard cases'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopiar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-800 rounded-md hover:border-cyan-500/50 whitespace-nowrap shrink-0 transition-colors"
          >
            {copiado ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                {t('Copiado', 'Copied')}
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                {t('Copiar salida', 'Copy output')}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDescargarJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t('Exportar JSON', 'Export JSON')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-400 mb-2">
            {t('Comparación activa', 'Active Comparison')}
          </div>
          <pre className="p-4 bg-[#07090E] border border-slate-800 text-slate-200 rounded-md font-mono text-xs leading-relaxed overflow-x-auto tabular-nums">
            {bloqueActivo}
          </pre>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-400 mb-2">
            {t('Ejecución estándar (__main__)', 'Standard Run (__main__)')}
          </div>
          <pre className="p-4 bg-[#07090E] border border-slate-800 text-slate-200 rounded-md font-mono text-xs leading-relaxed overflow-x-auto tabular-nums">
            {bloqueMain}
          </pre>
        </div>
      </div>
    </section>
  );
};
