/* Dark & Diffused — Smoke / Ambient Haze v6
   Correct mental model: smoke in a bar doesn't rush — it HANGS.
   It drifts at 1-2cm per second. It fills the room slowly.

   Architecture:
   - Large soft blobs (60-160px radius), moving very slowly
   - Trail canvas fades at 0.4%/frame → trails last ~8 seconds
   - At 60fps a particle moves ~0.08px/frame × 480 frames = ~40px
     before it fades. That creates a diffuse cloud, not a tadpole.
   - 3 very weak vortices add organic curl without spiralling
   - Two blur passes: 8px (definition) + 28px @ 20% (volume depth)
   - Canvas capped at 70% opacity — atmospheric, not overwhelming
*/

(function () {
  if (document.getElementById('dd-smoke')) return;

  /* ── Smooth noise (value noise, fast) ── */
  const R = new Float32Array(512);
  for (let i = 0; i < 512; i++) R[i] = Math.random() * 2 - 1;
  function fade(t) { return t*t*t*(t*(t*6-15)+10); }
  function vnoise(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x-Math.floor(x), yf = y-Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const a  = R[(xi + yi*57) & 511];
    const b  = R[(xi+1 + yi*57) & 511];
    const c  = R[(xi + (yi+1)*57) & 511];
    const d  = R[(xi+1 + (yi+1)*57) & 511];
    return a + u*(b-a) + v*(c-a) + u*v*(a-b-c+d);
  }
  function noise(x, y) {
    return vnoise(x,y)*0.60 + vnoise(x*1.9+3.1, y*1.9+1.7)*0.40;
  }

  /* ── Canvases ── */
  const trail = document.createElement('canvas');
  const tCtx  = trail.getContext('2d');

  const canvas = document.createElement('canvas');
  canvas.id    = 'dd-smoke';
  canvas.style.cssText = [
    'position:fixed','top:0','left:0','width:100%','height:100%',
    'pointer-events:none','z-index:1','opacity:0','transition:opacity 3s ease',
  ].join(';');
  document.body.appendChild(canvas);
  setTimeout(() => { canvas.style.opacity = '0.45'; }, 1000);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  function resize() {
    W = canvas.width = trail.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height= trail.height = canvas.offsetHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Very gentle vortices — just enough to curl, not spiral ── */
  const vortices = Array.from({ length: 3 }, () => ({
    x:        Math.random() * (window.innerWidth  || 1200),
    y:        (window.innerHeight || 800) * (0.2 + Math.random() * 0.6),
    vx:       (Math.random()-0.5) * 0.18,
    vy:       (Math.random()-0.5) * 0.08,
    strength: (Math.random()-0.5) * 0.18,   // MUCH weaker than before
    radius:   180 + Math.random() * 220,
  }));

  /* ── Smoke blobs ── */
  const N   = 90;
  const bx  = new Float32Array(N);
  const by  = new Float32Array(N);
  const bvx = new Float32Array(N);
  const bvy = new Float32Array(N);
  const ba  = new Float32Array(N);   // age
  const bma = new Float32Array(N);   // maxAge
  const br  = new Float32Array(N);   // birth radius
  const bsp = new Float32Array(N);   // speed

  function resetBlob(i) {
    bx[i]  = W  * (0.02 + Math.random() * 0.96);
    by[i]  = H  * (0.55 + Math.random() * 0.45);   // bottom half spawn
    bvx[i] = (Math.random()-0.5) * 0.12;
    bvy[i] = -(0.04 + Math.random() * 0.09);        // very slow upward drift
    ba[i]  = 0;
    bma[i] = 500 + Math.random() * 600;             // long life
    br[i]  = 30  + Math.random() * 55;              // thinner wisps
    bsp[i] = 0.04 + Math.random() * 0.10;           // very slow
  }

  /* Pre-scatter so haze is present immediately */
  for (let i = 0; i < N; i++) {
    resetBlob(i);
    ba[i]  = Math.random() * bma[i];
    by[i] -= (ba[i]/bma[i]) * H * 0.55;
    bx[i] += (Math.random()-0.5) * 160;
  }

  let t = 0, paused = false;

  function frame() {
    if (paused) { requestAnimationFrame(frame); return; }
    t += 0.00030;   // very slow time evolution

    /* Update vortices (gentle drift, soft bounce) */
    for (const v of vortices) {
      v.x += v.vx; v.y += v.vy;
      if (v.x < 0 || v.x > W) v.vx *= -1;
      if (v.y < H*0.05 || v.y > H*0.90) v.vy *= -1;
    }

    /* Fade trail — 0.4%/frame keeps trails for ~8 seconds */
    tCtx.globalCompositeOperation = 'destination-out';
    tCtx.fillStyle = 'rgba(0,0,0,0.004)';
    tCtx.fillRect(0, 0, W, H);
    tCtx.globalCompositeOperation = 'source-over';

    /* Draw blobs */
    for (let i = 0; i < N; i++) {
      const life = ba[i] / bma[i];
      if (life >= 1 || by[i] < -150) { resetBlob(i); continue; }

      /* Low-frequency flow field — gentle, not chaotic */
      const fx = bx[i]/W * 1.6;
      const fy = by[i]/H * 1.6;
      const angle = noise(fx, fy + t) * Math.PI * 2.2;

      /* Vortex nudge — very subtle */
      let vfx = 0, vfy = 0;
      for (const v of vortices) {
        const dx = bx[i]-v.x, dy = by[i]-v.y;
        const d  = Math.sqrt(dx*dx+dy*dy);
        if (d < v.radius && d > 1) {
          const f = v.strength * (1 - d/v.radius);
          vfx += (-dy/d)*f;
          vfy += ( dx/d)*f;
        }
      }

      /* Velocity: inertia-heavy (smoke doesn't snap) */
      const spd = bsp[i];
      bvx[i] += (Math.cos(angle)*spd*0.35 + vfx - bvx[i]) * 0.04;
      bvy[i] += (-(spd*0.50) + Math.sin(angle)*spd*0.12 + vfy - bvy[i]) * 0.03;

      bx[i] += bvx[i];
      by[i] += bvy[i];
      ba[i]++;

      /* Blob grows as it rises — warm air expands smoke */
      const r = br[i] + life * br[i] * 1.2;

      /* Alpha: gentle bell curve, very low peak */
      const alpha = Math.sin(life * Math.PI) * 0.028;
      if (alpha < 0.003 || r < 2) continue;

      /* Warm near-white — smoke in amber light has a slight warmth */
      const grad = tCtx.createRadialGradient(bx[i], by[i], 0, bx[i], by[i], r);
      grad.addColorStop(0,    `rgba(218,212,204,${alpha})`);
      grad.addColorStop(0.45, `rgba(205,200,192,${alpha*0.48})`);
      grad.addColorStop(0.75, `rgba(192,187,180,${alpha*0.18})`);
      grad.addColorStop(1,    `rgba(180,175,168,0)`);
      tCtx.beginPath();
      tCtx.arc(bx[i], by[i], r, 0, Math.PI * 2);
      tCtx.fillStyle = grad;
      tCtx.fill();
    }

    /* Composite to display */
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';

    /* Pass 1: moderate blur — keeps wisp definition */
    ctx.filter     = 'blur(8px)';
    ctx.globalAlpha = 1;
    ctx.drawImage(trail, 0, 0);

    /* Pass 2: heavy blur at low opacity — the deep volumetric body */
    ctx.filter     = 'blur(28px)';
    ctx.globalAlpha = 0.20;
    ctx.drawImage(trail, 0, 0);

    ctx.filter     = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(frame);
  }

  frame();
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
})();
