/* Dark & Diffused — Smoke System v5
   Key architectural change: TRAIL CANVAS.
   Particles no longer vanish each frame — they fade slowly via
   destination-out. The fading trail IS the smoke stream.
   This makes it look like a continuous fluid, not particles.

   Flow field uses multi-octave Perlin noise + moving VORTICES
   (explicit rotating regions) so the smoke swirls and curls
   unpredictably rather than rising in fixed columns.

   3D depth via Z-coordinate: near smoke larger + brighter,
   far smoke smaller + dimmer. Two blur passes on composite.
*/

(function () {
  if (document.getElementById('dd-smoke')) return;

  /* ── Perlin noise ── */
  const _p = new Uint8Array(512);
  (function () {
    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    for (let i = 0; i < 512; i++) _p[i] = s[i & 255];
  })();
  const G = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  function fade(t) { return t*t*t*(t*(t*6-15)+10); }
  function pdot(g,x,y) { return g[0]*x+g[1]*y; }
  function perlin(x,y) {
    const xi=Math.floor(x)&255, yi=Math.floor(y)&255;
    const xf=x-Math.floor(x),   yf=y-Math.floor(y);
    const u=fade(xf), v=fade(yf);
    const aa=_p[_p[xi]+yi], ab=_p[_p[xi]+yi+1];
    const ba=_p[_p[xi+1]+yi], bb=_p[_p[xi+1]+yi+1];
    return (1-v)*((1-u)*pdot(G[aa&7],xf,yf)+u*pdot(G[ba&7],xf-1,yf))
              +v*((1-u)*pdot(G[ab&7],xf,yf-1)+u*pdot(G[bb&7],xf-1,yf-1));
  }
  /* 3 octaves — rich, organic turbulence */
  function noise(x,y) {
    return perlin(x,y)*0.55 + perlin(x*2.1+0.4,y*2.1+0.7)*0.30 + perlin(x*4.3+1.1,y*4.3+1.8)*0.15;
  }

  /* ── Canvases ── */
  /* Trail canvas: smoke accumulates here and fades slowly.
     The fading trail IS the continuous stream appearance. */
  const trail  = document.createElement('canvas');
  const tCtx   = trail.getContext('2d');

  /* Display canvas: composites the trail with blur */
  const canvas = document.createElement('canvas');
  canvas.id    = 'dd-smoke';
  canvas.style.cssText = [
    'position:fixed','top:0','left:0','width:100%','height:100%',
    'pointer-events:none','z-index:1','opacity:0','transition:opacity 3s ease',
  ].join(';');
  document.body.appendChild(canvas);
  setTimeout(() => { canvas.style.opacity = '1'; }, 800);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  function resize() {
    W = canvas.width = trail.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height= trail.height = canvas.offsetHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); initVortices(); }, { passive: true });

  /* ── Moving vortices ──
     These are explicit rotating regions in the flow field.
     They drift across the screen, creating the unpredictable
     curling and swirling of real smoke. */
  const N_VORTEX = 5;
  const vortices = [];

  function makeVortex() {
    return {
      x:        Math.random() * W,
      y:        H * (0.15 + Math.random() * 0.70),
      vx:       (Math.random()-0.5) * 0.45,
      vy:       (Math.random()-0.5) * 0.22,
      strength: (Math.random()-0.5) * 2.2,   // sign = CW or CCW
      radius:   120 + Math.random() * 220,
      age:      0,
      maxAge:   400 + Math.random() * 600,
    };
  }

  function initVortices() {
    vortices.length = 0;
    for (let i = 0; i < N_VORTEX; i++) {
      const v = makeVortex();
      v.age = Math.random() * v.maxAge; // pre-age so not all born at once
      vortices.push(v);
    }
  }
  initVortices();

  function vortexForce(x, y, out) {
    out[0] = out[1] = 0;
    for (let k = 0; k < vortices.length; k++) {
      const v  = vortices[k];
      const dx = x - v.x, dy = y - v.y;
      const d2 = dx*dx + dy*dy;
      const r  = v.radius;
      if (d2 < r*r && d2 > 1) {
        const d      = Math.sqrt(d2);
        const factor = v.strength * (1 - d/r) * 0.9;
        out[0] += (-dy/d) * factor;
        out[1] += ( dx/d) * factor;
      }
    }
  }

  /* ── Particles ── */
  const N   = 900;
  const px  = new Float32Array(N);
  const py  = new Float32Array(N);
  const pz  = new Float32Array(N);   // -280 to +280
  const pvx = new Float32Array(N);
  const pvy = new Float32Array(N);
  const pa  = new Float32Array(N);   // age
  const pma = new Float32Array(N);   // maxAge
  const psp = new Float32Array(N);   // speed
  const prr = new Float32Array(N);   // birth radius

  function resetP(i) {
    /* Spawn randomly across the bottom — no fixed columns.
       Clustering shifts over time because vortices drag new
       particles toward where old ones were, organically. */
    px[i]  = W * (0.04 + Math.random() * 0.92);
    py[i]  = H * (0.74 + Math.random() * 0.26);
    pz[i]  = (Math.random()-0.5) * 520;
    pvx[i] = (Math.random()-0.5) * 0.5;
    pvy[i] = -(0.15 + Math.random() * 0.35);
    pa[i]  = 0;
    pma[i] = 380 + Math.random() * 420;
    psp[i] = 0.38 + Math.random() * 0.72;
    prr[i] = 1.8  + Math.random() * 3.2;
  }

  /* Pre-scatter particles across lifetimes so smoke is present on load */
  for (let i = 0; i < N; i++) {
    resetP(i);
    pa[i]  = Math.random() * pma[i];
    py[i] -= (pa[i]/pma[i]) * H * 0.68;
    px[i] += (Math.random()-0.5) * 180;
  }

  const FOV  = 540;
  const _vf  = new Float32Array(2);  // reuse for vortex force output
  let t = 0, paused = false;

  /* ── Main loop ── */
  function frame() {
    if (paused) { requestAnimationFrame(frame); return; }
    t += 0.00048;

    /* ── 1. Update & drift vortices ── */
    for (let k = 0; k < vortices.length; k++) {
      const v = vortices[k];
      v.x  += v.vx;
      v.y  += v.vy;
      v.age++;
      // Soft boundary bounce
      if (v.x < -v.radius*0.5 || v.x > W+v.radius*0.5) v.vx *= -1;
      if (v.y < H*0.05  || v.y > H*0.88) v.vy *= -1;
      // Gradual strength fade and respawn
      if (v.age > v.maxAge) { vortices[k] = makeVortex(); }
    }

    /* ── 2. Fade the trail canvas ──
       destination-out reduces existing alpha without adding colour.
       On a transparent canvas this correctly fades smoke rather
       than adding black. Rate = how quickly smoke dissipates. */
    tCtx.globalCompositeOperation = 'destination-out';
    tCtx.fillStyle = 'rgba(0,0,0,0.022)'; // ~2.2% fade per frame → trails last ~2s
    tCtx.fillRect(0, 0, W, H);
    tCtx.globalCompositeOperation = 'source-over';

    /* ── 3. Draw particles to trail canvas ── */
    for (let i = 0; i < N; i++) {
      const life = pa[i] / pma[i];
      if (life >= 1 || py[i] < -120) { resetP(i); continue; }

      /* Sample flow field at 3D position.
         We use X and Z to form the 2D noise coordinate,
         so particles at different depths sample different
         parts of the field → genuine 3D turbulence. */
      const fx = px[i]/W * 3.0;
      const fy = py[i]/H * 3.0;
      const fz = pz[i]/280 * 0.7;

      const angle = noise(fx + fz, fy + t) * Math.PI * 4.2;

      /* Vortex contribution */
      vortexForce(px[i], py[i], _vf);

      const spd = psp[i];
      /* Upward bias reduces as smoke rises (it disperses, loses buoyancy) */
      const upBias = spd * (0.30 + (1-life) * 0.35);

      /* Inertial update — smoke has momentum, doesn't snap to field */
      pvx[i] += (Math.cos(angle)*spd*0.55 + _vf[0] - pvx[i]) * 0.09;
      pvy[i] += (-upBias + Math.sin(angle)*spd*0.18 + _vf[1] - pvy[i]) * 0.06;

      px[i] += pvx[i];
      py[i] += pvy[i];
      /* Z drifts via a separate noise axis — the 3D swirl */
      pz[i] += noise(fx + 12, fz + t*0.6) * 0.45;
      pa[i]++;

      /* Perspective projection */
      const scale = Math.max(0.15, FOV / (FOV + pz[i]));

      /* Particle grows as it rises — smoke expands as it cools */
      const r = (prr[i] + life * 10) * scale;
      /* Alpha bell-curve, damped by Z-depth */
      const alpha = Math.sin(life * Math.PI) * 0.11 * Math.min(1.3, scale * 1.35);

      if (alpha < 0.004 || r < 0.5) continue;

      const lum = Math.round(195 + scale * 48);
      const grad = tCtx.createRadialGradient(px[i], py[i], 0, px[i], py[i], r);
      grad.addColorStop(0,    `rgba(${lum},${lum-2},${lum-6},${alpha})`);
      grad.addColorStop(0.50, `rgba(${lum-12},${lum-14},${lum-18},${alpha*0.50})`);
      grad.addColorStop(0.80, `rgba(${lum-25},${lum-27},${lum-31},${alpha*0.18})`);
      grad.addColorStop(1,    `rgba(${lum-35},${lum-37},${lum-41},0)`);
      tCtx.beginPath();
      tCtx.arc(px[i], py[i], r, 0, Math.PI * 2);
      tCtx.fillStyle = grad;
      tCtx.fill();
    }

    /* ── 4. Composite trail → display with two blur passes ──
       Pass 1: tight blur (3-4px) — preserves wisp definition
       Pass 2: wide blur (14px) @ low opacity — the volumetric body
       Together they create smoke that has both clear tendrils
       AND a soft glowing mass behind them. */
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';

    ctx.filter  = 'blur(3.5px)';
    ctx.globalAlpha = 1;
    ctx.drawImage(trail, 0, 0);

    ctx.filter  = 'blur(14px)';
    ctx.globalAlpha = 0.28;
    ctx.drawImage(trail, 0, 0);

    ctx.filter  = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(frame);
  }

  frame();
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
})();
