// Interactive viewer for a triangle mesh packed by tools/pack_mesh_anim.py
// (a trajectory) or tools/pack_mesh.py (a single shape).
//
// Each frame is reconstructed on the fly from a handful of POD modes, smooth
// vertex normals are recomputed, and the result is drawn as a shaded surface
// with its triangle edges laid over it. Drag to orbit, scroll to zoom, scrub or
// play to move in time. A single-frame blob has no time axis, so its playback
// controls are dropped and the canvas is only redrawn when the camera moves.
(function () {
  'use strict';

  const VERT_SRC = `#version 300 es
  in vec3 aPos;
  in vec3 aNormal;
  // Normalized uint16, so it arrives as the colour-map coordinate directly.
  in float aField;
  uniform mat4 uProj;
  uniform mat4 uView;
  uniform float uWire;
  out vec3 vNormal;
  out vec3 vEye;
  out float vField;
  void main() {
    vec4 eye = uView * vec4(aPos, 1.0);
    vEye = eye.xyz;
    vNormal = mat3(uView) * aNormal;
    vField = aField;
    gl_Position = uProj * eye;
    // The edges share their vertices with the surface, so they would z-fight
    // with it. Pull the line pass a fixed step toward the viewer in NDC. A
    // polygon offset cannot do this job: its slope term vanishes exactly where
    // the surface faces the camera, so the edges drop out in patches there.
    gl_Position.z -= uWire * 0.0015 * gl_Position.w;
  }`;

  const FRAG_SRC = `#version 300 es
  precision highp float;
  in vec3 vNormal;
  in vec3 vEye;
  in float vField;
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform float uWire;
  // 0 shades with uColor; 1 shades with the colour map sampled at vField.
  uniform float uUseField;
  uniform sampler2D uColorMap;
  out vec4 outColor;
  void main() {
    // The wireframe pass reuses this program: flat lines, no shading. Kept
    // translucent so a fine mesh reads as a mesh instead of a black mass.
    if (uWire > 0.5) {
      outColor = vec4(0.10, 0.10, 0.13, 0.45);
      return;
    }
    // Two-sided shading: the membrane is closed, but a clipped near plane or a
    // flipped triangle should never turn black.
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 l = normalize(uLightDir);
    vec3 v = normalize(-vEye);
    float diff = max(dot(n, l), 0.0);
    float spec = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);
    // Rim term to keep the silhouette readable against a light background.
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 base = uColor;
    if (uUseField > 0.5) {
      base = texture(uColorMap, vec2(clamp(vField, 0.0, 1.0), 0.5)).rgb;
      // A colour map carries the quantity, so keep the shading gentler: heavy
      // diffuse falloff would read as a change in value rather than in slope.
      vec3 c = base * (0.62 + 0.42 * diff) + vec3(0.16) * spec;
      outColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 1.6)), 1.0);
      return;
    }
    vec3 c = base * (0.38 + 0.72 * diff) + vec3(0.30) * spec + base * 0.25 * rim;
    outColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 1.6)), 1.0);
  }`;

  // Viridis, sampled from matplotlib at 32 stops. Uploaded as a 32x1 texture
  // with linear filtering, so the GPU does the interpolation between stops.
  const VIRIDIS = new Uint8Array([
    68,1,84, 71,13,96, 72,24,106, 72,35,116, 71,46,124, 69,56,130, 66,65,134, 62,74,137,
    58,84,140, 54,93,141, 50,101,142, 46,109,142, 43,117,142, 40,125,142, 37,132,142, 34,140,141,
    31,148,140, 30,156,137, 32,163,134, 37,171,130, 46,179,124, 58,186,118, 72,193,110, 88,199,101,
    108,205,90, 127,211,78, 147,215,65, 168,219,52, 192,223,37, 213,226,26, 234,229,26, 253,231,37,
  ]);

  // RdBu reversed, for a field that straddles zero: the packer gives those a
  // symmetric range, so the pale middle of the map lands exactly on zero.
  const RDBU = new Uint8Array([
    5,48,97, 14,65,121, 23,82,144, 31,99,168, 43,115,179, 54,129,186, 64,143,193, 86,159,201,
    113,176,211, 138,192,219, 160,204,226, 179,214,232, 202,225,238, 216,233,241, 228,238,244, 240,244,246,
    248,242,239, 250,233,223, 252,224,208, 252,213,191, 249,194,167, 246,177,145, 241,158,125, 232,137,108,
    221,112,89, 211,90,74, 200,68,64, 189,45,53, 174,23,42, 150,15,39, 127,8,35, 103,0,31,
  ]);

  const isDiverging = (f) => f.min < 0 && f.max > 0;

  function colorMapTexture(gl, stops) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, stops.length / 3, 1, 0,
                  gl.RGB, gl.UNSIGNED_BYTE, stops);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function colorMapGradient(map) {
    const out = [];
    const n = map.length / 3;
    for (let i = 0; i < n; i++) {
      const p = Math.round((i / (n - 1)) * 100);
      out.push(`rgb(${map[i * 3]},${map[i * 3 + 1]},${map[i * 3 + 2]}) ${p}%`);
    }
    return `linear-gradient(to right, ${out.join(', ')})`;
  }

  // 'f_bending' -> 'Bending', 'ade' -> 'ADE'. Short words are read as acronyms.
  function fieldLabel(name) {
    const bare = name.replace(/^(f|force)_/, '');
    return bare.split(/[_\s]+/).map((w) => (
      w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)
    )).join(' ');
  }

  function formatValue(v) {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) {
      return v.toExponential(1).replace('e+', 'e').replace('e-0', 'e-');
    }
    return String(Number(v.toPrecision(3)));
  }

  // How close the camera may get to either pole. Small enough that the reader
  // reaches a face-on view; large enough that cross(up, viewDir) stays sane.
  const POLE_LIMIT = Math.PI / 2 - 0.002;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  // --- little matrix helpers (column-major, like GL wants) ---------------------

  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const d = near - far;
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / d, -1,
      0, 0, (2 * far * near) / d, 0,
    ]);
  }

  function lookAt(eye, target, up) {
    const z = norm3(sub3(eye, target));
    const x = norm3(cross3(up, z));
    const y = cross3(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
    ]);
  }

  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  function norm3(a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  // --- data ------------------------------------------------------------------

  async function loadMesh(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    // The blob is stored gzipped. Servers that already decompress it for us
    // (Content-Encoding: gzip) hand back plain bytes, so sniff the magic.
    let buf = await res.arrayBuffer();
    const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    if (head[0] === 0x1f && head[1] === 0x8b) {
      const stream = new Response(buf).body.pipeThrough(
        new DecompressionStream('gzip'));
      buf = await new Response(stream).arrayBuffer();
    }

    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
                                      dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'MSHA') throw new Error(`${url}: bad magic ${magic}`);

    const nVerts = dv.getUint32(8, true);
    const nFaces = dv.getUint32(12, true);
    const nFrames = dv.getUint32(16, true);
    const nModes = dv.getUint32(20, true);
    const fps = dv.getFloat32(24, true);
    // Files written before scalar fields existed have a zero here, so they
    // simply report no fields.
    const nFields = dv.getUint32(28, true);

    let off = 32;
    const faces = new Uint16Array(buf, off, nFaces * 3);
    off += nFaces * 6;
    off += off % 4 ? 4 - (off % 4) : 0;
    const mean = new Float32Array(buf, off, nVerts * 3);
    off += nVerts * 12;
    const modeScale = new Float32Array(buf, off, nModes);
    off += nModes * 4;
    const modes = new Int16Array(buf, off, nModes * nVerts * 3);
    off += nModes * nVerts * 6;
    off += off % 4 ? 4 - (off % 4) : 0;
    const coefs = new Float32Array(buf, off, nFrames * nModes);
    off += nFrames * nModes * 4;

    // Scalar fields: a 32-byte name and a float range each, then every value
    // quantized to uint16 across (field, frame, vertex).
    const fields = [];
    if (nFields) {
      off += off % 4 ? 4 - (off % 4) : 0;
      const NAME_BYTES = 32;
      const metaAt = off;
      const dataAt = off + nFields * (NAME_BYTES + 8);
      for (let i = 0; i < nFields; i++) {
        const at = metaAt + i * (NAME_BYTES + 8);
        let name = '';
        for (let c = 0; c < NAME_BYTES; c++) {
          const b = dv.getUint8(at + c);
          if (!b) break;
          name += String.fromCharCode(b);
        }
        fields.push({
          name,
          min: dv.getFloat32(at + NAME_BYTES, true),
          max: dv.getFloat32(at + NAME_BYTES + 4, true),
          values: new Uint16Array(buf, dataAt + i * nFrames * nVerts * 2,
                                  nFrames * nVerts),
        });
      }
    }

    return { nVerts, nFaces, nFrames, nModes, fps, faces, mean, modeScale,
             modes, coefs, fields };
  }

  // --- per-frame geometry ----------------------------------------------------

  function reconstruct(m, frame, out) {
    const n = m.nVerts * 3;
    out.set(m.mean);
    for (let k = 0; k < m.nModes; k++) {
      const a = m.coefs[frame * m.nModes + k] * m.modeScale[k];
      if (a === 0) continue;
      const base = k * n;
      for (let i = 0; i < n; i++) out[i] += a * m.modes[base + i];
    }
  }

  function vertexNormals(pos, faces, out) {
    out.fill(0);
    for (let t = 0; t < faces.length; t += 3) {
      const i = faces[t] * 3, j = faces[t + 1] * 3, k = faces[t + 2] * 3;
      const ux = pos[j] - pos[i], uy = pos[j + 1] - pos[i + 1], uz = pos[j + 2] - pos[i + 2];
      const vx = pos[k] - pos[i], vy = pos[k + 1] - pos[i + 1], vz = pos[k + 2] - pos[i + 2];
      // Un-normalized cross product: area-weighting the sum is what makes the
      // shading smooth across triangles of different size.
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      out[i] += nx; out[i + 1] += ny; out[i + 2] += nz;
      out[j] += nx; out[j + 1] += ny; out[j + 2] += nz;
      out[k] += nx; out[k + 1] += ny; out[k + 2] += nz;
    }
    for (let i = 0; i < out.length; i += 3) {
      const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
      out[i] /= l; out[i + 1] /= l; out[i + 2] /= l;
    }
  }

  function edgeIndices(faces) {
    // Unique undirected edges, so shared edges are not drawn twice.
    const seen = new Set();
    const out = [];
    for (let t = 0; t < faces.length; t += 3) {
      const a = faces[t], b = faces[t + 1], c = faces[t + 2];
      const pairs = [[a, b], [b, c], [c, a]];
      for (const [i, j] of pairs) {
        const lo = Math.min(i, j), hi = Math.max(i, j);
        const key = lo * 65536 + hi;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(lo, hi);
        }
      }
    }
    return new Uint16Array(out);
  }

  function boundingRadius(m) {
    // Largest distance from the origin over all frames, from the modes' worst
    // case: enough to pick a camera distance that never clips.
    let r = 0;
    const pos = new Float32Array(m.nVerts * 3);
    for (let f = 0; f < m.nFrames; f++) {
      reconstruct(m, f, pos);
      for (let i = 0; i < pos.length; i += 3) {
        r = Math.max(r, Math.hypot(pos[i], pos[i + 1], pos[i + 2]));
      }
    }
    return r;
  }

  // --- viewer ----------------------------------------------------------------

  function init(root) {
    const canvas = root.querySelector('canvas');
    const slider = root.querySelector('.mesh-anim-slider');
    const button = root.querySelector('.mesh-anim-play');
    const status = root.querySelector('.mesh-anim-status');
    const say = (msg) => { if (status) status.textContent = msg; };

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!gl) {
      say('This visualization needs WebGL2.');
      return;
    }

    loadMesh(root.dataset.src).then((m) => {
      say('');
      // A static shape has nothing to scrub through; a viewer emitted by
      // {{mesh(...)}} has no controls to begin with.
      const animated = m.nFrames > 1 && slider && button;
      if (animated) {
        slider.max = String(m.nFrames - 1);
        slider.disabled = false;
        button.disabled = false;
      } else {
        // Nothing to scrub through; the bar may still earn its keep below if
        // the blob carries scalar fields to switch between.
        if (slider) slider.remove();
        if (button) button.remove();
      }

      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('link: ' + gl.getProgramInfoLog(prog));
      }
      gl.useProgram(prog);

      const pos = new Float32Array(m.nVerts * 3);
      const nrm = new Float32Array(m.nVerts * 3);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pos.byteLength, gl.DYNAMIC_DRAW);
      const aPos = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      const nrmBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
      gl.bufferData(gl.ARRAY_BUFFER, nrm.byteLength, gl.DYNAMIC_DRAW);
      const aNormal = gl.getAttribLocation(prog, 'aNormal');
      gl.enableVertexAttribArray(aNormal);
      gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

      // One normalized uint16 per vertex: the active field's values for the
      // current frame. Left disabled when the blob carries no fields, in which
      // case aField reads as the default 0 and nothing samples the colour map.
      const fieldBuf = gl.createBuffer();
      const aField = gl.getAttribLocation(prog, 'aField');
      if (m.fields.length) {
        gl.bindBuffer(gl.ARRAY_BUFFER, fieldBuf);
        gl.bufferData(gl.ARRAY_BUFFER, m.nVerts * 2, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aField);
        gl.vertexAttribPointer(aField, 1, gl.UNSIGNED_SHORT, true, 0, 0);
      }

      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.faces, gl.STATIC_DRAW);

      const uProj = gl.getUniformLocation(prog, 'uProj');
      const uView = gl.getUniformLocation(prog, 'uView');
      const uWire = gl.getUniformLocation(prog, 'uWire');
      const uUseField = gl.getUniformLocation(prog, 'uUseField');
      const color = (root.dataset.color || '0.80,0.25,0.25').split(',').map(Number);
      gl.uniform3fv(gl.getUniformLocation(prog, 'uColor'), color);
      gl.uniform3fv(gl.getUniformLocation(prog, 'uLightDir'), [0.35, 0.45, 0.82]);
      gl.uniform1f(uUseField, 0);
      let seqTex = null;
      let divTex = null;
      if (m.fields.length) {
        gl.activeTexture(gl.TEXTURE0);
        seqTex = colorMapTexture(gl, VIRIDIS);
        divTex = colorMapTexture(gl, RDBU);
        gl.uniform1i(gl.getUniformLocation(prog, 'uColorMap'), 0);
      }
      gl.enable(gl.DEPTH_TEST);

      // The edges are part of every frame, so build the list up front.
      const edgeIdx = edgeIndices(m.faces);
      const edgeCount = edgeIdx.length;
      const edgeBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edgeIdx, gl.STATIC_DRAW);

      // The lines blend over the surface, but the alpha channel stays opaque so
      // the page background never shows through a lit pixel.
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
                           gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const radius = boundingRadius(m);
      const cam = { yaw: -Math.PI / 2, pitch: 0.22, dist: radius * 3.4 };
      let frame = 0;
      // Index into m.fields, or -1 for the plain shaded surface.
      let field = -1;
      let uploadedField = -2;
      let playing = animated && root.dataset.autoplay !== 'false';
      let uploaded = -1;
      let last = 0;
      // Set whenever the camera or the frame changes. A static viewer would
      // otherwise re-render an identical image sixty times a second, which is
      // wasteful once a row of them shares the page.
      let dirty = true;

      if (animated) button.textContent = playing ? 'Pause' : 'Play';

      // One button per scalar field, plus 'Shape' to drop back to the plain
      // surface, and a colour bar labelled with the field's range.
      const controls = root.querySelector('.mesh-anim-controls');
      if (m.fields.length && controls) {
        const group = document.createElement('div');
        group.className = 'mesh-anim-fields';

        const legend = document.createElement('div');
        legend.className = 'mesh-anim-legend';
        legend.innerHTML =
          '<span class="mesh-anim-legend-min"></span>'
          + '<span class="mesh-anim-legend-bar"></span>'
          + '<span class="mesh-anim-legend-max"></span>';
        const legendBar = legend.querySelector('.mesh-anim-legend-bar');
        canvas.insertAdjacentElement('afterend', legend);

        const buttons = [];
        const select = (i) => {
          field = i;
          gl.uniform1f(uUseField, i >= 0 ? 1 : 0);
          buttons.forEach((b, k) => {
            const on = k - 1 === i;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', String(on));
          });
          legend.hidden = i < 0;
          if (i >= 0) {
            const f = m.fields[i];
            const div = isDiverging(f);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, div ? divTex : seqTex);
            legendBar.style.background = colorMapGradient(div ? RDBU : VIRIDIS);
            legend.querySelector('.mesh-anim-legend-min').textContent =
              formatValue(f.min);
            legend.querySelector('.mesh-anim-legend-max').textContent =
              formatValue(f.max);
          }
          dirty = true;
        };
        const addButton = (label, idx) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'mesh-anim-field';
          b.textContent = label;
          b.setAttribute('aria-pressed', 'false');
          b.addEventListener('click', () => select(idx));
          group.appendChild(b);
          buttons.push(b);
        };
        addButton('Shape', -1);
        m.fields.forEach((f, i) => addButton(fieldLabel(f.name), i));
        controls.appendChild(group);
        // Open on the first field: showing the quantity is the whole point.
        select(0);
      }
      // A hint over the canvas, because nothing else says the thing is
      // interactive: the grab cursor is easy to miss and invisible on a phone.
      // It goes away for good on the first gesture.
      const coarse = !!(window.matchMedia
                        && window.matchMedia('(pointer: coarse)').matches);
      const hint = document.createElement('div');
      hint.className = 'mesh-anim-hint';
      hint.textContent = coarse ? 'Drag to rotate · pinch to zoom'
                                : 'Drag to rotate · scroll to zoom';
      root.appendChild(hint);
      let hintTimer = 0;
      const dropHint = () => {
        if (!hint.isConnected) return;
        clearTimeout(hintTimer);
        hint.classList.add('is-gone');
        // Let the fade finish, then stop paying for the node at all.
        setTimeout(() => hint.remove(), 500);
      };
      // Fades on its own too, so it never sits on top of the figure for good.
      hintTimer = setTimeout(dropHint, 5000);

      // Full screen, for a mesh that deserves more than a column of text. The
      // Fullscreen API is used where it works on an ordinary element; iPhone
      // Safari allows it only for <video>, so there is a CSS fallback that pins
      // the viewer over the page instead. Same layout class either way.
      if (controls) {
        const full = document.createElement('button');
        full.type = 'button';
        full.className = 'mesh-anim-full';
        // Icon only: the bar already carries a button per field, and the words
        // "Full screen" crowd it in a narrow row cell.
        full.innerHTML =
          '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">'
          + '<path fill="none" stroke="currentColor" stroke-width="1.6" '
          + 'd="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4"/></svg>';
        full.title = 'Full screen';
        full.setAttribute('aria-label', 'Full screen');
        const apiEnabled = !!(document.fullscreenEnabled
                              || document.webkitFullscreenEnabled);
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        const useApi = apiEnabled && request && exit;

        let pinned = false;      // the fallback's own idea of being full screen
        const current = () => (useApi
          ? (document.fullscreenElement || document.webkitFullscreenElement)
          : (pinned ? root : null));

        // Also runs on fullscreenchange, so pressing Escape keeps the label and
        // the layout class in step with reality however the state changed.
        const synced = () => {
          const on = current() === root;
          root.classList.toggle('is-fullscreen', on);
          const label = on ? 'Exit full screen' : 'Full screen';
          full.title = label;
          full.setAttribute('aria-label', label);
          full.setAttribute('aria-pressed', String(on));
          dirty = true;
        };

        const onKey = (e) => { if (e.key === 'Escape') setPinned(false); };
        function setPinned(on) {
          pinned = on;
          root.classList.toggle('is-pinned', on);
          document.body.classList.toggle('mesh-anim-pinned', on);
          if (on) document.addEventListener('keydown', onKey);
          else document.removeEventListener('keydown', onKey);
          synced();
        }

        full.addEventListener('click', () => {
          if (!useApi) {
            setPinned(!pinned);
            return;
          }
          if (current() === root) exit.call(document);
          else request.call(root);
        });
        controls.appendChild(full);

        document.addEventListener('fullscreenchange', synced);
        document.addEventListener('webkitfullscreenchange', synced);
      }

      // A static shape with no fields has nothing to put in the bar.
      if (controls && !controls.children.length) controls.remove();

      function upload() {
        if (uploaded !== frame) {
          uploaded = frame;
          reconstruct(m, frame, pos);
          vertexNormals(pos, m.faces, nrm);
          gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
          gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, nrm);
          // Whatever field slice is on the GPU belongs to the previous frame.
          uploadedField = -2;
        }
        if (field >= 0 && uploadedField !== field) {
          uploadedField = field;
          const values = m.fields[field].values;
          gl.bindBuffer(gl.ARRAY_BUFFER, fieldBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0,
            values.subarray(frame * m.nVerts, (frame + 1) * m.nVerts));
        }
      }

      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(canvas.clientWidth * dpr);
        const h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          dirty = true;
        }
      }

      function draw(now) {
        if (playing && last) {
          const advance = ((now - last) / 1000) * m.fps;
          if (advance >= 1) {
            frame = (frame + Math.floor(advance)) % m.nFrames;
            slider.value = String(frame);
            last = now;
            dirty = true;
          }
        } else if (playing) {
          last = now;
        }

        resize();
        if (!dirty) {
          requestAnimationFrame(gate);
          return;
        }
        dirty = false;
        upload();
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const cp = Math.cos(cam.pitch);
        const eye = [
          cam.dist * cp * Math.cos(cam.yaw),
          cam.dist * cp * Math.sin(cam.yaw),
          cam.dist * Math.sin(cam.pitch),
        ];
        const aspect = canvas.width / Math.max(canvas.height, 1);
        // The mesh is centered, so it spans cam.dist +/- radius. Bracket it
        // snugly: a near plane of cam.dist - 2 * radius goes negative once the
        // reader zooms in, which makes the projection nonsense and the canvas
        // blank. The 1.05 margin also buys depth precision.
        const near = Math.max(cam.dist - radius * 1.05, radius * 0.01);
        const far = cam.dist + radius * 1.05;
        // The vertical field of view is the fixed one, so a canvas taller than
        // it is wide would clip the mesh left and right -- which is exactly what
        // full screen on a phone gives you. Widen it so the horizontal opening
        // never shrinks below the landscape case.
        const fovy = aspect < 1
          ? 2 * Math.atan(Math.tan(0.62 / 2) / aspect)
          : 0.62;
        gl.uniformMatrix4fv(uProj, false, perspective(fovy, aspect, near, far));
        gl.uniformMatrix4fv(uView, false, lookAt(eye, [0, 0, 0], [0, 0, 1]));

        // Surface first, then its edges, which the vertex shader nudges toward
        // the viewer so they win the depth test. Edges on the far side stay
        // hidden because the depth test still rejects them.
        gl.uniform1f(uWire, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.drawElements(gl.TRIANGLES, m.faces.length, gl.UNSIGNED_SHORT, 0);
        gl.uniform1f(uWire, 1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuf);
        gl.drawElements(gl.LINES, edgeCount, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(gate);
      }

      // Only spend frames on a viewer the reader can actually see.
      let visible = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
          visible = entries[0].isIntersecting;
          if (visible) dirty = true;
          else last = 0;
        }, { threshold: 0 }).observe(canvas);
      }
      const gate = (now) => (visible ? draw(now) : requestAnimationFrame(gate));

      if (animated) {
        slider.addEventListener('input', () => {
          frame = Number(slider.value);
          playing = false;
          dirty = true;
          button.textContent = 'Play';
        });
        button.addEventListener('click', () => {
          playing = !playing;
          last = 0;
          dirty = true;
          button.textContent = playing ? 'Pause' : 'Play';
        });
      }

      function zoomBy(factor) {
        // The clamp keeps the camera outside the bounding sphere, which is also
        // what keeps the near plane positive; see the projection above.
        cam.dist = Math.max(radius * 1.6,
                            Math.min(radius * 9, cam.dist * factor));
        dirty = true;
      }

      // Every active pointer, so one finger orbits and two pinch to zoom. A
      // touch device has no wheel, so without the second case there is no way
      // to zoom at all on a phone.
      const pointers = new Map();
      let pinch = 0;

      function pinchSpan() {
        const [a, b] = [...pointers.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
      }

      canvas.addEventListener('pointerdown', (e) => {
        dropHint();
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        // Capturing per pointer keeps a drag alive past the canvas edge. It
        // throws for a synthetic id, which only matters to test harnesses.
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        if (pointers.size === 2) pinch = pinchSpan();
      });

      canvas.addEventListener('pointermove', (e) => {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size >= 2) {
          const span = pinchSpan();
          // Fingers apart -> span grows -> ratio below one -> camera moves in.
          if (pinch > 0 && span > 0) zoomBy(pinch / span);
          pinch = span;
          return;
        }

        cam.yaw -= (e.clientX - prev.x) * 0.008;
        // Stop just short of the poles, where the view direction would be
        // parallel to the up vector and the camera basis degenerate. The old
        // limit of 1.45 rad left the reader 7 degrees shy of looking straight
        // down the axis, which is exactly the view a flat cell needs.
        cam.pitch = Math.max(-POLE_LIMIT, Math.min(POLE_LIMIT,
          cam.pitch + (e.clientY - prev.y) * 0.008));
        dirty = true;
      });

      const endPointer = (e) => {
        pointers.delete(e.pointerId);
        // Lifting one finger of a pinch hands control back to the other, whose
        // stored position is current, so the orbit resumes without a jump.
        pinch = pointers.size === 2 ? pinchSpan() : 0;
      };
      canvas.addEventListener('pointerup', endPointer);
      canvas.addEventListener('pointercancel', endPointer);

      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        dropHint();
        zoomBy(Math.exp(e.deltaY * 0.001));
      }, { passive: false });

      requestAnimationFrame(gate);
    }).catch((err) => {
      say('Could not load the mesh.');
      console.error(err);
    });
  }

  function boot() {
    document.querySelectorAll('.mesh-anim').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
