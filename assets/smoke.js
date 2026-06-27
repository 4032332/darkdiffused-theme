/* Dark & Diffused — Smoke v7 (ribbon stream)
   Mental model from reference images:
   - Smoke is a RIBBON not a blob
   - Thin at the source, widens as it rises
   - Curls and loops via turbulent noise
   - Highly transparent — background always visible

   Architecture:
   - Particle chain: new particles spawn at bottom-left each frame
   - Chain is drawn as a smooth bezier path
   - 4 stroke passes at increasing lineWidth / decreasing alpha
     → creates the tapered ribbon look (thin at tip, wide at body)
   - Trail canvas at 0.3% fade preserves the curling history
   - Two blur composites: crisp + volumetric
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
    return vnoise(x, y) * 0.55 + vnoise(x * 2.3 + 4.1, y * 2.3 + 1.9) * 0.45;
  }

  /* ── Canvases ── */
  const trail  = document.createElement('canvas');
  const tCtx   = trail.getContext('2d');

  const canvas = document.createElement('canvas');
  canvas.id    = 'dd-smoke';
  canvas.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'pointer-events:none', 'z-index:1', 'opacity:0', 'transition:opacity 2.5s ease',
  ].join(';');
  document.body.appendChild(canvas);
  setTimeout(() => { canvas.style.opacity = '1'; }, 800);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  function resize() {
    W = canvas.width = trail.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height= trail.height = canvas.offsetHeight || window.innerHeight;
    // Re-init chains on resize so sources recalculate
    initChains();
  }

  /* ── Smoke streams ── */
  /* Two streams: one primary, one subtle offset wisp */
  const STREAMS = [
    {
      srcXr: 0.07, srcYr: 0.96,   // relative source position (bottom-left)
      spread: 6,
      count: 90,                    // max particles in chain
      emitEvery: 1,                 // new particle every N frames
      biasX: 0.30,                  // rightward drift
      biasY: -1.50,                 // upward drift
      noiseScale: 2.0,
      noiseAmp: 2.4,                // high amp = dramatic curling
      noiseOffset: 0,
    },
    {
      srcXr: 0.04, srcYr: 0.99,
      spread: 4,
      count: 55,
      emitEvery: 2,
      biasX: 0.22,
      biasY: -1.20,
      noiseScale: 2.5,
      noiseAmp: 2.0,
      noiseOffset: 7.3,             // different noise phase = different curl
    },
  ];
  const chains = STREAMS.map(() => []);

  function initChains() {
    for (const c of chains) c.length = 0;
  }

  function emitParticle(s, chain) {
    chain.unshift({
      x:  s.srcXr * W + (Math.random() - 0.5) * s.spread,
      y:  s.srcYr * H + (Math.random() - 0.5) * s.spread,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.3 - Math.random() * 0.3,
      age: 0,
    });
  }

  /* Draw one stream as a multi-pass bezier ribbon.
     Passes start at increasing offsets into the chain so older
     (higher) parts of the ribbon are progressively wider —
     matching how real smoke expands as it rises. */
  function drawRibbon(chain) {
    if (chain.length < 4) return;

    tCtx.lineCap  = 'round';
    tCtx.lineJoin = 'round';

    /* Each pass: {start index into chain, lineWidth, alpha} */
    const passes = [
      { from: 0,  lw: 1.5, a: 0.050 },   // crisp bright core at source
      { from: 0,  lw: 5,   a: 0.022 },   // narrow ribbon body
      { from: 10, lw: 14,  a: 0.011 },   // wider — older smoke
      { from: 22, lw: 28,  a: 0.006 },   // soft halo on aged smoke
      { from: 35, lw: 50,  a: 0.003 },   // very soft volume at top
    ];

    for (const { from, lw, a } of passes) {
      const end = chain.length - 1;
      if (end - from < 3) continue;

      tCtx.beginPath();
      tCtx.moveTo(chain[from].x, chain[from].y);

      for (let i = from + 1; i < end; i++) {
        const mx = (chain[i].x + chain[i + 1].x) * 0.5;
        const my = (chain[i].y + chain[i + 1].y) * 0.5;
        tCtx.quadraticCurveTo(chain[i].x, chain[i].y, mx, my);
      }

      tCtx.strokeStyle = `rgba(220,215,208,${a})`;
      tCtx.lineWidth   = lw;
      tCtx.stroke();
    }
  }

  let t = 0, frame_n = 0, paused = false;

  function frame() {
    if (paused) { requestAnimationFrame(frame); return; }
    t       += 0.00022;
    frame_n++;

    /* Fade trail — very slow so ribbon history is visible */
    tCtx.globalCompositeOperation = 'destination-out';
    tCtx.fillStyle = 'rgba(0,0,0,0.003)';
    tCtx.fillRect(0, 0, W, H);
    tCtx.globalCompositeOperation = 'source-over';

    for (let si = 0; si < STREAMS.length; si++) {
      const s     = STREAMS[si];
      const chain = chains[si];

      /* Emit */
      if (frame_n % s.emitEvery === 0) emitParticle(s, chain);

      /* Update positions */
      for (const p of chain) {
        const nx    = p.x / W * s.noiseScale;
        const ny    = p.y / H * s.noiseScale;
        const angle = noise(nx + s.noiseOffset, ny + t) * Math.PI * s.noiseAmp;

        /* Blend noise-driven angle with directional bias */
        const tx = s.biasX * 0.5 + Math.cos(angle) * 0.6;
        const ty = s.biasY * 0.5 + Math.sin(angle) * 0.3;

        p.vx += (tx - p.vx) * 0.055;
        p.vy += (ty - p.vy) * 0.040;
        p.x  += p.vx;
        p.y  += p.vy;
        p.age++;
      }

      /* Cull: max chain length OR fully off-screen */
      while (chain.length > s.count) chain.pop();
      if (chain.length > 0 && chain[chain.length - 1].y < -120) chain.pop();

      drawRibbon(chain);
    }

    /* Composite to display */
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';

    /* Pass 1: slight blur — preserves crisp ribbon edges */
    ctx.filter      = 'blur(3px)';
    ctx.globalAlpha = 1;
    ctx.drawImage(trail, 0, 0);

    /* Pass 2: heavy blur at low opacity — soft volumetric body */
    ctx.filter      = 'blur(18px)';
    ctx.globalAlpha = 0.18;
    ctx.drawImage(trail, 0, 0);

    ctx.filter      = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  frame();
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
})();
