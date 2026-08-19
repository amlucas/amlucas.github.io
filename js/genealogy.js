// Interactive academic-genealogy viewer for the JSON described in
// source/blog/genealogy/. The direct lineage is a vertical spine, oldest
// ancestor at the top; each advisor's other students fan out beside them as
// dots. Hovering (or tapping) any node shows degree, year, university, thesis
// and a link to the Mathematics Genealogy Project; a few household names keep
// a permanent label. Co-advised students hang off their first advisor and a
// dashed curve reaches the second.
(function () {
  'use strict';

  const MGP_URL = 'https://www.mathgenealogy.org/id.php?id=';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Siblings famous enough to carry a permanent label; everyone else is a dot
  // until hovered.
  const LABELED = new Set([
    'ernst-mach', 'lise-meitner', 'walther-nernst', 'gustav-herglotz',
    'johann-loschmidt', 'marian-smoluchowski', 'hendrik-casimir',
    'hendrik-kramers', 'jan-tinbergen', 'samuel-goudsmit', 'johannes-burgers',
    'philippe-spalart', 'lorena-barba',
  ]);

  const measureCtx = document.createElement('canvas').getContext('2d');
  let markerUid = 0;

  function textWidth(text, font) {
    measureCtx.font = font;
    return measureCtx.measureText(text).width;
  }

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function lastName(name) {
    const parts = name.replace(/,.*$/, '').trim().split(/\s+/);
    return parts[parts.length - 1];
  }

  // ---- data shaping ------------------------------------------------------

  function shape(data) {
    const byId = new Map(data.people.map((p) => [p.id, p]));

    // Generation of each lineage member = longest advisor-path distance from
    // the root, so the Gruber/Maffei pair lands on its own shared layer.
    const depth = new Map();
    (function walk(id, d) {
      if ((depth.get(id) ?? -1) >= d) return;
      depth.set(id, d);
      for (const a of byId.get(id).advisors) {
        if (byId.get(a).in_lineage) walk(a, d + 1);
      }
    })(data.root, 0);

    const maxDepth = Math.max(...depth.values());
    const layers = [];        // oldest first
    for (let d = maxDepth; d >= 0; d--) {
      const ids = [...depth.keys()].filter((id) => depth.get(id) === d);
      ids.sort();             // deterministic order for the rare shared layer
      layers.push(ids);
    }

    // Fan of each lineage member: their students outside the lineage, hung
    // off the first listed advisor, oldest thesis first.
    const fans = new Map([...depth.keys()].map((id) => [id, []]));
    const coadvised = [];     // [siblingId, extraAdvisorId]
    for (const p of data.people) {
      if (p.in_lineage) continue;
      fans.get(p.advisors[0]).push(p.id);
      for (const a of p.advisors.slice(1)) coadvised.push([p.id, a]);
    }
    for (const fan of fans.values()) {
      fan.sort((x, y) => (byId.get(x).year ?? 1e4) - (byId.get(y).year ?? 1e4)
                         || byId.get(x).name.localeCompare(byId.get(y).name));
    }

    return { byId, layers, fans, coadvised, root: data.root };
  }

  // ---- layout + render ---------------------------------------------------

  const FONT_NAME = '600 14px Inter, -apple-system, sans-serif';
  const FONT_LABEL = '400 11.5px Inter, -apple-system, sans-serif';
  const FONT_YEAR = '400 11px ui-monospace, SFMono-Regular, monospace';

  // Advisor→student arrowheads. Ids are made unique per render so several
  // genealogies on one page cannot cross-reference each other's markers.
  function makeMarkers(svg) {
    const uid = ++markerUid;
    const defs = el('defs', {}, svg);
    // Open chevron heads (stroked, round-capped) rather than filled
    // triangles: the wings read as a continuation of the line itself, and
    // the vertex sits exactly on the line's end so nothing pokes through.
    for (const [id, cls] of [[`garrow-${uid}`, 'gmark'],
                             [`garrowacc-${uid}`, 'gmark-acc']]) {
      const m = el('marker', { id, markerWidth: 9, markerHeight: 9,
                               refX: 6.5, refY: 4.5, orient: 'auto',
                               markerUnits: 'userSpaceOnUse' }, defs);
      el('path', { d: 'M 1.5 1.5 L 6.5 4.5 L 1.5 7.5', class: cls }, m);
    }
    return { defs, uid, arrow: `url(#garrow-${uid})`,
             arrowAcc: `url(#garrowacc-${uid})` };
  }

  function render(container, model) {
    container.querySelectorAll('svg').forEach((s) => s.remove());
    const W = container.clientWidth;
    if (W < 100) return;
    const narrow = W < 560;

    // On narrow screens the graph is laid out at its natural width and pans
    // horizontally inside this wrapper; sibling fans then never wrap, so each
    // generation reads as one aligned line of dots.
    let scroller = container.querySelector('.genealogy-scroll');
    if (!scroller) {
      scroller = document.createElement('div');
      scroller.className = 'genealogy-scroll';
      container.appendChild(scroller);
      scroller.addEventListener('scroll', () => {
        unpin(container);
        hideCard(container);
      });
    }

    // On wide screens the names sit left of the spine, so the spine must sit
    // far enough right for the longest of them (Vega's) not to be clipped.
    const maxNameW = narrow ? 0 : Math.max(...model.layers.map(
      (layer) => textWidth(model.byId.get(layer[0]).name, FONT_NAME)));
    const spineX = narrow ? 16
      : Math.min(Math.max(0.34 * W, 210, maxNameW + 20),
                 Math.max(210, W - 280));
    const fanX0 = narrow ? 30 : spineX + 24;
    const lineH = 20;

    const svg = el('svg', { width: '100%', role: 'img',
      'aria-label': 'Academic genealogy: direct lineage with the other students of each advisor' });
    const { arrow, arrowAcc } = makeMarkers(svg);
    const gEdges = el('g', {}, svg);
    const gCoadv = el('g', {}, svg);
    const gNodes = el('g', {}, svg);

    const pos = new Map();    // id -> {x, y} of its node
    let y = 12;
    let maxRight = 0;         // rightmost drawn x, sets the pannable width

    for (const layer of model.layers) {
      const nodeY = y + 10;
      let rowBottom = nodeY + (narrow ? 8 : 22);
      let prevRight = 0;      // right edge of the previous node's texts

      layer.forEach((id, i) => {
        const p = model.byId.get(id);
        const x = narrow
          ? (i === 0 ? spineX : prevRight + 30)
          : spineX + i * 170;
        pos.set(id, { x, y: nodeY });

        // Node + name (+ year). Left of the node on wide screens, to its
        // right on narrow ones and for the second node of a shared layer.
        const g = el('g', { class: 'gspine' + (id === model.root ? ' groot' : ''),
                            tabindex: '0' }, gNodes);
        el('circle', { cx: x, cy: nodeY, r: 6 }, g);
        const onRight = narrow || i > 0;
        const tx = onRight ? x + 13 : x - 14;
        const anchor = onRight ? 'start' : 'end';
        const name = el('text', { x: tx, y: nodeY + 4, 'text-anchor': anchor,
                                  class: 'gname' }, g);
        name.textContent = p.name;
        const nameW = textWidth(p.name, FONT_NAME);
        prevRight = onRight ? tx + nameW : x + 7;
        if (p.year) {
          const yr = el('text', { class: 'gyear', 'text-anchor': anchor }, g);
          if (narrow) {
            yr.setAttribute('x', tx + nameW + 8);
            yr.setAttribute('y', nodeY + 4);
            prevRight += 8 + textWidth(String(p.year), FONT_YEAR);
          } else {
            yr.setAttribute('x', tx);
            yr.setAttribute('y', nodeY + 20);
          }
          yr.textContent = p.year;
        }
        maxRight = Math.max(maxRight, prevRight);
        wireCard(container, g, p.id, cardHtml(p), () => pos.get(id));
      });

      // This generation's siblings — the other students of its advisor(s) —
      // drawn on the same row as the lineage member, each reached by a
      // dashed connector dropping from the advisor in the row above.
      const advisors = [...new Set(layer.flatMap(
        (id) => model.byId.get(id).advisors
          .filter((a) => model.byId.get(a).in_lineage)))];
      const sibs = advisors.flatMap((a) => model.fans.get(a));
      sibs.sort((x, y2) => (model.byId.get(x).year ?? 1e4)
                           - (model.byId.get(y2).year ?? 1e4)
                           || model.byId.get(x).name
                                .localeCompare(model.byId.get(y2).name));
      if (sibs.length) {
        let fx = fanX0;
        let fy = narrow ? nodeY + 24 : nodeY;
        const lines = [{ y: fy, xs: [] }];
        for (const sid of sibs) {
          const s = model.byId.get(sid);
          const labeled = LABELED.has(sid);
          const label = labeled ? lastName(s.name) : '';
          const w = labeled ? 13 + textWidth(label, FONT_LABEL) + 14 : 16;
          if (!narrow && fx + w > W - 6 && fx > fanX0) {
            fx = fanX0; fy += lineH;
            lines.push({ y: fy, xs: [] });
          }
          const dx = fx + 5;
          lines[lines.length - 1].xs.push(dx);
          const gs = el('g', { class: 'gsib', tabindex: '0' }, gNodes);
          el('circle', { cx: dx, cy: fy, r: 4.5 }, gs);
          if (labeled) {
            const t = el('text', { x: fx + 13, y: fy + 3.5,
                                   class: 'glabel' }, gs);
            t.textContent = label;
          }
          pos.set(sid, { x: dx, y: fy });
          wireCard(container, gs, s.id, cardHtml(s), () => pos.get(sid));
          maxRight = Math.max(maxRight,
                              labeled ? fx + 13 + textWidth(label, FONT_LABEL)
                                      : fx + 10);
          fx += w;
        }
        rowBottom = Math.max(rowBottom, fy + 12);

        // Square connectors in the spine's own style: a horizontal rail
        // leaves the direct line halfway between advisor and student rows,
        // and a short drop lands on each dot. A wrapped dot line gets its
        // own rail halfway above it, fed by a stub along the spine.
        const sx = pos.get(layer[0]).x;
        let prevLevel = pos.get(advisors[0]).y;
        let prevRail = null;
        for (const ln of lines) {
          const railY = (prevLevel + ln.y) / 2;
          const maxX = Math.max(...ln.xs);
          const start = prevRail === null
            ? `M ${sx} ${railY}`
            : `M ${sx} ${prevRail} V ${railY}`;
          el('path', { class: 'gedge', d: `${start} H ${maxX}` }, gEdges);
          for (const x2 of ln.xs) {
            el('path', { class: 'gedge', 'marker-end': arrow,
                         d: `M ${x2} ${railY} V ${ln.y - 4.5}` }, gEdges);
          }
          prevLevel = ln.y;
          prevRail = railY;
        }
      }

      y = rowBottom + (narrow ? 18 : 14);
    }

    // Spine edges (drawn under the nodes). A shared x is a straight drop;
    // the Gruber/Maffei diamond takes a square elbow, bending on the same
    // halfway line the sibling rails use.
    for (const layer of model.layers) {
      for (const id of layer) {
        for (const a of model.byId.get(id).advisors) {
          if (!model.byId.get(a).in_lineage) continue;
          const from = pos.get(a), to = pos.get(id);
          const d = from.x === to.x
            ? `M ${from.x} ${from.y + 7} L ${to.x} ${to.y - 7}`
            : `M ${from.x} ${from.y + 7} V ${(from.y + to.y) / 2}` +
              ` H ${to.x} V ${to.y - 7}`;
          el('path', { d, class: 'gedge', 'marker-end': arrow }, gEdges);
        }
      }
    }

    // Dashed reach from a second advisor down to their co-advised student,
    // pointing at the student like every other edge.
    for (const [sid, aid] of model.coadvised) {
      const s = pos.get(sid), a = pos.get(aid);
      if (!s || !a) continue;
      el('path', { class: 'gcoadv', 'marker-end': arrowAcc,
                   d: `M ${a.x + 4} ${a.y + 8} C ${a.x + 30} ${(s.y + a.y) / 2},` +
                      ` ${s.x} ${(s.y + a.y) / 2}, ${s.x} ${s.y - 5}` },
         gCoadv);
    }

    // Content wider than the container (long sibling fans on a phone) keeps
    // its natural width and pans inside the scroller instead of wrapping.
    const contentW = Math.max(W, Math.ceil(maxRight) + 8);
    svg.setAttribute('viewBox', `0 0 ${contentW} ${y}`);
    svg.setAttribute('height', y);
    if (contentW > W) svg.style.width = contentW + 'px';
    svg.addEventListener('click', (e) => {
      if (e.target === svg) unpin(container);
    });
    scroller.appendChild(svg);
  }

  // ---- map ----------------------------------------------------------------
  // Renders the JSON baked by source/blog/genealogy/make_map.py: the lineage
  // as a chain of arcs across a North-Atlantic map, sibling flows as dashed
  // arcs, city dots sized by how many people took their degree there, and a
  // zoomed Central-Europe inset below (five lineage stops sit within 300 km
  // of Vienna). Land/frame geometry lives in a scale(k) group with
  // non-scaling strokes; dots, arcs and labels are drawn in pixel space so
  // text keeps its size when the figure resizes.

  function rOf(count) {
    return Math.min(12, 3.5 + 1.7 * Math.sqrt(count));
  }

  function toward(p, q, d) {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [p[0] + (q[0] - p[0]) / len * d, p[1] + (q[1] - p[1]) / len * d];
  }

  // Quadratic arc from p to q bowing north, ends trimmed back so the
  // arrowhead lands just outside the dots. Also returns the arc's midpoint,
  // where a caption can sit. A short leg (like Stanford→Pasadena, mostly
  // eaten by its dots' radii) is drawn straight: the leftover stub of a
  // curve reads as crooked and skews the arrowhead's tangent.
  function arcPath(p, q, bow, trimA, trimB) {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    if (len < 70) {
      const a = toward(p, q, trimA), b = toward(q, p, trimB);
      return {
        d: `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} ` +
           `L ${b[0].toFixed(1)} ${b[1].toFixed(1)}`,
        mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2],
      };
    }
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const c = [(p[0] + q[0]) / 2 + nx * bow * len,
               (p[1] + q[1]) / 2 + ny * bow * len];
    const a = toward(p, c, trimA), b = toward(q, c, trimB);
    return {
      d: `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} ` +
         `Q ${c[0].toFixed(1)} ${c[1].toFixed(1)} ` +
         `${b[0].toFixed(1)} ${b[1].toFixed(1)}`,
      mid: [0.25 * p[0] + 0.5 * c[0] + 0.25 * q[0],
            0.25 * p[1] + 0.5 * c[1] + 0.25 * q[1]],
    };
  }

  function placeCard(p) {
    const bits = [];
    bits.push(`<strong>${esc(p.name)}</strong> <span class="gcard-meta">` +
              `(${p.count} ${p.count === 1 ? 'degree' : 'degrees'})</span>`);
    if (p.unis.length) {
      bits.push(`<span class="gcard-meta">${esc(p.unis.join(' · '))}</span>`);
    }
    for (const [name, year, lineage] of p.people) {
      if (!lineage) continue;
      bits.push(`${esc(name)}${year ? ` — ${year}` : ''}`);
    }
    const others = p.people.filter((x) => !x[2]);
    if (others.length) {
      const names = others.slice(0, 6).map((x) => esc(x[0])).join(', ');
      const more = others.length > 6 ? `, +${others.length - 6} more` : '';
      const prefix = p.spine ? 'also: ' : '';
      bits.push(`<span class="gcard-meta">${prefix}${names}${more}</span>`);
    }
    return bits.join('<br>');
  }

  function renderMap(container, m) {
    container.querySelectorAll('svg').forEach((s) => s.remove());
    const W = container.clientWidth;
    if (W < 100) return;
    const k = W / m.main.w;
    // Below this scale the fixed-size labels start colliding in the Midwest
    // cluster; hide them and lean on the hover cards.
    const showLabels = k >= 0.66;
    const gap = 26;
    const ix = m.main.w - m.inset.w - 4;   // inset panel, under Europe
    const iy = m.main.h + gap;
    const totalH = iy + m.inset.h + 4;

    const svg = el('svg', { width: '100%', height: (totalH * k).toFixed(0),
      role: 'img', 'aria-label':
      'The genealogy on a map: Graz to Vienna to Leiden to the US to Zürich' });
    const { defs, uid, arrow, arrowAcc } = makeMarkers(svg);
    el('rect', { x: 0, y: 0, width: m.main.w, height: m.main.h },
       el('clipPath', { id: `gclipm-${uid}` }, defs));
    el('rect', { x: 0, y: 0, width: m.inset.w, height: m.inset.h },
       el('clipPath', { id: `gclipi-${uid}` }, defs));

    const byId = new Map(m.places.map((p) => [p.id, p]));
    const mainPx = (p) => [p.main[0] * k, p.main[1] * k];
    const insetPx = (p) => [(ix + p.inset[0]) * k, (iy + p.inset[1]) * k];

    // Land, drawn in map units under a scale(k) transform.
    const gm = el('g', { transform: `scale(${k})` }, svg);
    const gmLand = el('g', { 'clip-path': `url(#gclipm-${uid})` }, gm);
    for (const d of m.main.land) el('path', { d, class: 'gmap-land' }, gmLand);
    el('rect', { class: 'gmap-edge', x: 0, y: 0,
                 width: m.main.w, height: m.main.h }, gm);
    const [fx, fy, fw, fh] = m.main.frame;
    el('rect', { class: 'gmap-frame', x: fx, y: fy, width: fw, height: fh },
       gm);

    const gi = el('g',
      { transform: `translate(${ix * k} ${iy * k}) scale(${k})` }, svg);
    el('rect', { class: 'gmap-panel', x: 0, y: 0,
                 width: m.inset.w, height: m.inset.h }, gi);
    const giLand = el('g', { 'clip-path': `url(#gclipi-${uid})` }, gi);
    for (const d of m.inset.land) el('path', { d, class: 'gmap-land' },
                                     giLand);
    el('rect', { class: 'gmap-frame', x: 0, y: 0,
                 width: m.inset.w, height: m.inset.h }, gi);

    // Zoom-lens connectors, Europe frame -> inset panel corners.
    el('path', { class: 'gmap-connect',
                 d: `M ${fx * k} ${(fy + fh) * k} L ${ix * k} ${iy * k}` },
       svg);
    el('path', { class: 'gmap-connect',
                 d: `M ${(fx + fw) * k} ${(fy + fh) * k}` +
                    ` L ${(ix + m.inset.w) * k} ${iy * k}` }, svg);

    // Arcs. A leg whose two ends both live in the inset is drawn there;
    // everything else is drawn on the main map.
    const gLegs = el('g', {}, svg);
    const draw = (a, b, cls, marker) => {
      const A = byId.get(a), B = byId.get(b);
      const inInset = A.inset && B.inset;
      const p = inInset ? insetPx(A) : mainPx(A);
      const q = inInset ? insetPx(B) : mainPx(B);
      const rA = (!inInset && A.inset) ? 3 : rOf(A.count) * Math.min(1, k);
      const rB = (!inInset && B.inset) ? 3 : rOf(B.count) * Math.min(1, k);
      const arc = arcPath(p, q, 0.18, rA + 2, rB + 4);
      el('path', { class: cls, 'marker-end': marker, d: arc.d }, gLegs);
      return arc;
    };
    for (const [a, b] of m.sib_legs) draw(a, b, 'gmap-sib', arrow);
    for (const [a, b, label, dy] of m.spine_legs) {
      const arc = draw(a, b, 'gmap-spine', arrowAcc);
      if (label && showLabels) {
        const t = el('text', { class: 'gmap-cross', 'text-anchor': 'middle',
                               x: arc.mid[0].toFixed(1),
                               y: (arc.mid[1] + dy).toFixed(1) }, gLegs);
        t.textContent = label;
      }
    }

    // The Atlantic crossings also appear in the inset, as stubs clipped at
    // the panel's west edge on the same headings as the main-map arcs: the
    // line leaves Leiden climbing WNW (slope ≈ 0.28, the great-circle bow)
    // and is cropped headless at the edge; it re-enters descending ESE
    // (slope ≈ 0.21) with its chevron landing on Zürich.
    const leiden = byId.get('leiden'), zurich = byId.get('zurich');
    if (leiden?.inset && zurich?.inset) {
      const px0 = ix * k, py0 = iy * k;
      const clip = el('clipPath', { id: `gclips-${uid}` }, defs);
      el('rect', { x: px0, y: py0, width: m.inset.w * k,
                   height: m.inset.h * k }, clip);
      const gStub = el('g', { 'clip-path': `url(#gclips-${uid})` }, svg);
      const L = insetPx(leiden), Z = insetPx(zurich);
      const rL = rOf(leiden.count) * Math.min(1, k);
      const rZ = rOf(zurich.count) * Math.min(1, k);
      const xOut = px0 - 12;
      const out = [xOut, L[1] - 0.28 * (L[0] - xOut)];
      const a = toward(L, out, rL + 2);
      el('path', { class: 'gmap-spine',
                   d: `M ${a[0].toFixed(1)} ${a[1].toFixed(1)}` +
                      ` L ${out[0].toFixed(1)} ${out[1].toFixed(1)}` }, gStub);
      const start = [xOut, Z[1] - 0.206 * (Z[0] - xOut)];
      const b = toward(Z, start, rZ + 4);
      el('path', { class: 'gmap-spine', 'marker-end': arrowAcc,
                   d: `M ${start[0].toFixed(1)} ${start[1].toFixed(1)}` +
                      ` L ${b[0].toFixed(1)} ${b[1].toFixed(1)}` }, gStub);
      if (showLabels) {
        // Margin notes outside the panel, at the height each line crosses
        // its edge.
        const capX = px0 - 8;
        for (const [label, y] of [
            ['to America', L[1] - 0.28 * (L[0] - px0) + 4],
            ['from America', Z[1] - 0.206 * (Z[0] - px0) + 4]]) {
          const t = el('text', { class: 'gmap-cross', 'text-anchor': 'end',
                                 x: capX.toFixed(1), y: y.toFixed(1) }, svg);
          t.textContent = label;
        }
      }
    }

    // Dots and labels, in pixel space. European places get a small uniform
    // dot on the main map (the inset carries their full-size dot).
    const gDots = el('g', {}, svg);
    const dot = (p, at, mini) => {
      const attrs = { class: 'gmap-place' +
        (mini ? ' gmap-mini' : p.spine ? '' : ' gmap-sec') +
        (!mini && p.id === m.root_place ? ' groot' : '') };
      if (!mini) attrs.tabindex = '0';
      const g = el('g', attrs, gDots);
      el('circle', { cx: at[0], cy: at[1],
                     r: mini ? 2.5 : rOf(p.count) * Math.min(1, k) }, g);
      if (!mini) {
        wireCard(container, g, p.id, placeCard(p),
                 () => ({ x: at[0], y: at[1] }));
      }
      return g;
    };
    for (const p of m.places) {
      dot(p, mainPx(p), !!p.inset);
      if (p.inset) dot(p, insetPx(p), false);
      const lab = p.inset ? p.ilabel : p.label;
      if (!lab || !showLabels) continue;
      const at = p.inset ? insetPx(p) : mainPx(p);
      const [dx, dy, anchor, leader] = lab;
      const t = el('text', { x: at[0] + dx, y: at[1] + dy + 4,
                             'text-anchor': anchor, class: 'gplace' }, gDots);
      t.textContent = p.name;
      if (p.years) {
        const ty = el('text', { x: at[0] + dx, y: at[1] + dy + 17,
                                'text-anchor': anchor, class: 'gyear' },
                      gDots);
        ty.textContent = p.years;
      }
      if (leader) {
        // Thin line from the dot's edge to the near side of the text block.
        const end = anchor === 'middle'
          ? [dx, dy < 0 ? dy + (p.years ? 22 : 9) : dy - 9]
          : [dx + (anchor === 'start' ? -5 : 5), dy];
        const r = rOf(p.count) * Math.min(1, k) + 2;
        const len = Math.hypot(end[0], end[1]) || 1;
        el('path', { class: 'gmap-leader',
                     d: `M ${(at[0] + end[0] / len * r).toFixed(1)}` +
                        ` ${(at[1] + end[1] / len * r).toFixed(1)}` +
                        ` L ${(at[0] + end[0]).toFixed(1)}` +
                        ` ${(at[1] + end[1]).toFixed(1)}` }, gDots);
      }
    }

    // Legend, in the space left of the inset panel.
    if (showLabels) {
      const lx = 16, lw = 34;
      let ly = iy * k + 22;
      const legend = el('g', {}, svg);
      const row = (mk, cls, text) => {
        el('path', { class: cls, 'marker-end': mk,
                     d: `M ${lx} ${ly} H ${lx + lw}` }, legend);
        const t = el('text', { x: lx + lw + 12, y: ly + 4,
                               class: 'glabel' }, legend);
        t.textContent = text;
        ly += 24;
      };
      row(arrowAcc, 'gmap-spine', 'the direct line of advisors');
      row(arrow, 'gmap-sib', 'their other students');
      el('circle', { class: 'glegend-dot', cx: lx + 8, cy: ly, r: 4 },
         legend);
      el('circle', { class: 'glegend-dot', cx: lx + 26, cy: ly, r: 8 },
         legend);
      const t = el('text', { x: lx + lw + 12, y: ly + 4, class: 'glabel' },
                   legend);
      t.textContent = 'cities sized by degrees earned there';
    }

    svg.addEventListener('click', (e) => {
      if (e.target === svg || e.target.classList.contains('gmap-land') ||
          e.target.classList.contains('gmap-panel')) {
        unpin(container);
      }
    });
    container.appendChild(svg);
  }

  // ---- detail card -------------------------------------------------------

  function cardHtml(p) {
    const bits = [];
    const life = (p.born || p.died)
      ? ` <span class="gcard-meta">(${p.born ?? '?'}–${p.died ?? ''})</span>`
      : '';
    bits.push(`<strong>${esc(p.name)}</strong>${life}`);
    const meta = [p.degree, p.year, p.university].filter(Boolean).join(' · ');
    if (meta) bits.push(`<span class="gcard-meta">${esc(meta)}</span>`);
    if (p.thesis) bits.push(`<em class="gcard-thesis">“${esc(p.thesis)}”</em>`);
    if (p.advisors.length > 1) {
      bits.push(`<span class="gcard-meta">co-advised</span>`);
    }
    if (p.mgp_id) {
      bits.push(`<a href="${MGP_URL}${p.mgp_id}" target="_blank"
        rel="noopener">Mathematics Genealogy entry →</a>`);
    }
    return bits.join('<br>');
  }

  function getCard(container) {
    let card = container.querySelector('.genealogy-card');
    if (!card) {
      card = document.createElement('div');
      card.className = 'genealogy-card';
      container.appendChild(card);
    }
    return card;
  }

  function showCard(container, html, at, pinned) {
    const card = getCard(container);
    card.innerHTML = html;
    card.classList.toggle('pinned', pinned);
    card.style.display = 'block';
    const W = container.clientWidth;
    const cw = Math.min(320, W - 12);
    // The node's x is in the graph's own coordinates; a panned scroller
    // shifts where that lands within the container.
    const x = at.x - (container.querySelector('.genealogy-scroll')?.scrollLeft
                      ?? 0);
    card.style.maxWidth = cw + 'px';
    card.style.left = Math.max(4, Math.min(x + 12, W - cw - 4)) + 'px';
    card.style.top = (at.y + 14) + 'px';
    // Near the bottom edge the card would spill out of the figure; flip it
    // above the node instead (measurable only once displayed).
    const svg = container.querySelector('svg');
    if (svg && at.y + 14 + card.offsetHeight > svg.clientHeight + 30) {
      card.style.top = Math.max(4, at.y - card.offsetHeight - 12) + 'px';
    }
  }

  function hideCard(container) {
    const card = container.querySelector('.genealogy-card');
    if (card && !card.classList.contains('pinned')) card.style.display = 'none';
  }

  function unpin(container) {
    const card = container.querySelector('.genealogy-card');
    if (card) { card.classList.remove('pinned'); card.style.display = 'none'; }
    container._pinnedId = null;
  }

  function wireCard(container, g, key, html, getAt) {
    g.addEventListener('mouseenter', () => {
      if (!container._pinnedId) showCard(container, html, getAt(), false);
    });
    g.addEventListener('mouseleave', () => hideCard(container));
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (container._pinnedId === key) { unpin(container); return; }
      container._pinnedId = key;
      showCard(container, html, getAt(), true);
    });
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.click(); }
    });
  }

  // ---- boot --------------------------------------------------------------

  function status(container, msg) {
    let s = container.querySelector('.genealogy-status');
    if (!s) {
      s = document.createElement('div');
      s.className = 'genealogy-status';
      container.appendChild(s);
    }
    s.textContent = msg;
  }

  function init(container) {
    const src = container.dataset.src;
    if (!src) return;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        container.querySelector('.genealogy-status')?.remove();
        const isMap = container.classList.contains('genealogy-map');
        const model = isMap ? data : shape(data);
        const renderFn = isMap ? renderMap : render;
        const draw = () => { unpin(container); renderFn(container, model); };
        draw();
        let lastW = container.clientWidth;
        new ResizeObserver(() => {
          if (container.clientWidth !== lastW) {
            lastW = container.clientWidth;
            draw();
          }
        }).observe(container);
        // Text was measured before the webfonts were ready; measure again.
        if (document.fonts?.ready) document.fonts.ready.then(draw);
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') unpin(container);
        });
      })
      .catch((err) => {
        status(container, 'Could not load the genealogy.');
        console.error(err);
      });
  }

  function boot() {
    document.querySelectorAll('.genealogy').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
