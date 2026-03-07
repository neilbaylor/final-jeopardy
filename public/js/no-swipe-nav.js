// Disable back/forward swipe navigation in Mobile Safari by intercepting
// touches that start within the edge zones used by the browser gesture.
(function () {
  const EDGE_PX = 20;
  document.addEventListener('touchstart', function (e) {
    const x = e.touches[0].clientX;
    if (x < EDGE_PX || x > window.innerWidth - EDGE_PX) {
      e.preventDefault();
    }
  }, { passive: false });
})();
