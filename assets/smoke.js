/* Dark & Diffused — Smoke v8
   Source: bottom-right corner (cigarette off-screen)
   Continuous ribbon, pre-simulated so it appears immediately full.
   Particles emit every frame, old ones dissolve — gives the illusion
   of an infinite continuous stream.
*/

(function () {
  if (document.getElementById('dd-smoke')) return;

  /* ── Value noise ── */
  const R = new Float32Array(512);
  for (let i = 0; i < 512; i++) R[i] = Math.random() * 2 - 1;
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function vnoise(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = R[(xi     + yi * 57) & 511];
    const ba = R[(xi + 1 + yi * 57) & 511];
    const ab = R[(xi     + (yi + 1) * 57) & 511];
    const bb = R[(xi + 1 + (yi + 1) * 57) & 511];
    return aa + u*(ba-aa) + v*(ab-aa) + u*v*(aa-ba-ab+bb);
  }
  function noise(x, y) {
    return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 3.7, y * 2.1 + 1.9) * 0.45;
  }

  /* ── Canvases ── */
  const trail  = document.createElement('canvas');
  const tCtx   = trail.getContext('2d');
  const canvas = document.createElement('canvas');
  canvas.id    = 'dd-smoke';
  canvas.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'pointer-events:none', 'z-index:1', 'opacity:0', 'transition:opacity 1.5s ease',
  ].join(';');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;

  function setSize() {
    W = canvas.width = trail.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height= trail.height = canvas.offsetHeight || window.innerHeight;
  }

  /* ── Two smoke streams from bottom-right ── */
  /* Main stream + secondary wisp with a different noise offset */
  const STREAMS = [
    {
      /* source: just off bottom-right */
      sx() { return W * 0.97; },
      sy() { return H * 1.01; },
      spread: 8,
      count: 180,           // long chain = spans most of screen height
      emitEvery: 1,
      biasX: -0.50,         // drift left
      biasY: -2.20,         // strong upward
      noiseScale: 1.8,
      noiseAmp: 2.6,        // high = dramatic swirling curls
      noiseOX: 0,
      noiseOY: 0,
    },
    {
      sx() { return W * 0.93; },
      sy() { return H * 1.03; },
      spread: 5,
      count: 110,
      emitEvery: 2,
      biasX: -0.40,
      biasY: -1.90,
      noiseScale: 2.2,
      noiseAmp: 2.2,
      noiseOX: 5.3,
      noiseOY: 3.1,
    },
  ];

  /* Particle chains */
  const chains = STREAMS.map(() => []);

  function emit(s, chain) {
    chain.unshift({
      x:  s.sx() + (Math.random() - 0.5) * s.spread,
      y:  s.sy() + (Math.random() - 0.5) * s.spread,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.5 - Math.random() * 0.4,
    });
  }

  /* Update all particles in a chain using noise flow field */
  function updateChain(s, chain, t) {
    for (const p of chain) {
      const nx    = (p.x / W) * s.noiseScale + s.noiseOX;
      const ny    = (p.y / H) * s.noiseScale + s.noiseOY;
      const angle = noise(nx, ny + t) * Math.PI * s.noiseAmp;
      const tx    = s.biasX * 0.5 + Math.cos(angle) * 0.7;
      const ty    = s.biasY * 0.5 + Math.sin(angle) * 0.35;
      p.vx += (tx - p.vx) * 0.055;
      p.vy += (ty - p.vy) * 0.042;
      p.x  += p.vx;
      p.y  += p.vy;
    }
    /* Cull old particles */
    while (chain.length > s.count) chain.pop();
    if (chain.length > 0) {
      const tail = chain[chain.length - 1];
      if (tail.y < -100 || tail.x < -100 || tail.x > W + 100) chain.pop();
    }
  }

  /* Draw ribbon as smooth bezier with multi-pass varying width */
  function drawRibbon(chain) {
    const n = chain.length;
    if (n < 4) return;

    tCtx.lineCap  = 'round';
    tCtx.lineJoin = 'round';

    /*
      Passes start at increasing indices into the chain.
      chain[0] = newest (at source) → narrow, bright
      chain[N] = oldest (upper area) → wide, soft

      By starting each wider pass deeper into the chain,
      only the older/higher smoke gets the wide soft halo —
      exactly like real smoke expanding as it rises.
    */
    const passes = [
      { from: 0,   lw: 1.5, a: 0.055 },
      { from: 0,   lw: 5,   a: 0.024 },
      { from: 12,  lw: 14,  a: 0.012 },
      { from: 28,  lw: 28,  a: 0.007 },
      { from: 48,  lw: 50,  a: 0.003 },
    ];

    for (const { from, lw, a } of passes) {
      if (n - from < 4) continue;
      tCtx.beginPath();
      tCtx.moveTo(chain[from].x, chain[from].y);
      for (let i = from + 1; i < n - 1; i++) {
        const mx = (chain[i].x + chain[i + 1].x) * 0.5;
        const my = (chain[i].y + chain[i + 1].y) * 0.5;
        tCtx.quadraticCurveTo(chain[i].x, chain[i].y, mx, my);
      }
      tCtx.strokeStyle = `rgba(220,215,208,${a})`;
      tCtx.lineWidth   = lw;
      tCtx.stroke();
    }
  }

  /* One simulation step: update chains + paint to trail canvas */
  let t = 0, frame_n = 0;

  function step() {
    t       += 0.00022;
    frame_n++;

    tCtx.globalCompositeOperation = 'destination-out';
    tCtx.fillStyle = 'rgba(0,0,0,0.003)';
    tCtx.fillRect(0, 0, W, H);
    tCtx.globalCompositeOperation = 'source-over';

    for (let si = 0; si < STREAMS.length; si++) {
      const s     = STREAMS[si];
      const chain = chains[si];
      if (frame_n % s.emitEvery === 0) emit(s, chain);
      updateChain(s, chain, t);
      drawRibbon(chain);
    }
  }

  /* Composite trail → display canvas */
  function composite() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    ctx.filter      = 'blur(3px)';
    ctx.globalAlpha = 1;
    ctx.drawImage(trail, 0, 0);
    ctx.filter      = 'blur(18px)';
    ctx.globalAlpha = 0.20;
    ctx.drawImage(trail, 0, 0);
    ctx.filter      = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── Boot: pre-simulate then reveal ── */
  setSize();

  /* Pre-simulate 500 frames so the ribbon is fully formed on first paint */
  for (let i = 0; i < 500; i++) step();
  composite();

  /* Now reveal the canvas */
  setTimeout(() => { canvas.style.opacity = '1'; }, 50);

  let paused = false;

  function renderLoop() {
    if (!paused) {
      step();
      composite();
    }
    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);

  window.addEventListener('resize', () => {
    setSize();
    /* Re-init chains after resize — sources recalculate to new W/H */
    for (const c of chains) c.length = 0;
    for (let i = 0; i < 500; i++) step();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
})();
