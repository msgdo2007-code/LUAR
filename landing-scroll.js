(() => {
  const start = () => {
    const landing = document.querySelector(".landing-page");
    if (!landing || !window.gsap || !window.ScrollTrigger) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      gsap.utils.toArray(".landing-main > section:not(.landing-hero), .landing-cta-break").forEach((section) => {
        const children = section.querySelectorAll(":scope > *");
        gsap.from(children.length ? children : section, {
          autoAlpha: 0,
          y: 42,
          duration: 0.85,
          stagger: 0.08,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
          scrollTrigger: {
            trigger: section,
            start: "top 86%",
            once: true,
          },
        });
      });

      gsap.utils.toArray(".feature-bento > article, .trust-proof-grid > article, .landing-advanced-showcase article").forEach((card) => {
        gsap.from(card, {
          autoAlpha: 0,
          y: 28,
          scale: 0.98,
          duration: 0.65,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
          scrollTrigger: { trigger: card, start: "top 90%", once: true },
        });
      });

      const heroVisual = document.querySelector(".hero-visual");
      if (heroVisual) {
        gsap.to(heroVisual, {
          yPercent: 7,
          ease: "none",
          scrollTrigger: { trigger: ".landing-hero", start: "top top", end: "bottom top", scrub: 0.6 },
        });
      }
    }, landing);

    window.addEventListener("pagehide", () => context.revert(), { once: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
