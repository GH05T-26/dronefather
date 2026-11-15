// The Drone_Father - interactive world map ("The territory").
//
// ---------------------------------------------------------------------------
// WHERE WE HAVE SHOT (the only part that normally needs editing)
// ---------------------------------------------------------------------------
// One entry per country. "country" must match a name in js/map-data.js exactly
// (e.g. 'Italy', 'United Kingdom', 'United States of America', 'New Zealand').
// Optional extras: "label" is the heading shown on the card and button if it should
// differ from the country name; a place's "region" groups places under a small heading.
// Each place needs a name plus latitude and longitude (right-click a spot in
// Google Maps to copy them). South and west are negative numbers.
//
// Example of adding a country:
//   { country: 'Italy', places: [ { name: 'Lake Como', lat: 45.99, lon: 9.26 } ] },
var VISITED = [
  {
    country: 'Australia',
    places: [
      { region: 'Victoria', name: 'Melbourne', lat: -37.81, lon: 144.96 },
      { region: 'Victoria', name: 'Kangaroo Ground', lat: -37.71, lon: 145.25 },
      { region: 'Victoria', name: 'Dandenong Ranges (Emerald)', lat: -37.93, lon: 145.46 },
      { region: 'Victoria', name: 'Mornington Peninsula (Arthurs Seat)', lat: -38.35, lon: 144.96 },
      { region: 'Queensland', name: "K'gari: Lake McKenzie, Champagne Pools, 75 Mile Beach", lat: -25.25, lon: 153.15 },
      { region: 'Queensland', name: 'Rainbow Beach (Double Island Point)', lat: -25.94, lon: 153.18 },
      { region: 'Queensland', name: 'Noosa Heads', lat: -26.38, lon: 153.12 }
    ]
  },
  {
    country: 'Tasmania',            // drawn as its own shape so it can be highlighted separately
    label: 'Tasmania, Australia',
    places: [
      { name: 'Bay of Fires', lat: -41.22, lon: 148.28 },
      { name: 'Strahan', lat: -42.15, lon: 145.26 },
      { name: 'Queenstown area (Gormanston)', lat: -42.07, lon: 145.59 }
    ]
  },
  {
    country: 'New Zealand',
    places: [
      { region: 'South Island', name: 'Aoraki / Mount Cook', lat: -43.70, lon: 170.10 },
      { region: 'South Island', name: 'Kaikoura', lat: -42.43, lon: 173.69 },
      { region: 'South Island', name: 'Christchurch (Moncks Bay)', lat: -43.57, lon: 172.76 },
      { region: 'North Island', name: 'Bay of Islands (Russell)', lat: -35.26, lon: 174.13 },
      { region: 'North Island', name: 'Waiheke Island', lat: -36.78, lon: 175.01 },
      { region: 'North Island', name: 'Waitakere Ranges (Huia)', lat: -36.99, lon: 174.57 }
    ]
  },
  {
    country: 'Italy',
    places: [
      { name: 'Lake Como (Bellagio)', lat: 45.99, lon: 9.26 }
    ]
  },
  {
    country: 'Greece',
    places: [
      { name: 'Naxos', lat: 37.08, lon: 25.34 }
    ]
  },
  {
    country: 'Croatia',
    places: [
      { name: 'Hvar', lat: 43.17, lon: 16.44 }
    ]
  },
  {
    country: 'Turkey',
    places: [
      { name: 'Cappadocia', lat: 38.64, lon: 34.83 }
    ]
  }
];

// Feel of the hover effect.
var MAP_REACH = 90;      // how close the cursor must get before a country starts growing (map units; the map is 1000 wide)
var MAP_TARGET = 80;     // small countries grow until they are about this wide
var MAP_MAX_SCALE = 2.6; // never grow more than this many times
// ---------------------------------------------------------------------------

(function () {
  var world = window.DF_WORLD;
  var wrap = document.getElementById('worldMap');
  var chipsBox = document.getElementById('mapChips');
  if (!world || !wrap) return;

  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }
  function project(lat, lon) {
    return [
      (lon + 180) / 360 * world.w,
      (world.latTop - lat) / (world.latTop - world.latBot) * world.h
    ];
  }

  var byName = {};
  world.countries.forEach(function (c) { byName[c.n] = c; });
  var visitedNames = {};
  VISITED.forEach(function (v) { visitedNames[v.country] = true; });

  var svg = el('svg', {
    viewBox: '0 0 ' + world.w + ' ' + world.h,
    role: 'img',
    'aria-label': 'World map. Countries filmed in so far: ' + VISITED.map(function (v) { return v.label || v.country; }).join('; ') + '.'
  });

  // Every country we have not shot in: one quiet shape.
  var rest = world.countries.filter(function (c) { return !visitedNames[c.n]; })
    .map(function (c) { return c.d; }).join('');
  svg.appendChild(el('path', { 'class': 'map__land', d: rest }));

  var card = document.createElement('div');
  card.className = 'map__card';
  card.setAttribute('aria-live', 'polite');

  var items = [];
  VISITED.forEach(function (v) {
    var c = byName[v.country];
    if (!c) { if (window.console) console.warn('Map: no country called "' + v.country + '" in map-data.js'); return; }
    var max = Math.min(MAP_MAX_SCALE, Math.max(1.12, MAP_TARGET / Math.max(c.s[0], c.s[1])));
    var g = el('g', { 'class': 'map__country' });
    g.style.transformOrigin = c.c[0] + 'px ' + c.c[1] + 'px';
    g.appendChild(el('path', { d: c.d }));
    v.places.forEach(function (p) {
      var xy = project(p.lat, p.lon);
      g.appendChild(el('circle', { 'class': 'map__pin', cx: xy[0].toFixed(1), cy: xy[1].toFixed(1), r: (3.4 / max).toFixed(2) }));
    });
    svg.appendChild(g);
    var item = { v: v, c: c, g: g, max: max, half: Math.max(c.s[0], c.s[1]) / 2, scale: 1, chip: null };
    g.addEventListener('click', function () { toggleLock(item); });
    items.push(item);
  });

  wrap.appendChild(svg);
  wrap.appendChild(card);

  var active = null;
  var locked = null;

  function setScale(item, s) {
    item.scale = s;
    item.g.style.transform = s === 1 ? '' : 'scale(' + s.toFixed(3) + ')';
  }

  function showCard(item) {
    card.textContent = '';
    var h = document.createElement('h3');
    h.textContent = item.v.label || item.v.country;
    var ul = document.createElement('ul');
    var lastRegion = null;
    item.v.places.forEach(function (p) {
      if (p.region && p.region !== lastRegion) {
        var head = document.createElement('li');
        head.className = 'map__region';
        head.textContent = p.region;
        ul.appendChild(head);
        lastRegion = p.region;
      }
      var li = document.createElement('li');
      li.textContent = p.name;
      ul.appendChild(li);
    });
    card.appendChild(h);
    card.appendChild(ul);

    var topEdge = item.c.c[1] - item.c.s[1] * item.max / 2;
    var bottomEdge = item.c.c[1] + item.c.s[1] * item.max / 2;
    var below = topEdge / world.h < 0.3;
    var left = Math.min(88, Math.max(12, item.c.c[0] / world.w * 100));
    card.style.left = left + '%';
    card.style.top = ((below ? bottomEdge : topEdge) / world.h * 100) + '%';
    card.classList.toggle('is-below', below);
    card.classList.add('is-on');
  }

  function setActive(item) {
    if (active === item) return;
    if (active) {
      active.g.classList.remove('is-active');
      if (active.chip) active.chip.classList.remove('is-on');
    }
    active = item;
    wrap.classList.toggle('has-active', !!item);   // dims the other red countries
    if (!item) { card.classList.remove('is-on'); return; }
    item.g.classList.add('is-active');
    if (item.chip) item.chip.classList.add('is-on');
    svg.appendChild(item.g);          // draw on top of its neighbours
    showCard(item);
  }

  function reset() {
    items.forEach(function (it) { setScale(it, 1); });
    setActive(null);
  }

  function toggleLock(item) {
    if (locked === item) { locked = null; reset(); return; }
    locked = item;
    items.forEach(function (it) { setScale(it, it === item ? it.max : 1); });
    setActive(item);
  }

  // Proximity: the nearer the cursor, the bigger the country.
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover) {
    svg.addEventListener('mousemove', function (e) {
      if (locked) return;
      var r = svg.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * world.w;
      var y = (e.clientY - r.top) / r.height * world.h;
      // Find the country whose centre is nearest the cursor: it gets the full effect.
      // Its neighbours only swell slightly, so close-together countries (Italy,
      // Croatia, Greece) do not all balloon on top of each other.
      var best = null, bestD = Infinity;
      items.forEach(function (it) {
        var dx = x - it.c.c[0], dy = y - it.c.c[1];
        it.d = Math.sqrt(dx * dx + dy * dy);
        if (it.d < bestD) { bestD = it.d; best = it; }
      });
      var bestT = 0;
      items.forEach(function (it) {
        var t = Math.max(0, 1 - Math.max(0, it.d - it.half) / MAP_REACH);
        t = t * t * (3 - 2 * t);                    // ease in and out
        if (it === best) { bestT = t; setScale(it, 1 + (it.max - 1) * t); }
        else setScale(it, 1 + (it.max - 1) * t * 0.12);
      });
      setActive(bestT > 0.35 ? best : null);
    });
    svg.addEventListener('mouseleave', function () { if (!locked) reset(); });
  }

  // Buttons under the map: the way in for phones and keyboards.
  if (chipsBox) {
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = it.v.label ? it.v.label.split(',')[0] : it.v.country;
      b.addEventListener('click', function () { toggleLock(it); });
      it.chip = b;
      chipsBox.appendChild(b);
    });
  }
})();
