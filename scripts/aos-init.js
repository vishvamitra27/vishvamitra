/**
 * Deferred AOS init — respects prefers-reduced-motion.
 * Load after aos.js with defer on index.html only.
 */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof AOS === "undefined") return;

  AOS.init({
    duration: 700,
    once: true,
    offset: 60,
    disable: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
})();
