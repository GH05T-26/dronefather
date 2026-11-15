"""Turn world-atlas countries-110m.json (TopoJSON, Natural Earth, public domain)
into js/map-data.js: one SVG path per country in a 1000-wide equirectangular map.
Usage: python -I build_map.py <countries-110m.json> <out js file>
"""
import json
import sys

src, out = sys.argv[1], sys.argv[2]
t = json.load(open(src, encoding='utf-8'))
sx, sy = t['transform']['scale']
tx, ty = t['transform']['translate']

# decode delta-encoded arcs to lon/lat
arcs = []
for arc in t['arcs']:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx
        y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

W = 1000.0
LAT_TOP, LAT_BOT = 84.0, -58.0
H = W * (LAT_TOP - LAT_BOT) / 360.0


def project(lon, lat):
    return ((lon + 180.0) / 360.0 * W, (LAT_TOP - lat) / (LAT_TOP - LAT_BOT) * H)


def ring_points(ring):
    pts = []
    for idx in ring:
        a = arcs[idx] if idx >= 0 else arcs[~idx][::-1]
        pts.extend(a if not pts else a[1:])
    out = [project(lon, lat) for lon, lat in pts]
    xs = [p[0] for p in out]
    if max(xs) - min(xs) > W / 2:
        # ring touches the 180 degree line from both sides: keep it on the right-hand edge
        out = [(min(W, x + W) if x < W / 2 else x, y) for x, y in out]
    return out


def fmt(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return s if s != '-0' else '0'


countries = []
for g in t['objects']['countries']['geometries']:
    name = g['properties']['name']
    if name == 'Antarctica':
        continue
    polys = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
    if name == 'Australia':
        # Tasmania becomes its own shape so the map can highlight it separately.
        tas_y = project(0, -39.5)[1]
        tas = [p for p in polys if min(y for _, y in ring_points(p[0])) > tas_y]
        polys = [p for p in polys if p not in tas]
        for tp in tas:
            pts = ring_points(tp[0])
            xs = [q[0] for q in pts]
            ys = [q[1] for q in pts]
            countries.append({
                'n': 'Tasmania',
                'c': [round((min(xs) + max(xs)) / 2, 1), round((min(ys) + max(ys)) / 2, 1)],
                's': [round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1)],
                'd': 'M' + 'L'.join(fmt(x) + ',' + fmt(y) for x, y in pts) + 'Z',
            })
    d = []
    best = None  # largest polygon by bbox area -> used as the country's centre and size
    for poly in polys:
        for i, ring in enumerate(poly):
            pts = ring_points(ring)
            d.append('M' + 'L'.join(fmt(x) + ',' + fmt(y) for x, y in pts) + 'Z')
            if i == 0:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                box = (min(xs), min(ys), max(xs), max(ys))
                area = (box[2] - box[0]) * (box[3] - box[1])
                if best is None or area > best[0]:
                    best = (area, box)
    x0, y0, x1, y1 = best[1]
    countries.append({
        'n': name,
        'c': [round((x0 + x1) / 2, 1), round((y0 + y1) / 2, 1)],
        's': [round(x1 - x0, 1), round(y1 - y0, 1)],
        'd': ''.join(d),
    })

countries.sort(key=lambda c: c['n'])
js = ('// Generated from Natural Earth 1:110m country outlines (public domain) via the\n'
      '// world-atlas package. Do not edit by hand. n = name, c = centre [x, y],\n'
      '// s = size [w, h], d = SVG path. Map is %d x %d units; x = (lon + 180) / 360 * %d,\n'
      '// y = (%d - lat) / %d * %d.\n'
      % (W, round(H), W, LAT_TOP, LAT_TOP - LAT_BOT, round(H)))
js += 'window.DF_WORLD = ' + json.dumps({'w': W, 'h': round(H, 1), 'latTop': LAT_TOP, 'latBot': LAT_BOT,
                                          'countries': countries}, ensure_ascii=True, separators=(',', ':')) + ';\n'
open(out, 'w', encoding='utf-8', newline='\n').write(js)
print(len(countries), 'countries,', len(js) // 1024, 'KB')
for n in ('Australia', 'New Zealand', 'Italy', 'United Kingdom'):
    c = next(c for c in countries if c['n'] == n)
    print(n, c['c'], c['s'])
