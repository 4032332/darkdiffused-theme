/* Dark & Diffused — Speakeasy Smoke System v2
   Vapour-physics smoke: bezier-path tendrils, turbulent curl, billowing clouds.
   Three source types: cigar wisps (thin, slow), cocktail steam (denser columns),
   and ceiling haze (broad, very slow drift).
   Pauses on visibilitychange to save CPU.
*/

(function () {
  const CANVAS_ID = 'dd-smoke-canvas';

  /* ── Lightweight noise (no library) ──
     Value noise via hash — good enough for organic turbulence */
  function hash(n) {
    n = Math.sin(n) * 43758.5453123;
    return n - Math.floor(n);
  }
  function noise2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix     + iy     * 57);
    const b = hash(ix + 1 + iy     * 57);
    const c = hash(ix     + (iy+1) * 57);
    const d = hash(ix + 1 + (iy+1) * 57);
    return a + (b-a)*ux + (c-a)*uy + (d-a+a-b-c+b)*ux*uy;
  }
  /* Curl noise — gives organic swirling motion */
  function curlX(x, y, t) { return (noise2(x, y + 0.01 + t * 0.08) - noise2(x, y - 0.01 + t * 0.08)) / 0.02; }
  function curlY(x, y, t) { return (noise2(x + 0.01, y + t * 0.08) - noise2(x - 0.01, y + t * 0.08)) / 0.02; }

  function initSmoke() {
    if (document.getElementById(CANVAS_ID)) return;

    const canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    canvas.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'pointer-events:none', 'z-index:1', 'opacity:0', 'transition:opacity 2s ease',
    ].join(';');
    document.body.appendChild(canvas);

    setTimeout(() => { canvas.style.opacity = '1'; }, 400);

    const ctx = canvas.getContext('2d');
    let W, H, streams = [], hazeParticles = [], tick_n = 0;
    let paused = false;

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', () => { resize(); seedAll(); }, { passive: true });

    /* ══════════════════════════════════════
       STREAM — a rising column of smoke
       Each stream owns a chain of Nodes.
       Nodes are the spine of the tendril.
       We draw a smooth bezier tube through them.
    ══════════════════════════════════════ */
    const STREAM_COUNT = 12; // simultaneous columns

    function makeStream() {
      // Spawn points: clustered near bottom, like glasses on a bar
      const clusterX = [0.15, 0.28, 0.42, 0.55, 0.67, 0.80].map(f => f * W);
      const spawnX = clusterX[Math.floor(Math.random() * clusterX.length)]
                     + (Math.random() - 0.5) * W * 0.06;
      const type = Math.random() < 0.6 ? 'cigar' : 'cocktail';

      return {
        type,
        x: spawnX,
        y: H,
        // each node in the spine
        nodes: [],
        // timing
        age: 0,
        // cigar: thin, pale, slow. cocktail: denser, amber-tinted, faster
        speed:     type === 'cigar' ? 0.35 + Math.random() * 0.2 : 0.55 + Math.random() * 0.3,
        maxNodes:  type === 'cigar' ? 28 : 22,
        width0:    type === 'cigar' ? 2 + Math.random() * 2 : 6 + Math.random() * 4,
        widthMax:  type === 'cigar' ? 28 + Math.random() * 20 : 55 + Math.random() * 30,
        alpha0:    type === 'cigar' ? 0.06 + Math.random() * 0.04 : 0.09 + Math.random() * 0.04,
        hue:       type === 'cigar' ? 25 + Math.random() * 10  : 28 + Math.random() * 14,
        // for curl noise sampling
        noiseOff:  Math.random() * 100,
        drift:     (Math.random() - 0.5) * 0.4,
        // birth offset so they don't all die together
        lifePhase: Math.random(),
      };
    }

    /* Node — a point in the spine of a stream */
    function addNode(stream) {
      const t = tick_n * 0.001;
      const prev = stream.nodes[stream.nodes.length - 1];
      const baseX = prev ? prev.x : stream.x;
      const baseY = prev ? prev.y : stream.y;

      // Sample curl noise for organic turbulence
      const nx = baseX / W * 3 + stream.noiseOff;
      const ny = baseY / H * 3 + stream.noiseOff;
      const cx = curlX(nx, ny, t) * 0.08;
      const cy = curlY(nx, ny, t) * 0.04;

      // Upward momentum + curl + gentle horizontal drift
      const vx = stream.drift + cx + Math.sin(tick_n * 0.004 + stream.noiseOff) * 0.3;
      const vy = -stream.speed + cy;

      // Width grows from thin at base to wide at top
      const frac = stream.nodes.length / stream.maxNodes;
      const w = stream.width0 + (stream.widthMax - stream.width0) * Math.pow(frac, 0.7);

      // Alpha: fade in from base, fade out near top
      const alpha = stream.alpha0 * Math.sin(frac * Math.PI);

      stream.nodes.push({
        x: baseX + vx,
        y: baseY + vy,
        w,
        alpha,
        age: 0,
      });
    }

    /* Draw one stream as a smooth ribbon */
    function drawStream(s) {
      if (s.nodes.length < 3) return;

      const nodes = s.nodes;
      const n = nodes.length;

      // Draw as a series of bezier-curve segments with varying stroke width
      // We step through pairs of nodes and draw tapered sections
      for (let i = 1; i < n - 1; i++) {
        const p0 = nodes[i - 1];
        const p1 = nodes[i];
        const p2 = nodes[i + 1];

        // Control point midway for smooth curve
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;

        const alpha = Math.min(p0.alpha, p1.alpha);
        if (alpha <= 0.002) continue;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p1.x, p1.y, mx, my);

        // Stroke width = tendril width at this segment
        const w = (p0.w + p1.w) / 2;
        ctx.lineWidth  = Math.max(0.5, w);
        ctx.lineCap    = 'round';
        ctx.lineJoin   = 'round';

        // Colour: cigar smoke is cool grey-amber; cocktail smoke is warmer
        const sat  = s.type === 'cigar' ? 12 : 30;
        const lght = s.type === 'cigar' ? 72 : 65;
        ctx.strokeStyle = `hsla(${s.hue}, ${sat}%, ${lght}%, ${alpha})`;
        ctx.stroke();
      }

      // Puff at the top — the smoke blooms into a cloud as it disperses
      const tip = nodes[n - 1];
      if (tip && tip.w > 8) {
        const puffR = tip.w * 1.4;
        const puffAlpha = tip.alpha * 0.6;
        if (puffAlpha > 0.003) {
          const grad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, puffR);
          const sat  = s.type === 'cigar' ? 8 : 22;
          const lght = s.type === 'cigar' ? 75 : 68;
          grad.addColorStop(0,   `hsla(${s.hue}, ${sat}%, ${lght}%, ${puffAlpha})`);
          grad.addColorStop(0.5, `hsla(${s.hue}, ${sat}%, ${lght}%, ${puffAlpha * 0.4})`);
          grad.addColorStop(1,   `hsla(${s.hue}, ${sat}%, ${lght}%, 0)`);
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, puffR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }
    }

    /* ══════════════════════════════════════
       CEILING HAZE — slow broad wisps
       at the top 30% of the screen
    ══════════════════════════════════════ */
    const HAZE_COUNT = 18;

    function makeHaze() {
      return {
        x: Math.random() * W,
        y: H * (Math.random() * 0.3),
        r: 120 + Math.random() * 180,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.04 - Math.random() * 0.06,
        alpha: 0.015 + Math.random() * 0.018,
        life: 0,
        maxLife: 600 + Math.random() * 400,
        hue: 24 + Math.random() * 12,
      };
    }

    function drawHaze(h) {
      const frac = h.life / h.maxLife;
      const a = h.alpha * Math.sin(frac * Math.PI);
      if (a <= 0.001) return;

      // Elongated oval — smoke haze spreads horizontally
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(1.8, 0.55);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, h.r);
      grad.addColorStop(0,   `hsla(${h.hue}, 8%, 70%, ${a})`);
      grad.addColorStop(0.6, `hsla(${h.hue}, 8%, 70%, ${a * 0.3})`);
      grad.addColorStop(1,   `hsla(${h.hue}, 8%, 70%, 0)`);
      ctx.beginPath();
      ctx.arc(0, 0, h.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    /* ══════════════════════════════════════
       SEED
    ══════════════════════════════════════ */
    function seedAll() {
      streams = [];
      hazeParticles = [];

      for (let i = 0; i < STREAM_COUNT; i++) {
        const s = makeStream();
        // Pre-age streams so they're mid-flow on page load
        const preAge = Math.floor(Math.random() * s.maxNodes * 0.8);
        for (let j = 0; j < preAge; j++) addNode(s);
        streams.push(s);
      }

      for (let i = 0; i < HAZE_COUNT; i++) {
        const h = makeHaze();
        h.life = Math.random() * h.maxLife;
        hazeParticles.push(h);
      }
    }
    seedAll();

    /* ══════════════════════════════════════
       MAIN LOOP
    ══════════════════════════════════════ */
    function frame() {
      if (paused) { requestAnimationFrame(frame); return; }
      tick_n++;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';

      // Draw ceiling haze (back layer)
      for (let i = 0; i < hazeParticles.length; i++) {
        const h = hazeParticles[i];
        drawHaze(h);
        h.x += h.vx;
        h.y += h.vy;
        h.life++;
        if (h.life >= h.maxLife || h.y < -h.r) {
          hazeParticles[i] = makeHaze();
          hazeParticles[i].y = H * 0.3;
        }
      }

      // Draw rising streams (front layer)
      for (let i = 0; i < streams.length; i++) {
        const s = streams[i];
        drawStream(s);

        // Grow the stream by one node per frame
        if (s.nodes.length < s.maxNodes) {
          addNode(s);
        } else {
          // Shift spine upward (drop oldest node, add new at top)
          s.nodes.shift();
          addNode(s);
        }

        s.age++;

        // Slowly drift the spawn point
        s.x += Math.sin(tick_n * 0.001 + i) * 0.08;

        // When stream climbs off screen, respawn at bottom
        const tip = s.nodes[s.nodes.length - 1];
        if (tip && tip.y < -100) {
          streams[i] = makeStream();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }

    frame();

    document.addEventListener('visibilitychange', () => {
      paused = document.hidden;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmoke);
  } else {
    initSmoke();
  }
})();
