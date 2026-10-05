import cron from 'node-cron';
import { carregarContexto, type Contexto } from './catalogo';
import { config } from './config';
import { executar, executarLembretes } from './executar';
import { fonteMock } from './fonte-mock';
import { fontePlaywright } from './fonte-playwright';
import { notificador } from './notificador';

const fonte = config.fonte === 'mock' ? fonteMock : fontePlaywright;

let ctx: Contexto;
try {
  ctx = carregarContexto();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

for (const [nome, expr] of [
  ['CRON', config.cron],
  ['CRON_LEMBRETE', config.cronLembrete],
] as const) {
  if (expr !== 'off' && !cron.validate(expr)) {
    console.error(`Expressão cron inválida em ${nome}: "${expr}"`);
    process.exit(1);
  }
}

let rodando = false;

async function rodada() {
  // Evita sobreposição caso uma rodada demore mais que o intervalo.
  if (rodando) {
    console.warn('Rodada anterior ainda em andamento; ignorando esta.');
    return;
  }
  rodando = true;
  try {
    await executar(fonte, notificador, ctx);
  } catch (e) {
    console.error('Erro na rodada:', (e as Error).message);
  } finally {
    rodando = false;
  }
}

cron.schedule(config.cron, rodada, { timezone: config.timezone });
const municipios = ctx.locais.map((l) => `${l.municipio}/${l.uf}`).join(', ');
console.log(`Captura: "${config.cron}" (${config.timezone}). Municípios: ${municipios}`);

if (config.cronLembrete !== 'off') {
  cron.schedule(config.cronLembrete, () => void executarLembretes(notificador, ctx), {
    timezone: config.timezone,
  });
  console.log(
    `Lembrete: "${config.cronLembrete}" (para após ${config.maxDiasLembrete} dias sem alerta)`,
  );
}

if (config.rodarAoIniciar) void rodada();
