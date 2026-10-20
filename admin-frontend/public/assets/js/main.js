(function(){
  'use strict';
  const $ = (s, c=document) => c.querySelector(s), $$ = (s, c=document) => [...c.querySelectorAll(s)];

  // Header shadow + back to top
  const header = $('.site-header'), toTop = $('.to-top');
  const onScroll = () => {
    const y = window.scrollY;
    header && header.classList.toggle('scrolled', y > 10);
    toTop && toTop.classList.toggle('show', y > 600);
  };
  window.addEventListener('scroll', onScroll, {passive:true}); onScroll();
  toTop && toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));

  // Mobile menu
  const toggle = $('.menu-toggle'), links = $('.nav-links');
  toggle && toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.innerHTML = links.classList.contains('open') ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
  });

  // Reveal on scroll + counters + progress bars
  const animateCount = el => {
    const target = parseInt(el.dataset.count, 10) || 0, prefix = el.dataset.prefix || '', dur = 1600, t0 = performance.now();
    const step = t => { const p = Math.min((t - t0) / dur, 1), v = Math.floor(target * (1 - Math.pow(1 - p, 3)));
      el.textContent = prefix + v.toLocaleString('en-US'); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in');
      if (el.dataset.count) animateCount(el);
      if (el.dataset.width) el.style.width = el.dataset.width;
      io.unobserve(el);
    }), {threshold:.12, rootMargin:'0px 0px -40px 0px'});
    $$('.reveal, [data-count], [data-width]').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
    $$('[data-count]').forEach(el => el.textContent = (el.dataset.prefix||'') + el.dataset.count);
    $$('[data-width]').forEach(el => el.style.width = el.dataset.width);
  }

  // Accordion
  $$('.acc-head').forEach(h => h.addEventListener('click', () => {
    const acc = h.closest('.acc'); acc.classList.toggle('open');
    h.setAttribute('aria-expanded', acc.classList.contains('open'));
  }));

  // Copy to clipboard
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => {
    const txt = b.dataset.copy, done = () => { const o = b.innerHTML; b.innerHTML = '<i class="fa-solid fa-check"></i> تم النسخ'; setTimeout(() => b.innerHTML = o, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done);
    else { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done(); }
  }));

  // Upload box preview
  $$('.upload-box').forEach(box => {
    const input = $('input[type=file]', box), name = $('.fname', box), prev = $('.upload-preview', box);
    const show = f => { if (!f) return; name.textContent = f.name;
      if (prev && f.type.startsWith('image/')) { const r = new FileReader(); r.onload = e => { prev.src = e.target.result; prev.style.display = 'block'; }; r.readAsDataURL(f); } };
    input.addEventListener('change', () => show(input.files[0]));
    ['dragenter','dragover'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.remove('drag'); }));
    box.addEventListener('drop', e => { if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(input.files[0]); } });
  });

  // Subscribe form: auto-fill amount from selected course
  const courseSel = $('#course_id'), amount = $('#amount');
  if (courseSel && amount) courseSel.addEventListener('change', () => {
    const p = courseSel.selectedOptions[0] && courseSel.selectedOptions[0].dataset.price; if (p) amount.value = p;
  });

  // Password visibility
  $$('[data-toggle-pass]').forEach(b => b.addEventListener('click', () => {
    const i = document.getElementById(b.dataset.togglePass); i.type = i.type === 'password' ? 'text' : 'password';
    b.innerHTML = i.type === 'password' ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
  }));

  // Prevent double submit
  $$('form').forEach(f => f.addEventListener('submit', () => {
    const b = $('button[type=submit]', f); if (b && !f.dataset.noLock) { setTimeout(() => { b.disabled = true; b.style.opacity = .7; }, 0); }
  }));
})();
