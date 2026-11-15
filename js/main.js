// The Drone_Father - small, dependency-free behaviours.
document.documentElement.classList.add('js');

// 1. Theme tune: plays once when a visitor first arrives (once per browser tab session).
//    Browsers only allow sound without a click on some visits, so this tries straight
//    away and, if the browser refuses, plays on the visitor's first click, tap or key press.
(function () {
  var audio = document.getElementById('themeAudio');
  if (!audio) return;
  var KEY = 'df-theme-played';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}

  var done = false;
  var events = ['pointerdown', 'keydown', 'touchend'];
  function finish() {
    done = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    events.forEach(function (ev) { document.removeEventListener(ev, onFirstAction, true); });
  }
  function tryPlay() {
    if (done) return;
    audio.play().then(finish).catch(function () { /* blocked: wait for first action */ });
  }
  function onFirstAction(e) {
    var t = e.target;
    // Starting a film: skip the tune, the film opens with it anyway.
    if (t && t.closest && t.closest('.film')) { finish(); return; }
    tryPlay();
  }
  events.forEach(function (ev) { document.addEventListener(ev, onFirstAction, true); });
  tryPlay();
})();

// 2. Film cards.
//    - Hover intent: nothing loads while the mouse passes over. If it rests on a card
//      for PREVIEW_DELAY ms, the card grows and a silent preview plays. Leaving stops it.
//    - Click (or tap on phones): loads the full player with sound.
(function () {
  var PREVIEW_DELAY = 700;   // ms the pointer must rest on a card before the preview loads
  var PREVIEW_START = 8;     // seconds to skip, so the preview starts after the logo intro
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.film').forEach(function (card) {
    var player = card.querySelector('.film__player[data-yt]');
    if (!player) return;
    var id = player.dataset.yt;
    var timer = null;
    var mode = 'idle';       // idle | preview | full

    function addFrame(query, className) {
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?' + query;
      frame.title = player.getAttribute('aria-label') || 'YouTube video';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      if (className) frame.className = className;
      player.appendChild(frame);
    }
    function clearFrame() {
      var f = player.querySelector('iframe');
      if (f) f.remove();
    }
    function disarm() {
      clearTimeout(timer);
      card.classList.remove('is-arming');
    }
    function startPreview() {
      if (mode !== 'idle') return;
      mode = 'preview';
      card.classList.remove('is-arming');
      card.classList.add('is-preview');
      addFrame('autoplay=1&mute=1&controls=0&rel=0&playsinline=1&loop=1&playlist=' + id + '&start=' + PREVIEW_START, 'film__preview');
    }
    function stopPreview() {
      disarm();
      if (mode !== 'preview') return;
      clearFrame();
      card.classList.remove('is-preview');
      mode = 'idle';
    }
    function playFull() {
      if (mode === 'full') return;
      disarm();
      clearFrame();
      var themeAudio = document.getElementById('themeAudio');
      if (themeAudio && !themeAudio.paused) themeAudio.pause();
      card.classList.remove('is-preview');
      card.classList.add('is-full');
      mode = 'full';
      addFrame('autoplay=1&rel=0');
    }

    player.addEventListener('click', playFull);
    var playBtn = card.querySelector('[data-play]');
    if (playBtn) playBtn.addEventListener('click', playFull);

    if (canHover && !calm) {
      card.addEventListener('mouseenter', function () {
        if (mode !== 'idle') return;
        card.classList.add('is-arming');
        timer = setTimeout(startPreview, PREVIEW_DELAY);
      });
      card.addEventListener('mouseleave', stopPreview);
    }
  });
})();

// 3. Fade sections in as they scroll into view.
(function () {
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (i) { i.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  items.forEach(function (i) { io.observe(i); });
})();

// 5. Scroll progress bar along the top of the page.
(function () {
  var bar = document.getElementById('progress');
  if (!bar) return;
  function update() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// 6. The red glow behind the hero logo follows the cursor (mouse devices only).
(function () {
  var hero = document.querySelector('.hero');
  if (!hero || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  hero.addEventListener('mousemove', function (e) {
    var r = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
    hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
  });
})();

// 4. Footer year.
var y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();
