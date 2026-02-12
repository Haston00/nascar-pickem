/**
 * NASCAR Pick'em Splash Screen
 * Same pattern as DABO — YouTube video background, muted autoplay,
 * click to unmute, ENTER button after 20 seconds.
 */

// ============================================
// CHANGE THIS to your preferred YouTube video ID
// The video ID is the part after "v=" in a YouTube URL.
//
// Great options to search for on YouTube:
//   "Dale Earnhardt 1998 Daytona 500 finish" — the GOAT moment
//   "Ross Chastain wall ride Martinsville"   — the Hail Melon
//   "Ricky Craven Kurt Busch Darlington 2003" — closest finish ever
// ============================================
const SPLASH_VIDEO_ID = 'O_F3KyllNdg';  // Dale Earnhardt Sr. wins 1998 Daytona 500
const SPLASH_VIDEO_START = 5;  // Skip the first few seconds of intro
const SPLASH_MIN_SECONDS = 20; // ENTER button appears after this many seconds

// Floating particle effect (yellow racing sparks)
(function() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particleCanvas';
  canvas.style.cssText = 'position:fixed;inset:0;z-index:3;pointer-events:none;';
  const splash = document.getElementById('splash-wrap');
  if (!splash) return;
  splash.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 0.5 + 0.2,
      opacity: Math.random() * 0.3 + 0.1,
      drift: (Math.random() - 0.5) * 0.3,
    };
  }

  for (let i = 0; i < 30; i++) {
    const p = createParticle();
    p.y = Math.random() * canvas.height;
    particles.push(p);
  }

  function animate() {
    if (!document.getElementById('splash-wrap')) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -10) Object.assign(p, createParticle());

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 0, ${p.opacity})`;
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
})();
