// Interactive viewer for a triangle mesh packed by tools/pack_mesh_anim.py
// (a trajectory) or tools/pack_mesh.py (a single shape).
//
// Each frame is reconstructed on the fly from a handful of POD modes and handed
// to the shared render core in js/mesh-view.js, which draws it as a shaded
// surface with its triangle edges laid over it and owns the camera. Drag to
// orbit, scroll to zoom, scrub or play to move in time. A single-frame blob has
// no time axis, so its playback controls are dropped and the canvas is only
// redrawn when the camera moves.
(function () {
  'use strict';

  const MV = window.MeshView;

  // --- data ------------------------------------------------------------------

  async function loadMesh(url) {
    const buf = await MV.fetchBlob(url);
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

      let frame = 0;
      // Index into m.fields, or -1 for the plain shaded surface.
      let field = -1;
      let uploadedField = -2;
      let playing = animated && root.dataset.autoplay !== 'false';
      let uploaded = -1;
      let last = 0;

      const pos = new Float32Array(m.nVerts * 3);
      const view = MV.create({
        root, canvas, gl, faces: m.faces, nVerts: m.nVerts,
        color: (root.dataset.color || '0.80,0.25,0.25').split(',').map(Number),
        radius: boundingRadius(m),
        withFields: m.fields.length > 0,
        // Coming back into view must not make the animation jump by however
        // long the figure spent off screen.
        onVisibility: (visible) => { if (!visible) last = 0; },
      });

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
          buttons.forEach((b, k) => {
            const on = k - 1 === i;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', String(on));
          });
          legend.hidden = i < 0;
          if (i < 0) {
            view.setFieldMap(null);
          } else {
            const f = m.fields[i];
            const div = MV.isDiverging(f);
            view.setFieldMap(div ? 'diverging' : 'sequential');
            legendBar.style.background =
              MV.colorMapGradient(div ? MV.RDBU : MV.VIRIDIS);
            legend.querySelector('.mesh-anim-legend-min').textContent =
              MV.formatValue(f.min);
            legend.querySelector('.mesh-anim-legend-max').textContent =
              MV.formatValue(f.max);
          }
          view.invalidate();
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
        m.fields.forEach((f, i) => addButton(MV.fieldLabel(f.name), i));
        // Before the full-screen button the core already appended, so the bar
        // still reads transport, fields, full screen from left to right.
        controls.insertBefore(group, controls.querySelector('.mesh-anim-full'));
        // Open on the first field: showing the quantity is the whole point.
        select(0);
      }

      // A static shape with no fields has nothing to put in the bar.
      if (controls && !controls.children.length) controls.remove();

      function upload() {
        if (uploaded !== frame) {
          uploaded = frame;
          reconstruct(m, frame, pos);
          view.setPositions(pos);
          // Whatever field slice is on the GPU belongs to the previous frame.
          uploadedField = -2;
        }
        if (field >= 0 && uploadedField !== field) {
          uploadedField = field;
          view.setFieldValues(m.fields[field].values.subarray(
            frame * m.nVerts, (frame + 1) * m.nVerts));
        }
      }

      view.start((now) => {
        if (playing && last) {
          const advance = ((now - last) / 1000) * m.fps;
          if (advance >= 1) {
            frame = (frame + Math.floor(advance)) % m.nFrames;
            slider.value = String(frame);
            last = now;
          }
        } else if (playing) {
          last = now;
        }
        upload();
      });

      if (animated) {
        slider.addEventListener('input', () => {
          frame = Number(slider.value);
          playing = false;
          button.textContent = 'Play';
        });
        button.addEventListener('click', () => {
          playing = !playing;
          last = 0;
          view.invalidate();
          button.textContent = playing ? 'Pause' : 'Play';
        });
      }
    }).catch((err) => {
      say('Could not load the mesh.');
      console.error(err);
    });
  }

  function boot() {
    // The surrogate viewer has its own script and its own blob format; it
    // shares the container class only for the styling and the render core.
    document.querySelectorAll('.mesh-anim:not(.rbc-surrogate)').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
