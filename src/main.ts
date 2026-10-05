import { carregarContexto } from './catalogo';
import { config } from './config';
import { executar } from './executar';
import { fonteMock } from './fonte-mock';
import { fontePlaywright } from './fonte-playwright';
import { notificador } from './notificador';

/** Executa uma única rodada e encerra (útil para testes ou para um cron externo). */
async function main() {
  const ctx = carregarContexto();
  const fonte = config.fonte === 'mock' ? fonteMock : fontePlaywright;
  await executar(fonte, notificador, ctx);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
