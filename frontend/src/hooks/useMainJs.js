import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useMainJs() {
  const location = useLocation();

  useEffect(() => {

    const animateCount = el => {
      const target = parseInt(el.dataset.count, 10) || 0;
      const prefix = el.dataset.prefix || '';
      const dur = 1600;
      const t0 = performance.now();
      
      const step = t => { 
        const p = Math.min((t - t0) / dur, 1);
        const v = Math.floor(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = prefix + v.toLocaleString('en-US'); 
        if (p < 1) requestAnimationFrame(step); 
      };
      requestAnimationFrame(step);
    };

    let io = null;
    let mo = null;

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          const el = en.target;
          el.classList.add('in');
          if (el.dataset.count) animateCount(el);
          if (el.dataset.width) el.style.width = el.dataset.width;
          io.unobserve(el);
        });
      }, {threshold: .12, rootMargin: '0px 0px -40px 0px'});
      
      const observeElements = (root) => {
        root.querySelectorAll('.reveal:not(.in), [data-count]:not(.in), [data-width]:not(.in)').forEach(el => io.observe(el));
      };
      observeElements(document);

      mo = new MutationObserver((mutations) => {
        mutations.forEach((mut) => {
          if (mut.addedNodes.length) {
            mut.addedNodes.forEach(node => {
              if (node.nodeType === 1) {
                if (node.classList?.contains('reveal') || node.hasAttribute('data-count') || node.hasAttribute('data-width')) {
                  io.observe(node);
                }
                observeElements(node);
              }
            });
          }
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });

    } else {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
      document.querySelectorAll('[data-count]').forEach(el => el.textContent = (el.dataset.prefix||'') + el.dataset.count);
      document.querySelectorAll('[data-width]').forEach(el => el.style.width = el.dataset.width);
    }

    const header = document.querySelector('.site-header');
    const toTop = document.querySelector('.to-top');
    const onScroll = () => {
      const y = window.scrollY;
      if (header) header.classList.toggle('scrolled', y > 10);
      if (toTop) toTop.classList.toggle('show', y > 600);
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    onScroll();

    window.scrollTo(0, 0);

    return () => {
      if (io) io.disconnect();
      if (mo) mo.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [location.pathname]); // Re-run when the route changes
}
