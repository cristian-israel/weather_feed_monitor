import { carregarContexto } from './catalogo';
import { executarLembretes } from './executar';
import { notificador } from './notificador';

/** Dispara os lembretes uma vez (para testar sem esperar o cron). */
async function main() {
  const ctx = carregarContexto();
  await executarLembretes(notificador, ctx);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
