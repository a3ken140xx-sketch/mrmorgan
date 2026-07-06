document.addEventListener('DOMContentLoaded', () => {

  // LOADER
  setTimeout(() => { document.querySelector('.loader-wrapper').classList.add('hidden'); }, 2000);

  // CUSTOM CURSOR
  const cursor = document.querySelector('.cursor');
  const follower = document.querySelector('.cursor-follower');
  let posX = 0, posY = 0, mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; cursor.style.left = mouseX + 'px'; cursor.style.top = mouseY + 'px'; });
  function animateCursor() { posX += (mouseX - posX) * 0.1; posY += (mouseY - posY) * 0.1; follower.style.left = posX - 20 + 'px'; follower.style.top = posY - 20 + 'px'; requestAnimationFrame(animateCursor); }
  animateCursor();
  document.querySelectorAll('a, button, .tool-card, .btn').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.style.transform = 'scale(2)'; follower.style.transform = 'scale(1.5)'; follower.style.borderColor = '#00b4d8'; });
    el.addEventListener('mouseleave', () => { cursor.style.transform = 'scale(1)'; follower.style.transform = 'scale(1)'; follower.style.borderColor = '#7289da'; });
  });

  // PARTICLES
  const particlesContainer = document.getElementById('particles-js');
  const canvas = document.createElement('canvas');
  particlesContainer.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  const particles = [];
  for (let i = 0; i < 80; i++) { particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, size: Math.random() * 2 + 1, opacity: Math.random() * 0.5 + 0.2 }); }
  function drawParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(114, 137, 218, ${p.opacity})`; ctx.fill();
    });
    particles.forEach((a, i) => { for (let j = i + 1; j < particles.length; j++) { const b = particles[j], dx = a.x - b.x, dy = a.y - b.y, dist = Math.sqrt(dx * dx + dy * dy); if (dist < 150) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = `rgba(114, 137, 218, ${0.1 * (1 - dist / 150)})`; ctx.stroke(); } } });
    requestAnimationFrame(drawParticles);
  }
  drawParticles();

  // SCROLL REVEAL
  const revealElements = document.querySelectorAll('.tool-card, .feature-item, .stat-item, .testimonial-card, .download-card, .section-header');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; }
    });
  }, { threshold: 0.1 });
  revealElements.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(40px)'; el.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'; revealObserver.observe(el); });

  // REAL STATS
  const STATS_NS = 'crazyteam';
  const API_URL = '/api';

  function setStat(key, value) {
    document.querySelectorAll(`[data-stat="${key}"]`).forEach(el => {
      el.textContent = (key === 'tools' ? value : value.toLocaleString());
    });
  }

  async function fetchStats() {
    try {
      const [dRes, uRes, vRes] = await Promise.all([
        fetch(`https://api.countapi.xyz/get/${STATS_NS}/downloads`).then(r => r.json()),
        fetch(`${API_URL}/stats/users`).then(r => r.json()),
        fetch(`${API_URL}/visitors/count`).then(r => r.json())
      ]);
      setStat('downloads', dRes.value || 0);
      setStat('users', uRes.value || 0);
      setStat('visitors', vRes.value || 0);
    } catch {
      setStat('downloads', 0);
      setStat('users', 0);
      setStat('visitors', 0);
    }
    setStat('tools', document.querySelectorAll('.tool-card').length);
    // Record visitor
    try { await fetch(`${API_URL}/visitors`, { method: 'POST' }); } catch {}
  }

  fetchStats();

  // Download tracking
  document.querySelectorAll('.tool-card .nitro-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      if (this.querySelector('.fa-download') || this.textContent.includes('تحميل')) {
        try { fetch(`https://api.countapi.xyz/hit/${STATS_NS}/downloads`); } catch {}
      }
    });
  });

  // TYPING EFFECT
  const texts = ['CrazyTeam', 'أدوات ديسكورد', 'مودات احترافية', 'CRAZYTEAM'];
  let textIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  const typingElement = document.querySelector('.typing-text');
  function typeEffect() {
    if (!typingElement) return;
    const currentText = texts[textIndex];
    if (isDeleting) {
      typingElement.textContent = currentText.substring(0, charIndex--);
      if (charIndex < 0) { isDeleting = false; textIndex = (textIndex + 1) % texts.length; }
    } else {
      typingElement.textContent = currentText.substring(0, charIndex++);
      if (charIndex > currentText.length) { isDeleting = true; setTimeout(typeEffect, 1500); return; }
    }
    setTimeout(typeEffect, isDeleting ? 40 : 80);
  }
  typeEffect();

  // NAVBAR SCROLL
  const navbar = document.querySelector('.navbar');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    navbar.classList.toggle('scrolled', current > 50);
    navbar.style.transform = current > lastScroll && current > 100 ? 'translateY(-100%)' : 'translateY(0)';
    lastScroll = current;
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', document.querySelector(link.getAttribute('href'))?.offsetTop <= current + 100);
    });
  });
  navToggle?.addEventListener('click', () => { navToggle.classList.toggle('active'); navLinks.classList.toggle('active'); });
  document.querySelectorAll('.nav-link').forEach(link => { link.addEventListener('click', () => { navToggle?.classList.remove('active'); navLinks?.classList.remove('active'); }); });

  // SCROLL TOP
  const scrollTop = document.querySelector('.scroll-top');
  window.addEventListener('scroll', () => scrollTop?.classList.toggle('visible', window.scrollY > 500));
  scrollTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // TILT
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateX(${y * -10}deg) rotateY(${x * 10}deg) scale3d(1.02,1.02,1.02)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'; });
  });

  // TOAST
  function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.className = 'toast ' + type + ' active';
    setTimeout(() => t.classList.remove('active'), 3000);
  }
  window.showToast = showToast;

  // Copy email on testimonials
  document.querySelectorAll('.testimonial-card').forEach(card => {
    card.addEventListener('click', () => { const email = card.getAttribute('data-email'); if (email) { navigator.clipboard.writeText(email).then(() => showToast('تم نسخ البريد الإلكتروني', 'success')).catch(() => {}); } });
  });
});
