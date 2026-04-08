import { $ } from "./utils.js";

export function createDust() {
  const canvas = $("#dustCanvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const particles = [];
  const pointer = { x: null, y: null, radius: 120 };

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function seedParticles() {
    particles.length = 0;
    const count = Math.round((window.innerWidth * window.innerHeight) / 14000);
    for (let index = 0; index < count; index += 1) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.8 + 0.4,
        alpha: Math.random() * 0.35 + 0.08,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18
      });
    }
  }

  function update() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < -10) particle.x = canvas.width + 10;
      if (particle.x > canvas.width + 10) particle.x = -10;
      if (particle.y < -10) particle.y = canvas.height + 10;
      if (particle.y > canvas.height + 10) particle.y = -10;

      if (pointer.x !== null && pointer.y !== null) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < pointer.radius) {
          const force = (pointer.radius - distance) / pointer.radius;
          const angle = Math.atan2(dy, dx);
          particle.x += Math.cos(angle) * force * 4.2;
          particle.y += Math.sin(angle) * force * 4.2;
        }
      }

      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fillStyle = `rgba(18, 18, 18, ${particle.alpha})`;
      context.fill();
    });
    window.requestAnimationFrame(update);
  }

  window.addEventListener("resize", () => {
    resize();
    seedParticles();
  });
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  window.addEventListener("pointerleave", () => {
    pointer.x = null;
    pointer.y = null;
  });

  resize();
  seedParticles();
  update();
}
