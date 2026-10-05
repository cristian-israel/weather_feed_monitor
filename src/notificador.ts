import type { Notificador } from './tipos';

/**
 * PONTO DE ENCAIXE DO NOTIFICADOR
 *
 * Substitua este stub pela sua implementação (Telegram, WhatsApp, e-mail, webhook...).
 * Implemente a interface `Notificador` e exporte como `notificador`.
 * O resto do projeto não precisa mudar.
 *
 * - enviar: alerta de um post. Cada ocorrência indica o município, se foi
 *   `direto` ou por `vizinho` (e quais vizinhos), e se é `incerto`.
 * - lembrar: lembrete diário com o tempo desde o último alerta de cada município.
 * - avisarFalha: erros de captura ou de rotina.
 */
export const notificador: Notificador = {
  async enviar(post, alerta) {
    for (const o of alerta.ocorrencias) {
      const rotulo =
        o.relacao === 'direto'
          ? `${o.municipio}/${o.uf}`
          : `${o.municipio}/${o.uf} (vizinho com alerta: ${o.via.join(', ')})`;
      console.log(
        `🚨 ${rotulo}${o.incerto ? ' [nome ambíguo]' : ''} | ${alerta.tipo_alerta ?? 'alerta'} | ${alerta.severidade ?? 's/ severidade'} | post ${post.id}`,
      );
    }
  },

  async lembrar(lembretes) {
    for (const l of lembretes) {
      const quando = l.dias === 0 ? `há ${l.horas}h` : `há ${l.dias} dia(s)`;
      console.log(`⏱️ ${l.municipio}/${l.uf}: último alerta ${quando} (${l.tipo_alerta ?? 'alerta'})`);
    }
  },

  async avisarFalha(mensagem) {
    console.error('⚠️ FALHA:', mensagem);
  },
};
