import type { FontePosts } from './tipos';

/**
 * Fonte de teste: devolve posts fixos, sem tocar no Instagram.
 * Ajuste os textos para municípios do seu locais.json (e do seu catálogo).
 */
export const fonteMock: FontePosts = {
  async buscarNovos(jaVisto) {
    const posts = [
      {
        id: 'mock-1',
        legenda: 'ALERTA: temporal com granizo em Taquara e Igrejinha nas próximas horas',
        imagemUrls: [],
      },
      {
        id: 'mock-2',
        legenda: 'Defesa Civil alerta para chuva forte em Parobé (RS) até as 22h',
        imagemUrls: [],
      },
      {
        id: 'mock-3',
        legenda: 'Bom dia! Sol e tempo firme no litoral de SC.',
        imagemUrls: [],
      },
    ];
    const novos = [];
    for (const p of posts) if (!(await jaVisto(p.id))) novos.push(p);
    return novos;
  },
};
