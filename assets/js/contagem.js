/* =========================================================
   new Arrays | Contagem regressiva
   - Alvo fixo no horário de Brasília (UTC-3): quem estiver em
     outro fuso vê o mesmo tempo restante.
   - Hora certa: lê o cabeçalho HTTP "Date" do próprio servidor
     (HostGator/Apache envia em toda resposta, sem PHP). Se o
     relógio do aparelho estiver errado em mais de 2 s, corrige.
     Sem resposta do servidor, usa o relógio do navegador.
   - Teste: ?simular=2026-10-05T09:59:50-03:00 finge que "agora"
     é esse instante (útil para ver o estado final).
   ========================================================= */
(() => {
  'use strict';

  const CFG = {
    alvo: '2026-10-05T10:00:00-03:00',   // segunda-feira, 05/10/2026, 10h (Brasília)
    inicio: '2026-09-28T10:00:00-03:00', // começo da barra de progresso (7 dias antes)
    toleranciaMs: 2000,                  // diferença mínima para corrigir o relógio local
    mensagens: ['// inicializando…', '// compilando experiência', '// conectando canais', '// alocando memória', '// renderizando o novo'],
    mensagemFinal: '// deploy em andamento'
  };

  const ALVO = Date.parse(CFG.alvo);
  const INICIO = Date.parse(CFG.inicio);
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- Hora ---------- */
  let desvio = 0; // ms a somar em Date.now()
  let agoraFixo = null;
  const agora = () => agoraFixo ?? (Date.now() + desvio);

  const sim = new URLSearchParams(location.search).get('simular');
  if (sim && !Number.isNaN(Date.parse(sim))) desvio = Date.parse(sim) - Date.now();
  // ?congelar=1 (com ?simular): para o relógio no instante simulado (usado para gerar a imagem de compartilhamento)
  const congelar = !!sim && new URLSearchParams(location.search).has('congelar');
  if (congelar) { agoraFixo = Date.parse(sim); }

  async function sincronizar() {
    if (sim || location.protocol === 'file:') return;
    try {
      const t0 = performance.now();
      const r = await fetch(location.pathname + '?hora=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
      const t1 = performance.now();
      const cab = r.headers.get('Date');
      if (!cab) return;
      // O cabeçalho vem em segundos inteiros: +500 ms é o meio do segundo
      const servidor = Date.parse(cab) + 500 + (t1 - t0) / 2;
      const dif = servidor - Date.now();
      if (Math.abs(dif) > CFG.toleranciaMs) { desvio = dif; agendar(); }
    } catch (_) { /* sem rede: segue no relógio do navegador */ }
  }

  /* ---------- Dígitos de 7 segmentos ---------- */
  const SEG = {
    a: '10,6 15,1 45,1 50,6 45,11 15,11',
    b: '52,8 57,13 57,43 52,48 47,43 47,13',
    c: '52,52 57,57 57,87 52,92 47,87 47,57',
    d: '10,94 15,89 45,89 50,94 45,99 15,99',
    e: '8,52 13,57 13,87 8,92 3,87 3,57',
    f: '8,8 13,13 13,43 8,48 3,43 3,13',
    g: '10,50 15,45 45,45 50,50 45,55 15,55'
  };
  const MAPA = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
  const NS = 'http://www.w3.org/2000/svg';

  function criarDigito() {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 60 100');
    svg.setAttribute('class', 'dig');
    const segs = {};
    for (const k in SEG) {
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', SEG[k]);
      svg.appendChild(p);
      segs[k] = p;
    }
    return { svg, segs, valor: null };
  }

  function mostrar(d, n, animar) {
    if (d.valor === n) return;
    const liga = n === 8.8 ? 'abcdefg' : n === null ? '' : MAPA[n];
    for (const k in d.segs) {
      const on = liga.includes(k);
      const p = d.segs[k];
      const era = p.classList.contains('on');
      p.classList.toggle('on', on);
      if (on && !era && animar && !reduzido) {
        p.classList.remove('novo'); void p.getBoundingClientRect(); p.classList.add('novo');
      }
    }
    d.valor = n;
  }

  const relogio = $('[data-relogio]');
  const grupos = {};
  for (const g of ['d', 'h', 'm', 's']) {
    const el = $(`[data-grupo="${g}"]`);
    const box = $('.grupo__digitos', el);
    const digs = [criarDigito(), criarDigito()];
    digs.forEach(d => box.appendChild(d.svg));
    grupos[g] = { el, digs, valor: null };
  }

  function falha(g) {
    if (reduzido) return;
    const el = grupos[g].el;
    el.classList.remove('falha'); void el.offsetWidth; el.classList.add('falha');
  }

  function escreverGrupo(g, v, animar) {
    const G = grupos[g];
    const txt = String(Math.min(v, 99)).padStart(2, '0');
    mostrar(G.digs[0], +txt[0], animar);
    mostrar(G.digs[1], +txt[1], animar);
    if (G.valor !== null && G.valor !== v && g !== 's' && animar) falha(g);
    G.valor = v;
  }

  /* ---------- Textos ---------- */
  const barra = $('[data-barra]');
  const pct = $('[data-pct]');
  const leitor = $('[data-leitor]');
  const aviso = $('[data-aviso]');
  const codigo = $('[data-codigo]');
  const statusTxt = $('[data-status-texto]');
  const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  let ultimoMinutoLido = null;

  function partes(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(t / 86400), h: Math.floor(t % 86400 / 3600), m: Math.floor(t % 3600 / 60), s: t % 60, total: t };
  }

  /* ---------- Ciclo ---------- */
  let timer = null, timerMeio = null, iniciado = false, zerado = false;

  function atualizar(animar = true) {
    const resta = ALVO - agora();
    const p = partes(resta);

    escreverGrupo('d', p.d, animar);
    escreverGrupo('h', p.h, animar);
    escreverGrupo('m', p.m, animar);
    escreverGrupo('s', p.s, animar);

    const prog = Math.min(1, Math.max(0, (agora() - INICIO) / (ALVO - INICIO)));
    barra.style.transform = `scaleX(${prog})`;
    pct.textContent = (prog * 100).toFixed(1).replace('.', ',') + '%';

    const minutoTotal = Math.floor(p.total / 60);
    if (minutoTotal !== ultimoMinutoLido && p.total > 0) {
      ultimoMinutoLido = minutoTotal;
      const itens = [];
      if (p.d) itens.push(pl(p.d, 'dia', 'dias'));
      if (p.h) itens.push(pl(p.h, 'hora', 'horas'));
      if (p.m || !itens.length) itens.push(pl(p.m, 'minuto', 'minutos'));
      const lista = itens.length > 1 ? itens.slice(0, -1).join(', ') + ' e ' + itens.at(-1) : itens[0];
      leitor.textContent = `Faltam ${lista} para o lançamento do novo site, na segunda-feira, 5 de outubro de 2026, às 10h, horário de Brasília.`;
    }

    if (p.total === 0 && !zerado) finalizar();
    return { resta, p };
  }

  function finalizar() {
    zerado = true;
    clearTimeout(timer);
    document.documentElement.classList.add('zerado');
    relogio.classList.remove('meio');
    aviso.hidden = false;
    leitor.textContent = 'Em instantes estaremos no ar.';
    statusTxt.textContent = 'Deploy';
    codigo.textContent = CFG.mensagemFinal;
    barra.style.transform = 'scaleX(1)';
    pct.textContent = '100%';
    window.dispatchEvent(new CustomEvent('na:tick', { detail: { forte: true, final: true } }));
  }

  function agendar() {
    clearTimeout(timer); clearTimeout(timerMeio);
    if (zerado) return;
    const { resta, p } = atualizar(iniciado);
    if (resta <= 0) return;
    // Próxima virada de segundo do tempo restante
    const espera = (resta % 1000) || 1000;
    timer = setTimeout(() => {
      const antes = p.m;
      const r = atualizar(true);
      tique(r.p.m !== antes || r.p.total === 0);
      agendar();
    }, espera + 4);
    // Dois-pontos piscam no meio do segundo
    relogio.classList.remove('meio');
    if (!reduzido && espera > 500) timerMeio = setTimeout(() => relogio.classList.add('meio'), espera - 500);
  }

  function tique(forte) {
    window.dispatchEvent(new CustomEvent('na:tick', { detail: { forte } }));
    if (somLigado) bipe(forte);
  }

  /* ---------- Som (Web Audio, desligado por padrão) ---------- */
  let ctx = null, somLigado = false;
  const btnSom = $('[data-som]');
  const somEstado = $('[data-som-estado]');

  function bipe(forte) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const saida = ctx.createGain();
    saida.gain.value = 0.9;
    saida.connect(ctx.destination);
    // "Tum": golpe grave curto
    const o1 = ctx.createOscillator(), g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(forte ? 150 : 120, t);
    o1.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o1.connect(g1).connect(saida);
    // "Tic": clique metálico
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'square';
    o2.frequency.setValueAtTime(forte ? 1320 : 1760, t);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.05, t + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o2.connect(g2).connect(saida);
    o1.start(t); o2.start(t); o1.stop(t + 0.25); o2.stop(t + 0.06);
  }

  btnSom.addEventListener('click', async () => {
    somLigado = !somLigado;
    if (somLigado) {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      bipe(true);
    }
    btnSom.setAttribute('aria-pressed', String(somLigado));
    somEstado.textContent = somLigado ? 'ligado' : 'desligado';
  });

  /* ---------- Linha de código ---------- */
  function digitar(texto) {
    if (reduzido) { codigo.textContent = texto; return Promise.resolve(); }
    return new Promise(res => {
      let i = 0;
      codigo.textContent = '';
      const passo = () => {
        codigo.textContent = texto.slice(0, ++i);
        if (i < texto.length) setTimeout(passo, 38 + Math.random() * 40); else res();
      };
      passo();
    });
  }
  function rodarMensagens() {
    let i = 0;
    const prox = async () => {
      if (zerado) return;
      await digitar(CFG.mensagens[i % CFG.mensagens.length]);
      i++;
      setTimeout(prox, 5200);
    };
    prox();
  }

  /* ---------- Abertura: o sistema "aloca" o relógio ---------- */
  function abrir() {
    const visor = $('.relogio__visor');
    const larg = visor.getBoundingClientRect().width;
    relogio.style.setProperty('--abre', (larg / 2 + 24) + 'px');
    // Teste de segmentos (todo display de LED liga tudo ao acender)
    Object.values(grupos).forEach(G => G.digs.forEach(d => mostrar(d, 8.8, false)));
    requestAnimationFrame(() => requestAnimationFrame(() => relogio.classList.add('aberto')));
    const liberar = () => {
      iniciado = true;
      Object.values(grupos).forEach(G => { G.valor = null; G.digs.forEach(d => { d.valor = -1; }); });
      agendar();
      window.dispatchEvent(new CustomEvent('na:tick', { detail: { forte: true } }));
    };
    if (reduzido) { relogio.classList.add('aberto'); liberar(); } else setTimeout(liberar, 950);
    rodarMensagens();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && iniciado) { sincronizar(); agendar(); }
  });

  abrir();
  sincronizar();
})();
