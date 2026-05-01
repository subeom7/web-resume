const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('[data-nav-links]');
const navAnchors = [...document.querySelectorAll('.nav-links a')];
const revealItems = document.querySelectorAll('.reveal');
const year = document.querySelector('#year');

year.textContent = new Date().getFullYear();

navToggle?.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

navAnchors.forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

revealItems.forEach((item) => revealObserver.observe(item));

const sections = navAnchors
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

const setActiveLink = (sectionId) => {
  navAnchors.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
  });
};

const updateActiveSection = () => {
  const scrollPosition = window.scrollY + 140;
  const isNearBottom =
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;

  if (isNearBottom) {
    setActiveLink('contact');
    return;
  }

  let currentSectionId = sections[0]?.id;

  sections.forEach((section) => {
    if (section.offsetTop <= scrollPosition) {
      currentSectionId = section.id;
    }
  });

  if (currentSectionId) {
    setActiveLink(currentSectionId);
  }
};

window.addEventListener('scroll', updateActiveSection, { passive: true });
window.addEventListener('resize', updateActiveSection);
updateActiveSection();

const backToTopLink = document.querySelector('[data-back-to-top]');

backToTopLink?.addEventListener('click', (event) => {
  event.preventDefault();

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });

  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
});

const canAnimatePointer = window.matchMedia('(pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (canAnimatePointer) {
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let ticking = false;

  const animateSpace = () => {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;

    document.documentElement.style.setProperty('--space-x', `${currentX.toFixed(2)}px`);
    document.documentElement.style.setProperty('--space-y', `${currentY.toFixed(2)}px`);

    if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
      requestAnimationFrame(animateSpace);
    } else {
      ticking = false;
    }
  };

  window.addEventListener('pointermove', (event) => {
    targetX = (event.clientX / window.innerWidth - 0.5) * 20;
    targetY = (event.clientY / window.innerHeight - 0.5) * 20;

    if (!ticking) {
      ticking = true;
      requestAnimationFrame(animateSpace);
    }
  }, { passive: true });
}
