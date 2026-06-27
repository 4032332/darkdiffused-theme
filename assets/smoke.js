/* Dark & Diffused — Smoke v9
   Cigarette / candle smoke from bottom-left corner.

   Approach: particle CHAIN drawn as per-segment strokes.
   - chain[0] = newest particle (at source) → thin, bright
   - chain[N] = oldest particle (dissipating) → wide, faint
   - lineWidth and alpha computed per-segment from position in chain
   - NO trail canvas — each frame is a clean draw of the current chain
   - Pre-fill the chain on boot so smoke is immediately fully formed
   - Noise field creates the organic curling
*/

(function () {
  if (document.getElementById('dd-smoke')) return;

  /* ── Noise ── */
  const R = new Float32Array(512);
  for (let i = 0; i < 512; i++) R[i] = Math.random() * 2 - 1;

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function vnoise(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x),   yf = y - Math.floor(y);
    const u  = fade(xf),             v  = fade(yf);
    const aa = R[(xi     + yi * 57) & 511];
    const ba = R[(xi + 1 + yi * 57) & 511];
    const ab = R[(xi     + (yi + 1) * 57) & 511];
    const bb = R[(xi + 1 + (yi + 1) * 57) & 511];
    return aa + u * (ba - aa) + v * (ab - aa) + u * v * (aa - ba - ab + bb);
  }
  function noise(x, y) {
    return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 4.3, y * 2.1 + 1.7) * 0.45;
  }

  /* ── Canvas setup ── */
  const canvas = document.createElement('canvas');
  canvas.id    = 'dd-smoke';
  canvas.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'pointer-events:none', 'z-index:1',
    'opacity:0', 'transition:opacity 1.5s ease',
    'mix-blend-mode:screen',
  ].join(';');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  /* Offscreen — we draw chain here, then blur-composite to display */
  const off    = document.createElement('canvas');
  const offCtx = off.getContext('2d');

  let W = window.innerWidth, H = window.innerHeight;

  function setSize() {
    W = canvas.width = off.width  = window.innerWidth;
    H = canvas.height= off.height = window.innerHeight;
  }
  setSize();

  /* ── Simulation parameters ── */
  const CHAIN_LEN   = window.innerWidth < 768 ? 300 : 480;
  const NOISE_SCALE = 3.8;   // high → many curls per screen height
  const NOISE_AMP   = 3.1;   // high → tight, dramatic curls
  const BIAS_X      = 0.18;  // gentle rightward drift from left source
  const BIAS_Y      = -1.70; // strong upward
  const T_STEP      = 0.0016;// time evolution speed (how fast curls animate)

  const chain = [];
  let   t     = 0;

  function srcX() { return W * 0.03; }
  function srcY() { return H + 5; }   // just off bottom edge

  function emit() {
    chain.unshift({
      x:  srcX() + (Math.random() - 0.5) * 6,
      y:  srcY() + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.3 - Math.random() * 0.3,
    });
    if (chain.length > CHAIN_LEN) chain.pop();
  }

  function stepSimulation() {
    t += T_STEP;
    for (const p of chain) {
      const nx    = (p.x / W) * NOISE_SCALE;
      const ny    = (p.y / H) * NOISE_SCALE;
      const angle = noise(nx, ny + t) * Math.PI * NOISE_AMP;
      const tx    = BIAS_X * 0.5 + Math.cos(angle) * 0.75;
      const ty    = BIAS_Y * 0.5 + Math.sin(angle) * 0.35;
      p.vx += (tx - p.vx) * 0.055;
      p.vy += (ty - p.vy) * 0.042;
      p.x  += p.vx;
      p.y  += p.vy;
    }
  }

  /* ── Rendering ── */
  function drawSmoke() {
    const N = chain.length;
    if (N < 3) return;

    offCtx.clearRect(0, 0, W, H);
    offCtx.lineCap  = 'round';
    offCtx.lineJoin = 'round';

    for (let i = 0; i < N - 1; i++) {
      /* f = 0 → freshest (source), f = 1 → oldest (dissipating end) */
      const f = i / (N - 1);

      /* Smoke widens as it ages (warm air expanding) */
      const lw = 1.5 + f * f * 38;

      /* Smoke fades with quadratic falloff — bright at source, invisible at tip */
      const alpha = (1 - f) * (1 - f) * 0.21;
      if (alpha < 0.003) continue;

      offCtx.beginPath();
      offCtx.moveTo(chain[i].x,     chain[i].y);
      offCtx.lineTo(chain[i + 1].x, chain[i + 1].y);
      offCtx.strokeStyle = `rgba(228,220,212,${alpha.toFixed(3)})`;
      offCtx.lineWidth   = lw;
      offCtx.stroke();
    }

    /* Composite to display canvas:
       Pass 1 — slight blur to soften segment joints
       Pass 2 — heavy blur for the soft volumetric body behind the crisp core */
    ctx.clearRect(0, 0, W, H);

    ctx.filter      = 'blur(2px)';
    ctx.globalAlpha = 1;
    ctx.drawImage(off, 0, 0);

    ctx.filter      = 'blur(16px)';
    ctx.globalAlpha = 0.24;
    ctx.drawImage(off, 0, 0);

    ctx.filter      = 'none';
    ctx.globalAlpha = 1;
  }

  /* ── Boot: pre-fill chain silently, then reveal ── */
  for (let i = 0; i < CHAIN_LEN; i++) { emit(); stepSimulation(); }

  setTimeout(() => { canvas.style.opacity = '1'; }, 60);

  /* ── Render loop ── */
  let paused = false;

  function loop() {
    if (!paused) { emit(); stepSimulation(); drawSmoke(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    setSize();
    chain.length = 0;
    for (let i = 0; i < CHAIN_LEN; i++) { emit(); stepSimulation(); }
  }, { passive: true });

  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
})();
