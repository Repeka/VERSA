// VERSA welcome page: slowly moving particles in the background.

(function () {
  // Visitors who already saw the intro in this tab get a quicker version
  try {
    if (sessionStorage.getItem('versa-intro') === '1') {
      document.documentElement.classList.add('intro-seen');
    }
    sessionStorage.setItem('versa-intro', '1');
  } catch (e) {}
  // "Skip intro" shows everything right away
  var skip = document.querySelector('.skip-intro');
  if (skip) {
    skip.addEventListener('click', function () {
      document.documentElement.classList.add('intro-seen');
      skip.style.display = 'none';
    });
  }
  var canvas = document.getElementById('particles');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var colors = ['254,218,117', '250,126,30', '214,41,118', '150,47,191', '79,91,213'];
  var particles = [];
  var width = 0;
  var height = 0;

  function makeParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -(Math.random() * 0.25 + 0.05),
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.005
    };
  }

  function resize() {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    var count = Math.round(Math.min(90, Math.max(30, (width * height) / 18000)));
    particles = [];
    for (var i = 0; i < count; i++) particles.push(makeParticle());

    if (reduceMotion) draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(function (p) {
      if (!reduceMotion) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.speed;
        if (p.y < -5) { p.y = height + 5; p.x = Math.random() * width; }
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;
      }

      // Slowly twinkling
      var alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.color + ',' + alpha + ')';
      if (p.r > 1.4) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(' + p.color + ',0.8)';
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    });

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  if (!reduceMotion) draw();
})();

