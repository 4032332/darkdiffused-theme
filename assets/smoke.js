/* Dark & Diffused — Smoke v10
   Multi-strand turbulent smoke system.

   Architecture:
   - 8 independent particle chains from the same source point
   - Each chain has a unique noise offset → they diverge into distinct
     branching strands that cross, separate and recombine
   - 4 alpha/width zones per chain drawn as batched bezier paths
     (efficient: 32 stroke calls total per frame)
   - Offscreen canvas → two-pass blur composite for crisp core + soft halo
   - Chains pre-filled at boot → smoke fully formed on first paint
   - mix-blend-mode:screen on canvas element
*/

(function () {
  if (document.getElementById('dd-smoke')) return;

  /* ── 3-octave value noise ── */
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
    /* 3 octaves: base curl + medium detail + fine wisps */
    return vnoise(x, y)               * 0.50
         + vnoise(x * 2.3 + 4.1, y * 2.3 + 1.7) * 0.32
         + vnoise(x * 5.1 + 8.3, y * 5.1 + 3.9) * 0.18;
  }

  /* ── Canvas ── */
  const canvas = document.createElement('canvas');
  canvas.id    = 'dd-smoke';
  canvas.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'pointer-events:none', 'z-index:1',
    'opacity:0', 'transition:opacity 1.2s ease',
    'mix-blend-mode:screen',
  ].join(';');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const off    = document.createElement('canvas');
  const offCtx = off.getContext('2d');

  let W = window.innerWidth, H = window.innerHeight;
  function setSize() {
    W = canvas.width = off.width  = window.innerWidth;
    H = canvas.height= off.height = window.innerHeight;
  }
  setSize();

  /* ── 8 strands — unique noise phases + slightly different drift ── */
  const STRAND_DEFS = [
    { ox: 0.0,  oy: 0.0,  bx:  0.10, by: -1.90 },
    { ox: 3.7,  oy: 2.1,  bx:  0.30, by: -2.10 },
    { ox: 7.3,  oy: 5.4,  bx: -0.05, by: -1.70 },
    { ox: 11.2, oy: 8.9,  bx:  0.45, by: -2.00 },
    { ox: 1.8,  oy: 12.3, bx:  0.05, by: -2.20 },
    { ox: 9.1,  oy: 3.6,  bx:  0.25, by: -1.60 },
    { ox: 14.5, oy: 7.2,  bx: -0.15, by: -1.80 },
    { ox: 5.9,  oy: 15.8, bx:  0.55, by: -2.05 },
  ];

  const CHAIN_LEN   = 320;
  const NOISE_SCALE = 3.6;   /* spatial frequency: controls curl density */
  const NOISE_AMP   = 3.2;   /* angular range: controls curl tightness   */
  const T_STEP      = 0.0018;/* time evolution: how fast curls animate   */

  /* Each strand is an array of particles */
  const strands = STRAND_DEFS.map(d => ({ def: d, chain: [] }));
  let t = 0;

  function srcX() { return W * 0.04 + (Math.random() - 0.5) * 12; }
  function srcY() { return H + 8; }

  function emit(strand) {
    strand.chain.unshift({
      x:  srcX(),
      y:  srcY(),
      vx: (Math.random() - 0.5) * 0.5 + strand.def.bx * 0.2,
      vy: -0.4 - Math.random() * 0.3,
    });
    if (strand.chain.length > CHAIN_LEN) strand.chain.pop();
  }

  function stepStrand(strand) {
    const d = strand.def;
    for (const p of strand.chain) {
      const nx    = (p.x / W) * NOISE_SCALE + d.ox;
      const ny    = (p.y / H) * NOISE_SCALE + d.oy;
      const angle = noise(nx, ny + t) * Math.PI * NOISE_AMP;
      const tx    = d.bx * 0.5 + Math.cos(angle) * 0.80;
      const ty    = d.by * 0.5 + Math.sin(angle) * 0.38;
      p.vx += (tx - p.vx) * 0.058;
      p.vy += (ty - p.vy) * 0.044;
      p.x  += p.vx;
      p.y  += p.vy;
    }
  }

  /* Draw one strand in 4 progressive zones.
     Each zone covers a range of chain indices and uses a fixed
     lineWidth/alpha. The alpha drops and lineWidth grows from
     source → tip, creating the natural taper.
     Drawing each zone as ONE bezier path = 4 draw calls per strand. */
  const ZONES = [
    { from: 0,   to: 60,  lw: 1.5, a: 0.090 },  /* bright crisp core */
    { from: 50,  to: 140, lw: 3.5, a: 0.045 },  /* inner ribbon      */
    { from: 120, to: 220, lw: 9,   a: 0.020 },  /* widening body     */
    { from: 200, to: 320, lw: 22,  a: 0.008 },  /* dissolving haze   */
  ];

  function drawStrand(chain) {
    const N = chain.length;
    if (N < 5) return;

    offCtx.lineCap  = 'round';
    offCtx.lineJoin = 'round';

    for (const z of ZONES) {
      const start = z.from;
      const end   = Math.min(z.to, N - 1);
      if (end - start < 3) continue;

      offCtx.beginPath();
      offCtx.moveTo(chain[start].x, chain[start].y);
      for (let i = start + 1; i < end - 1; i++) {
        const mx = (chain[i].x + chain[i + 1].x) * 0.5;
        const my = (chain[i].y + chain[i + 1].y) * 0.5;
        offCtx.quadraticCurveTo(chain[i].x, chain[i].y, mx, my);
      }
      offCtx.strokeStyle = `rgba(228,220,212,${z.a})`;
      offCtx.lineWidth   = z.lw;
      offCtx.stroke();
    }
  }

  function render() {
    offCtx.clearRect(0, 0, W, H);
    for (const s of strands) drawStrand(s.chain);

    ctx.clearRect(0, 0, W, H);

    /* Crisp definition pass */
    ctx.filter      = 'blur(2px)';
    ctx.globalAlpha = 1;
    ctx.drawImage(off, 0, 0);

    /* Soft volumetric halo pass */
    ctx.filter      = 'blur(18px)';
    ctx.globalAlpha = 0.28;
    ctx.drawImage(off, 0, 0);

    ctx.filter      = 'none';
    ctx.globalAlpha = 1;
  }

  function stepAll() {
    t += T_STEP;
    for (const s of strands) { emit(s); stepStrand(s); }
  }

  /* ── Boot: pre-fill all chains silently ── */
  for (let i = 0; i < CHAIN_LEN; i++) stepAll();

  setTimeout(() => { canvas.style.opacity = '1'; }, 60);

  /* ── Loop ── */
  let paused = false;
  function loop() {
    if (!paused) { stepAll(); render(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    setSize();
    for (const s of strands) s.chain.length = 0;
    for (let i = 0; i < CHAIN_LEN; i++) stepAll();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
})();
