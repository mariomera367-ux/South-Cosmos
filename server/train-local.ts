import { ejecutarCiclo } from './ciclo.ts';
import { iniciar } from './db.ts';
import { predecirPar } from './ml.ts';

async function main() {
  iniciar();
  console.log('Iniciando entrenamiento neuronal 100% local...');
  const res = await ejecutarCiclo({
    sembrarSiVacio: true,
    incluirNasa: false,
    epocas: 800,
  });
  console.log('Ciclo completado:', res.entrenamiento);

  const pred = predecirPar({
    sitioA: 'Tierra (Atacama, 2400 m)',
    sitioB: 'Marte (Cráter Gale)',
    t0: 0,
    t1: 48,
  });
  console.log('Predicción Tierra vs Marte (similitud total):', pred.sim.total);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
