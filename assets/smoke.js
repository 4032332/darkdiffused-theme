/* Dark & Diffused — Canvas Smoke System
   90 particles across two layers: rising wisps + ceiling haze
   Amber-lit, globalCompositeOperation:'lighter' for glow overlap
   Pauses when tab is hidden to save CPU
*/

(function () {
  const CANVAS_ID = 'dd-smoke-canvas';

  function initSmoke() {
    if (document.getElementById(CANVAS_ID)) return;

    const canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    canvas.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:1',
      'opacity:0',
      'transition:opacity 1.2s ease',
    ].join(';');
    document.body.appendChild(canvas);

    // Fade in after a moment
    requestAnimationFrame(() => requestAnimationFrame(() => {
      canvas.style.opacity = '1';
    }));

    const ctx = canvas.getContext('2d');
    let W, H, particles = [], raf;
    let paused = false;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Particle factory
    function makeParticle(layer) {
      const isRising = layer === 0;
      return {
        layer,
        x: Math.random() * W,
        y: isRising ? H * (0.4 + Math.random() * 0.6) : H * (Math.random() * 0.35),
        vx: (Math.random() - 0.5) * 0.3,
        vy: isRising ? -(0.18 + Math.random() * 0.28) : -(0.06 + Math.random() * 0.12),
        // Filament amber: #FF9A2E tinted
        r: isRising ? (20 + Math.random() * 30) : (60 + Math.random() * 90),
        alpha: 0,
        maxAlpha: isRising ? (0.04 + Math.random() * 0.06) : (0.025 + Math.random() * 0.03),
        life: 0,
        maxLife: isRising ? (220 + Math.random() * 180) : (300 + Math.random() * 220),
        drift: (Math.random() - 0.5) * 0.002,
        hue: 28 + Math.random() * 16, // amber range 28–44°
      };
    }

    // Seed particles at staggered life stages
    function seedParticles() {
      particles = [];
      // Layer 0: 60 rising wisps
      for (let i = 0; i < 60; i++) {
        const p = makeParticle(0);
        p.life = Math.random() * p.maxLife;
        p.y = H * (0.4 + Math.random() * 0.6) - p.vy * p.life;
        p.alpha = Math.sin((p.life / p.maxLife) * Math.PI) * p.maxAlpha;
        particles.push(p);
      }
      // Layer 1: 30 ceiling haze
      for (let i = 0; i < 30; i++) {
        const p = makeParticle(1);
        p.life = Math.random() * p.maxLife;
        p.alpha = Math.sin((p.life / p.maxLife) * Math.PI) * p.maxAlpha;
        particles.push(p);
      }
    }
    seedParticles();

    function drawParticle(p) {
      if (p.alpha <= 0) return;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, `hsla(${p.hue},100%,60%,${p.alpha})`);
      grad.addColorStop(0.5, `hsla(${p.hue},80%,40%,${p.alpha * 0.4})`);
      grad.addColorStop(1, `hsla(${p.hue},60%,20%,0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    function tick() {
      if (paused) { raf = requestAnimationFrame(tick); return; }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.vx + Math.sin(p.life * p.drift) * 0.4;
        p.y += p.vy;
        p.r += p.layer === 0 ? 0.12 : 0.06;
        p.alpha = Math.sin((p.life / p.maxLife) * Math.PI) * p.maxAlpha;

        if (p.life >= p.maxLife || p.y < -p.r || p.x < -p.r || p.x > W + p.r) {
          particles[i] = makeParticle(p.layer);
        } else {
          drawParticle(p);
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(tick);
    }

    tick();

    // Pause when tab hidden
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
