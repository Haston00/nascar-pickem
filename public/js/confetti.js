// Lightweight confetti animation for winner celebration
const Confetti = (() => {
  let canvas, ctx, particles, animFrame;

  function init() {
    canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function launch(duration = 3000) {
    if (!canvas) return;
    particles = [];
    const colors = ['#FFD700', '#FF1744', '#00E676', '#2196F3', '#FF9100', '#E040FB'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    const start = Date.now();

    function frame() {
      const elapsed = Date.now() - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (elapsed > duration) {
        // Fade out
        particles.forEach(p => p.opacity -= 0.02);
        if (particles[0] && particles[0].opacity <= 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          cancelAnimationFrame(animFrame);
          return;
        }
      }

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rot += p.rotV;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      animFrame = requestAnimationFrame(frame);
    }

    frame();
  }

  return { init, launch };
})();

document.addEventListener('DOMContentLoaded', () => Confetti.init());
