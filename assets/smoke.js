/* Dark & Diffused — Smoke System v4
   Architecture:
   - Particles have true X/Y/Z coordinates (3D space)
   - Each particle draws a SHORT LINE STROKE in its direction of travel
     → strokes create tendrils, not bubbles
   - 2800 particles rendered to an offscreen canvas, then composited
     with a 3–4px blur pass → blur merges adjacent strokes into
     connected cloud forms without losing the wispy definition
   - Z perspective projection: near particles larger/brighter,
     far particles smaller/dimmer → genuine visual depth
   - Two particle types: wisp strokes (tendrils) + cloud puffs (volume)
   - Perlin noise flow field with two independent axes of turbulence
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
  function dot(g, x, y) { return g[0]*x + g[1]*y; }

  function perlin(x, y) {
    const xi = Math.floor(x)&255, yi = Math.floor(y)&255;
    const xf = x-Math.floor(x),   yf = y-Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = _p[_p[xi]+yi], ab = _p[_p[xi]+yi+1];
    const ba = _p[_p[xi+1]+yi], bb = _p[_p[xi+1]+yi+1];
    return (
      (1-v)*((1-u)*dot(G[aa&7],xf,yf)   + u*dot(G[ba&7],xf-1,yf))
      +  v *((1-u)*dot(G[ab&7],xf,yf-1) + u*dot(G[bb&7],xf-1,yf-1))
    );
  }

  /* Two octaves for richer turbulence */
  function noise(x, y) {
    return perlin(x, y)*0.6 + perlin(x*2.2+0.3, y*2.2+0.7)*0.4;
  }

  /* ── Canvases ── */
  // Offscreen: receives raw particle draws (no filters here)
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');

  // Visible: composites offscreen with blur to merge strokes
  const canvas = document.createElement('canvas');
  canvas.id = 'dd-smoke';
  canvas.style.cssText = [
    'position:fixed','top:0','left:0','width:100%','height:100%',
    'pointer-events:none','z-index:1','opacity:0','transition:opacity 2.5s ease',
  ].join(';');
  document.body.appendChild(canvas);
  setTimeout(() => { canvas.style.opacity = '1'; }, 700);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    W = canvas.width  = off.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height = off.height = canvas.offsetHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Spawn zones along bar surface ── */
  const ZONES = [0.10, 0.22, 0.36, 0.50, 0.63, 0.76, 0.88];

  /* ── Typed arrays for performance ── */
  const N_WISP = 2200;  // stroke particles — the tendrils
  const N_PUFF =  160;  // large soft puffs — the cloud volume

  // Wisps
  const wx  = new Float32Array(N_WISP);
  const wy  = new Float32Array(N_WISP);
  const wz  = new Float32Array(N_WISP);  // -250 to +250
  const wvx = new Float32Array(N_WISP);
  const wvy = new Float32Array(N_WISP);
  const wvz = new Float32Array(N_WISP);
  const wage    = new Float32Array(N_WISP);
  const wmaxAge = new Float32Array(N_WISP);
  const wspd    = new Float32Array(N_WISP);
  const wzone   = new Uint8Array(N_WISP);

  function resetWisp(i) {
    const z = Math.floor(Math.random() * ZONES.length);
    wzone[i] = z;
    wx[i]  = W * ZONES[z] + (Math.random()-0.5)*70;
    wy[i]  = H * (0.72 + Math.random()*0.28);
    wz[i]  = (Math.random()-0.5)*460;
    wvx[i] = (Math.random()-0.5)*0.4;
    wvy[i] = -(0.3 + Math.random()*0.3);
    wvz[i] = (Math.random()-0.5)*0.25;
    wage[i] = 0;
    wmaxAge[i] = 300 + Math.random()*320;
    wspd[i]    = 0.5 + Math.random()*0.6;
  }

  for (let i = 0; i < N_WISP; i++) {
    resetWisp(i);
    // Pre-scatter so smoke is present on load
    wage[i] = Math.random() * wmaxAge[i];
    wy[i]  -= (wage[i] / wmaxAge[i]) * H * 0.65;
    wx[i]  += (Math.random()-0.5)*100;
    wz[i]  += (Math.random()-0.5)*100;
  }

  // Puffs
  const pfx     = new Float32Array(N_PUFF);
  const pfy     = new Float32Array(N_PUFF);
  const pfz     = new Float32Array(N_PUFF);
  const pfvx    = new Float32Array(N_PUFF);
  const pfvy    = new Float32Array(N_PUFF);
  const pfage   = new Float32Array(N_PUFF);
  const pfmaxAge= new Float32Array(N_PUFF);
  const pfr     = new Float32Array(N_PUFF);  // radius

  function resetPuff(i) {
    const z = Math.floor(Math.random() * ZONES.length);
    pfx[i]  = W * ZONES[z] + (Math.random()-0.5)*90;
    pfy[i]  = H * (0.60 + Math.random()*0.40);
    pfz[i]  = (Math.random()-0.5)*340;
    pfvx[i] = (Math.random()-0.5)*0.3;
    pfvy[i] = -(0.15 + Math.random()*0.2);
    pfage[i] = 0;
    pfmaxAge[i] = 400 + Math.random()*400;
    pfr[i]  = 28 + Math.random()*36;
  }

  for (let i = 0; i < N_PUFF; i++) {
    resetPuff(i);
    pfage[i] = Math.random() * pfmaxAge[i];
    pfy[i]  -= (pfage[i]/pfmaxAge[i]) * H * 0.5;
  }

  /* ── Main loop ── */
  const FOV = 520;
  let t = 0, paused = false;

  function frame() {
    if (paused) { requestAnimationFrame(frame); return; }
    t += 0.00052;

    offCtx.clearRect(0, 0, W, H);

    /* ── Draw wisp strokes ── */
    for (let i = 0; i < N_WISP; i++) {
      const life = wage[i] / wmaxAge[i];
      if (life >= 1 || wy[i] < -80) { resetWisp(i); continue; }

      // Sample flow field (3D position → 2D noise coordinates)
      const fx = wx[i]/W * 3.2;
      const fy = wy[i]/H * 3.2;
      const fz = wz[i]/250 * 0.6;

      const angle  = noise(fx,        fy + fz + t) * Math.PI * 4.0;
      const angle2 = noise(fx + 8.0,  fz - t*0.7)  * Math.PI * 2.5;

      const spd = wspd[i];

      // Inertial velocity update (smoke has momentum)
      wvx[i] += (Math.cos(angle)*spd*0.55 + Math.cos(angle2)*spd*0.18 - wvx[i]) * 0.09;
      wvy[i] += (-(spd*(0.38+(1-life)*0.28)) + Math.sin(angle)*spd*0.18 - wvy[i]) * 0.06;
      wvz[i] += (Math.sin(angle2)*spd*0.28 - wvz[i]) * 0.05;

      wx[i] += wvx[i];
      wy[i] += wvy[i];
      wz[i] += wvz[i];
      wage[i]++;

      // Perspective scale from Z
      const scale = Math.max(0.25, FOV / (FOV + wz[i]));

      // Alpha: bell curve over lifetime, modulated by Z depth
      const alpha = Math.sin(life * Math.PI) * 0.048 * Math.min(1, scale*1.2);
      if (alpha < 0.003) continue;

      // Stroke length and width grow as particle rises and expands
      const strokeLen = (3 + life*9) * scale;
      const strokeW   = Math.max(0.4, (0.8 + life*2.2) * scale);

      // Direction of stroke = direction of velocity
      const ang = Math.atan2(wvy[i], wvx[i]);
      const x1 = wx[i] - Math.cos(ang)*strokeLen;
      const y1 = wy[i] - Math.sin(ang)*strokeLen;
      const x2 = wx[i] + Math.cos(ang)*strokeLen;
      const y2 = wy[i] + Math.sin(ang)*strokeLen;

      // Colour: warm white, dimmer for distant particles
      const lum = Math.round(195 + scale*45);
      offCtx.beginPath();
      offCtx.moveTo(x1, y1);
      offCtx.lineTo(x2, y2);
      offCtx.lineWidth = strokeW;
      offCtx.lineCap   = 'round';
      offCtx.strokeStyle = `rgba(${lum},${lum-4},${lum-9},${alpha})`;
      offCtx.stroke();
    }

    /* ── Draw cloud puffs ── */
    for (let i = 0; i < N_PUFF; i++) {
      const life = pfage[i] / pfmaxAge[i];
      if (life >= 1 || pfy[i] < -120) { resetPuff(i); continue; }

      const scale = Math.max(0.2, FOV / (FOV + pfz[i]));

      // Puffs drift with gentle noise
      const fx = pfx[i]/W * 2.0;
      const fy = pfy[i]/H * 2.0;
      pfvx[i] += (noise(fx, fy + t*0.6)*0.25 - pfvx[i])*0.04;
      pfvy[i] += (-0.14 - pfvy[i])*0.03;

      pfx[i] += pfvx[i];
      pfy[i] += pfvy[i];
      pfage[i]++;

      const r = (pfr[i] + life*pfr[i]*1.8) * scale;
      const alpha = Math.sin(life*Math.PI) * 0.018 * Math.min(1, scale*1.1);
      if (alpha < 0.002 || r < 1) continue;

      const lum = Math.round(185 + scale*35);
      const grad = offCtx.createRadialGradient(pfx[i], pfy[i], 0, pfx[i], pfy[i], r);
      grad.addColorStop(0,   `rgba(${lum},${lum-3},${lum-7},${alpha})`);
      grad.addColorStop(0.55,`rgba(${lum-10},${lum-13},${lum-17},${alpha*0.45})`);
      grad.addColorStop(1,   `rgba(${lum-20},${lum-23},${lum-27},0)`);
      offCtx.beginPath();
      offCtx.arc(pfx[i], pfy[i], r, 0, Math.PI*2);
      offCtx.fillStyle = grad;
      offCtx.fill();
    }

    /* ── Composite offscreen → visible with blur
         The blur merges adjacent strokes into connected wisps —
         close strokes become tendrils, not isolated dots.
         'screen' blend mode: correct for light on dark background ── */
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';

    // Pass 1: tight blur — preserves tendril definition
    ctx.filter = 'blur(3px)';
    ctx.drawImage(off, 0, 0);

    // Pass 2: wider blur at lower opacity — adds the volumetric haze
    ctx.filter = 'blur(10px)';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(off, 0, 0);
    ctx.globalAlpha = 1;

    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(frame);
  }

  frame();

  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
})();
