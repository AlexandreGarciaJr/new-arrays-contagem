/* =========================================================
   new Arrays | Campo de dados (WebGL puro, 1 passe)
   Grade de pontos que o cursor amplia como uma lente e acende
   por onde passa. A cada segundo do relógio sai um pulso do
   centro (evento "na:tick"); toque ou clique solta outro pulso.
   - Sem WebGL ou em GPU por software: fica o gradiente do CSS.
     Para testar nesses ambientes: ?campo=forcar
   - Movimento reduzido: desenha um quadro parado.
   ========================================================= */
(() => {
  'use strict';

  const CFG = {
    passo: 24,          // distância entre pontos (px CSS)
    raioLente: 170,     // alcance da lente do cursor
    forcaLente: 0.34,   // quanto a lente amplia
    rastro: 14,         // pontos do rastro do cursor
    vidaRastro: 0.9,    // segundos
    pulsos: 6,
    velPulso: 560,      // px por segundo
    dprMax: 1.5
  };

  const canvas = document.getElementById('campo');
  const forcar = /[?&]campo=forcar/.test(location.search);
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: forcar });
  if (!gl) return;

  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
  if (!forcar && /swiftshader|llvmpipe|software|softpipe|basic render/i.test(gpu)) return;

  const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const frag = `
precision highp float;
#define NR ${CFG.rastro}
#define NP ${CFG.pulsos}
uniform vec2 uRes; uniform float uD; uniform float uT;
uniform vec3 uM;            // xy cursor (px CSS), z presença 0..1
uniform vec3 uC;            // xy centro do relógio, z raio do anel
uniform vec3 uTr[NR];       // rastro: xy, z intensidade
uniform vec4 uPu[NP];       // pulsos: xy, z início, w força
uniform vec4 uBox;          // retângulo do visor (x0,y0,x1,y1): pontos mais calmos atrás dos dígitos

float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float ruido(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y);
}

void main(){
  vec2 p = gl_FragCoord.xy / uD;
  p.y = uRes.y - p.y;                                   // mesmo sentido do DOM

  // Fundo: preto para o azul petróleo (Manual NA)
  vec2 uv = p / uRes;
  float fr = smoothstep(1.25, 0.0, length((uv - vec2(.5, 1.1)) * vec2(.85, 1.)));
  vec3 cor = mix(vec3(.039), vec3(.027,.22,.25), fr * .8);

  // Lente do cursor
  vec2 dm = p - uM.xy;
  float lente = exp(-dot(dm,dm) / (2. * ${CFG.raioLente.toFixed(1)} * ${CFG.raioLente.toFixed(1)})) * uM.z;
  vec2 pw = uM.xy + dm * (1. - ${CFG.forcaLente.toFixed(2)} * lente);

  float S = ${CFG.passo.toFixed(1)};
  vec2 cel = pw / S;
  vec2 id = floor(cel);
  vec2 cen = (id + .5) * S;                              // centro do ponto (espaço deformado)
  float dist = length(pw - cen) * (1. + ${CFG.forcaLente.toFixed(2)} * lente);

  // Energia do ponto
  float fluxo = ruido(id * .09 + vec2(uT * .04, -uT * .025));
  float e = .08 + smoothstep(.55, 1., fluxo) * .22;
  float cint = step(.992, h21(id + floor(uT * 1.7)));    // pontos que piscam como dados
  e += cint * .5;
  e += lente * .7;

  float rst = 0.;
  for (int i = 0; i < NR; i++) {
    vec2 d = cen - uTr[i].xy;
    rst += exp(-dot(d,d) / 5200.) * uTr[i].z;
  }
  e += min(rst, 1.2) * .7;

  float pul = 0.;
  for (int i = 0; i < NP; i++) {
    float idade = uT - uPu[i].z;
    if (idade < 0. || idade > 3.) continue;
    float r = idade * ${CFG.velPulso.toFixed(1)};
    float dd = length(cen - uPu[i].xy) - r;
    pul += exp(-dd*dd / 1800.) * exp(-idade * 1.4) * uPu[i].w;
  }
  e += pul * .9;

  // Atrás dos dígitos a grade se acalma para não disputar a leitura
  vec2 q = max(uBox.xy - cen, cen - uBox.zw);
  float dentro = 1. - smoothstep(-10., 40., max(q.x, q.y));
  e = mix(e, e * .28, dentro);

  float raio = .9 + lente * 1.5 + min(rst, 1.) * 1.1 + min(pul, 1.) * 1.3;
  float ponto = 1. - smoothstep(raio - .7, raio + .7, dist);

  vec3 cinza = vec3(.46,.55,.57), azul = vec3(.25,.68,.74), claro = vec3(.91,.96,.97);
  vec3 cp = mix(cinza, azul, smoothstep(.12, .6, e));
  cp = mix(cp, claro, smoothstep(.9, 1.4, e));
  cor += cp * ponto * clamp(e, 0., 1.3);

  // Mira do cursor: linhas finas que somem com a distância
  float mira = (exp(-abs(p.y - uM.y) * 1.3) + exp(-abs(p.x - uM.x) * 1.3)) * exp(-length(dm) / 260.) * uM.z;
  cor += azul * mira * .22;

  // Anel tracejado ao redor do relógio (girando devagar)
  vec2 dc = p - uC.xy;
  float ang = atan(dc.y, dc.x) / 6.28318;
  float lr = length(dc);
  float anel = exp(-pow((lr - uC.z) / 1.1, 2.)) * step(.45, fract(ang * 90. + uT * .03));
  float anel2 = exp(-pow((lr - uC.z * 1.12) / .9, 2.)) * step(.8, fract(ang * 36. - uT * .02));
  cor += azul * (anel * .32 + anel2 * .18);

  // Vinheta
  cor *= 1. - smoothstep(.55, 1.25, length((uv - .5) * vec2(1.1, 1.3)));
  gl_FragColor = vec4(cor, 1.);
}`;

  function comp(tipo, src) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = comp(gl.VERTEX_SHADER, vert), fs = comp(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(aP);
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uD = U('uD'), uT = U('uT'), uM = U('uM'), uC = U('uC'), uTr = U('uTr'), uPu = U('uPu'), uBox = U('uBox');

  /* ---------- Estado ---------- */
  let W = 0, H = 0, dpr = 1;
  const centro = { x: 0, y: 0, r: 0 };
  const caixa = [0, 0, 0, 0];
  const alvo = { x: -9999, y: -9999, ativo: false };
  const cur = { x: -9999, y: -9999, z: 0 };
  const rastro = Array.from({ length: CFG.rastro }, () => ({ x: -9999, y: -9999, vida: 0 }));
  let iRastro = 0, ultimoRastro = { x: 0, y: 0 };
  const pulsos = Array.from({ length: CFG.pulsos }, () => ({ x: 0, y: 0, t: -99, f: 0 }));
  let iPulso = 0;
  const trArr = new Float32Array(CFG.rastro * 3);
  const puArr = new Float32Array(CFG.pulsos * 4);
  const t0 = performance.now();
  const tempo = () => (performance.now() - t0) / 1000;

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, CFG.dprMax);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const visor = document.querySelector('.relogio__visor');
    if (visor) {
      const r = visor.getBoundingClientRect();
      centro.x = r.left + r.width / 2; centro.y = r.top + r.height / 2;
      centro.r = Math.max(r.width * 0.56, 140);
      caixa[0] = r.left; caixa[1] = r.top; caixa[2] = r.right; caixa[3] = r.bottom;
    } else { centro.x = W / 2; centro.y = H / 2; centro.r = Math.min(W, H) * .3; }
  }

  function pulso(x, y, f) {
    pulsos[iPulso] = { x, y, t: tempo(), f };
    iPulso = (iPulso + 1) % CFG.pulsos;
  }

  /* ---------- Entrada ---------- */
  addEventListener('pointermove', e => { alvo.x = e.clientX; alvo.y = e.clientY; alvo.ativo = true; }, { passive: true });
  addEventListener('pointerdown', e => { alvo.x = e.clientX; alvo.y = e.clientY; alvo.ativo = true; pulso(e.clientX, e.clientY, 1.1); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { alvo.ativo = false; });
  addEventListener('na:tick', e => pulso(centro.x, centro.y, e.detail && e.detail.forte ? 1 : 0.55));

  /* ---------- Etiqueta HUD que segue o cursor (mouse/caneta) ---------- */
  let etiqueta = null;
  if (!reduzido && matchMedia('(pointer: fine)').matches) {
    etiqueta = document.createElement('div');
    etiqueta.className = 'hud-cursor';
    etiqueta.setAttribute('aria-hidden', 'true');
    document.body.appendChild(etiqueta);
  }

  /* ---------- Quadro ---------- */
  let ultimo = performance.now(), rodando = true;
  function quadro(agoraMs) {
    const dt = Math.min(0.05, (agoraMs - ultimo) / 1000); ultimo = agoraMs;
    const t = tempo();

    // Sem cursor (celular, antes de tocar): a lente passeia devagar
    let tx = alvo.x, ty = alvo.y, tz = alvo.ativo ? 1 : 0;
    if (!alvo.ativo) {
      tx = W * (0.5 + 0.34 * Math.sin(t * 0.21)); ty = H * (0.5 + 0.3 * Math.sin(t * 0.33 + 1.2)); tz = 0.38;
    }
    const k = 1 - Math.pow(0.0008, dt);
    if (cur.x < -9000) { cur.x = tx; cur.y = ty; }
    cur.x += (tx - cur.x) * k; cur.y += (ty - cur.y) * k; cur.z += (tz - cur.z) * (1 - Math.pow(0.02, dt));

    // Rastro: um ponto novo a cada ~14px percorridos
    if (Math.hypot(cur.x - ultimoRastro.x, cur.y - ultimoRastro.y) > 14) {
      rastro[iRastro] = { x: cur.x, y: cur.y, vida: 1 };
      iRastro = (iRastro + 1) % CFG.rastro;
      ultimoRastro = { x: cur.x, y: cur.y };
    }
    rastro.forEach((r, i) => {
      r.vida = Math.max(0, r.vida - dt / CFG.vidaRastro);
      trArr[i * 3] = r.x; trArr[i * 3 + 1] = r.y; trArr[i * 3 + 2] = r.vida * r.vida * cur.z;
    });
    pulsos.forEach((p, i) => { puArr[i * 4] = p.x; puArr[i * 4 + 1] = p.y; puArr[i * 4 + 2] = p.t; puArr[i * 4 + 3] = p.f; });

    gl.uniform2f(uRes, W, H); gl.uniform1f(uD, dpr); gl.uniform1f(uT, t);
    gl.uniform3f(uM, cur.x, cur.y, cur.z);
    gl.uniform3f(uC, centro.x, centro.y, centro.r);
    gl.uniform4f(uBox, caixa[0], caixa[1], caixa[2], caixa[3]);
    gl.uniform3fv(uTr, trArr); gl.uniform4fv(uPu, puArr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (etiqueta && alvo.ativo) {
      etiqueta.style.transform = `translate3d(${cur.x + 18}px, ${cur.y + 18}px, 0)`;
      etiqueta.textContent = `X ${String(Math.round(cur.x)).padStart(4, '0')} · Y ${String(Math.round(cur.y)).padStart(4, '0')}`;
    }
    if (etiqueta) etiqueta.classList.toggle('on', alvo.ativo);

    if (rodando && !reduzido) requestAnimationFrame(quadro);
  }

  medir();
  addEventListener('resize', () => { medir(); if (reduzido) quadro(performance.now()); });
  document.addEventListener('visibilitychange', () => {
    const vis = document.visibilityState === 'visible';
    if (vis && !rodando && !reduzido) { rodando = true; ultimo = performance.now(); requestAnimationFrame(quadro); }
    else if (!vis) rodando = false;
  });
  // O relógio abre com uma transição: remede o centro depois dela
  setTimeout(medir, 1200);
  if (document.fonts) document.fonts.ready.then(medir);

  requestAnimationFrame(quadro);
  canvas.classList.add('ativo');

  // Ganchos de teste
  if (forcar) window.NA_campo = { mover: (x, y) => { alvo.x = x; alvo.y = y; alvo.ativo = true; }, pulso };
})();
