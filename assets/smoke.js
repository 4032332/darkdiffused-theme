/* Dark & Diffused — Smoke System v3
   Flow-field particle simulation.
   1200 particles driven by Perlin noise vectors.
   White/grey smoke (not amber) — correct for the reference images.
   Particles are small soft brushes; density creates the form.
   The flow field curls and turbulences organically.
*/

(function () {
  if (document.getElementById('dd-smoke')) return;

  /* ── Perlin noise (proper implementation) ── */
  const perm = new Uint8Array(512);
  (function buildPerm() {
    const src = new Uint8Array(256);
    for (let i = 0; i < 256; i++) src[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [src[i], src[j]] = [src[j], src[i]];
    }
    for (let i = 0; i < 512; i++) perm[i] = src[i & 255];
  })();

  const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dot2(g, x, y) { return g[0] * x + g[1] * y; }

  function perlin(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x),   yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[xi]   + yi],     ab = perm[perm[xi]   + yi + 1];
    const ba = perm[perm[xi+1] + yi],     bb = perm[perm[xi+1] + yi + 1];
    return lerp(
      lerp(dot2(GRAD[aa & 7], xf,   yf  ), dot2(GRAD[ba & 7], xf-1, yf  ), u),
      lerp(dot2(GRAD[ab & 7], xf,   yf-1), dot2(GRAD[bb & 7], xf-1, yf-1), u),
      v
    );
  }

  /* Two octaves for richer turbulence */
  function noise(x, y) {
    return perlin(x, y) * 0.65 + perlin(x * 2.1, y * 2.1) * 0.35;
  }

  /* ── Canvas ── */
  const canvas = document.createElement('canvas');
  canvas.id = 'dd-smoke';
  canvas.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'pointer-events:none', 'z-index:1', 'opacity:0', 'transition:opacity 2.5s ease',
  ].join(';');
  document.body.appendChild(canvas);
  setTimeout(() => { canvas.style.opacity = '1'; }, 600);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); }, { passive: true });

  /* ── Spawn zones — points along the bar (bottom of screen) ── */
  // 6 loose clusters mimicking glasses / cigar rests on a bar top
  const ZONES = [0.12, 0.24, 0.38, 0.52, 0.66, 0.80, 0.90];

  /* ── Particles ── */
  const N = 1200;
  const px   = new Float32Array(N);
  const py   = new Float32Array(N);
  const page = new Float32Array(N);
  const pmaxAge = new Float32Array(N);
  const pspeed  = new Float32Array(N);
  const pr      = new Float32Array(N);   // birth radius
  const pzone   = new Uint8Array(N);     // which spawn zone

  function reset(i) {
    const z = Math.floor(Math.random() * ZONES.length);
    pzone[i] = z;
    px[i]   = W * (ZONES[z] + (Math.random() - 0.5) * 0.07);
    py[i]   = H * (0.72 + Math.random() * 0.28);
    page[i] = 0;
    pmaxAge[i] = 280 + Math.random() * 380;
    pspeed[i]  = 0.45 + Math.random() * 0.55;
    pr[i]      = 2.5 + Math.random() * 4.5;
  }

  /* Pre-scatter particles across their lifetimes so smoke is present on load */
  for (let i = 0; i < N; i++) {
    reset(i);
    page[i] = Math.random() * pmaxAge[i];
    // Estimate position at that life point (approximate)
    const lifeFrac = page[i] / pmaxAge[i];
    py[i] -= lifeFrac * H * 0.65;
    px[i] += (Math.random() - 0.5) * W * 0.2;
  }

  /* ── Time ── */
  let t = 0;
  let paused = false;

  /* ── Draw one particle ── */
  function drawParticle(x, y, r, alpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    // Smoke colour: near-white with a trace of warm grey — NOT orange
    grad.addColorStop(0,    `rgba(218, 212, 205, ${alpha})`);
    grad.addColorStop(0.45, `rgba(200, 195, 188, ${alpha * 0.55})`);
    grad.addColorStop(1,    `rgba(185, 180, 172, 0)`);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  /* ── Main loop ── */
  function frame() {
    if (paused) { requestAnimationFrame(frame); return; }

    t += 0.00055; // slow time evolution — smoke moves lazily

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < N; i++) {
      const life = page[i] / pmaxAge[i];

      if (life >= 1 || py[i] < -80) {
        reset(i);
        continue;
      }

      /* Sample flow field at this particle's position */
      const fx = px[i] / W * 2.8;
      const fy = py[i] / H * 2.8;

      /* Primary angle from noise */
      const angle = noise(fx, fy + t) * Math.PI * 3.5;

      /* Horizontal drift from noise (independent axis) */
      const driftAngle = noise(fx + 40, fy - t * 0.6) * Math.PI * 2;

      const speed = pspeed[i];
      px[i] += Math.cos(angle) * speed * 0.55
             + Math.cos(driftAngle) * speed * 0.18;

      /* Upward bias — stronger when young, weakens at top (smoke disperses) */
      const upBias = 0.55 + (1 - life) * 0.35;
      py[i] += Math.sin(angle) * speed * 0.25 - speed * upBias;

      page[i]++;

      /* Radius grows as particle rises (smoke expands) */
      const r = pr[i] + life * (life < 0.5 ? 18 : 32);

      /* Alpha: fade in quickly, hold, fade out slowly */
      const alpha = life < 0.12
        ? (life / 0.12) * 0.026
        : life > 0.72
          ? ((1 - life) / 0.28) * 0.026
          : 0.026;

      if (alpha < 0.002) continue;

      drawParticle(px[i], py[i], r, alpha);
    }

    /* Ceiling haze — flat wisps at the top 25% of screen
       These are large very-low-alpha horizontally-stretched ovals */
    ctx.globalCompositeOperation = 'screen';
    const hN = 10;
    for (let h = 0; h < hN; h++) {
      const hx = W * (0.05 + h / hN * 0.92);
      const hy = H * (0.04 + noise(hx / W * 1.5, h + t * 0.3) * 0.18);
      const hr = 140 + noise(h, t * 0.15) * 90;
      const ha = 0.008 + noise(h + 10, t * 0.2) * 0.006;

      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(2.2, 0.4);
      const hgrad = ctx.createRadialGradient(0, 0, 0, 0, 0, hr);
      hgrad.addColorStop(0,   `rgba(210, 205, 198, ${ha})`);
      hgrad.addColorStop(0.6, `rgba(200, 195, 190, ${ha * 0.3})`);
      hgrad.addColorStop(1,   `rgba(195, 190, 185, 0)`);
      ctx.beginPath();
      ctx.arc(0, 0, hr, 0, Math.PI * 2);
      ctx.fillStyle = hgrad;
      ctx.fill();
      ctx.restore();
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  }

  frame();

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
  });

})();
