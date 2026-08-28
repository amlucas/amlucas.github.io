// The tank-treading red-blood-cell surrogate, running in the browser.
//
// Nothing here is precomputed animation: the page ships a trained model — a
// two-layer head from the flow conditions to Stuart-Landau oscillator
// parameters, and one MLP decoder from the 8-dimensional latent state to 642
// vertex positions — and evaluates it for whatever (Ca, lambda, t) the reader
// picks. The shape you see is a fresh forward pass, about 2.2 million
// multiply-adds, run on every animation frame.
//
// It is a statement-by-statement port of numpy_surrogate.py in the parti
// repository, which is itself pinned against the torch checkpoint by
// test_numpy_surrogate.py. The blob carries reference evaluations computed in
// torch so this port can be checked too: load the page with ?selftest=1 and the
// console reports the deviation.
//
// The maths, in full:
//
//   c        = ((log Ca, log lambda) - mean) / std            standardized
//   w        = head(c)  ->  omega_k, mu_k = softplus, r*_k = softplus
//   r_k(t)   = r*_k + (r_k(0) - r*_k) exp(-mu_k t)            exact in t
//   th_k(t)  = th_k(0) + omega_k t
//   z(t)     = (r_0 cos th_0, r_0 sin th_0, r_1 cos th_1, ...)
//   x(t)     = decoder([z(t), c]) * sigma + mu                flat, planar
//
// Because the latent flow is closed form, time is continuous: the frame rate of
// the display and the model's training step (dt = 0.1 shear times) have nothing
// to do with each other, and nothing accumulates over a long rollout.
(function () {
  'use strict';

  const MV = window.MeshView;

  // Shear times. The model was trained and validated on 500-shear-time
  // rollouts from the equilibrium shape, so the clock wraps there rather than
  // running on into territory nobody measured.
  const T_MAX = 500;
  // Shear times per second of wall clock. One tank-treading revolution takes
  // roughly 10 shear times, so this plays it in about two seconds.
  const SPEED = 5;

  const HEADER_BYTES = 128;      // '<4s10I21f', see numpy_surrogate.py

  // --- float16 --------------------------------------------------------------

  // The wide decoder layer is stored as half floats to halve the download.
  // There is no portable way to compute with them, so expand once at load;
  // everything downstream is float32, exactly like the numpy reference.
  function halfToFloat32(u16) {
    const out = new Float32Array(u16.length);
    for (let i = 0; i < u16.length; i++) {
      const h = u16[i];
      const sign = (h & 0x8000) ? -1 : 1;
      const exp = (h >> 10) & 0x1f;
      const frac = h & 0x3ff;
      if (exp === 0) {
        out[i] = sign * frac * Math.pow(2, -24);            // subnormal / zero
      } else if (exp === 31) {
        out[i] = frac ? NaN : sign * Infinity;
      } else {
        out[i] = sign * (frac + 1024) * Math.pow(2, exp - 25);
      }
    }
    return out;
  }

  // --- little neural network ------------------------------------------------

  // x * sigmoid(x), fed only -|x| so a large activation cannot overflow --
  // the same guard the numpy reference uses.
  function silu(x) {
    const e = Math.exp(-Math.abs(x));
    return x >= 0 ? x / (1 + e) : (x * e) / (1 + e);
  }

  function softplus(x) {
    return x > 20 ? x : Math.log1p(Math.exp(x));
  }

  // Layers are { w, b, nIn, nOut } with w row-major [nOut][nIn]. The output
  // buffers are allocated once and reused: a forward pass per animation frame
  // must not hand the garbage collector 2 MB of scratch.
  function makeMlp(layers) {
    const scratch = layers.map((l) => new Float32Array(l.nOut));
    return {
      layers,
      get outSize() { return layers[layers.length - 1].nOut; },
      forward(input) {
        let x = input;
        for (let k = 0; k < layers.length; k++) {
          const { w, b, nIn, nOut } = layers[k];
          const y = scratch[k];
          const last = k === layers.length - 1;
          for (let o = 0; o < nOut; o++) {
            let acc = b[o];
            const row = o * nIn;
            for (let i = 0; i < nIn; i++) acc += w[row + i] * x[i];
            y[o] = last ? acc : silu(acc);
          }
          x = y;
        }
        return x;
      },
    };
  }

  // --- the blob -------------------------------------------------------------

  function readMlp(buf, dv, off, nLayers) {
    const layers = [];
    for (let k = 0; k < nLayers; k++) {
      const nIn = dv.getUint32(off, true);
      const nOut = dv.getUint32(off + 4, true);
      const code = dv.getUint32(off + 8, true);
      off += 12;
      let w;
      if (code === 1) {
        w = halfToFloat32(new Uint16Array(buf, off, nOut * nIn));
        off += 2 * nOut * nIn;
      } else {
        w = new Float32Array(buf, off, nOut * nIn);
        off += 4 * nOut * nIn;
      }
      // The writer pads a float16 block of odd length, because a Float32Array
      // view on a 2-byte boundary throws rather than reading slowly.
      off += off % 4 ? 4 - (off % 4) : 0;
      const b = new Float32Array(buf, off, nOut);
      off += 4 * nOut;
      layers.push({ w, b, nIn, nOut });
    }
    return [makeMlp(layers), off];
  }

  // Split from the fetch so the runtime can be exercised on a blob obtained
  // any other way -- which is how test_js_runtime.py in the parti repository
  // checks this port against the numpy reference outside a browser.
  function parseModel(buf) {
    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
                                      dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'RBCS') throw new Error(`${url}: bad magic ${magic}`);
    const version = dv.getUint32(4, true);
    if (version !== 1) throw new Error(`${url}: version ${version}`);

    const nVerts = dv.getUint32(8, true);
    const nFaces = dv.getUint32(12, true);
    const z = dv.getUint32(16, true);
    const condDim = dv.getUint32(20, true);
    const nDec = dv.getUint32(24, true);
    const nHead = dv.getUint32(28, true);
    const flags = dv.getUint32(32, true);
    const nGolden = dv.getUint32(36, true);
    const pair = dv.getUint32(40, true);
    const f32 = (i) => dv.getFloat32(44 + 4 * i, true);
    const dt = f32(0), sigma = f32(1), a0 = f32(2), v0 = f32(3);
    const condMean = [f32(4), f32(5)];
    const condStd = [f32(6), f32(7)];
    const domain = { caLo: f32(8), caHi: f32(9), lamLo: f32(10), lamHi: f32(11) };
    const span = { caLo: f32(12), caHi: f32(13), lamLo: f32(14), lamHi: f32(15) };
    const phys = { etaIn: f32(16), muS: f32(17), radiusUm: f32(18),
                   etaM: f32(19) };
    // Relative area/volume drift above which the decoded mesh has left the
    // shape manifold. Measured by the exporter, not guessed here.
    const driftMax = f32(20);

    let off = HEADER_BYTES;
    const faces = new Uint16Array(buf, off, nFaces * 3);
    off += 6 * nFaces;
    off += off % 4 ? 4 - (off % 4) : 0;
    const mu = new Float32Array(buf, off, 3 * nVerts);
    off += 12 * nVerts;
    const zEq = new Float32Array(buf, off, z);
    off += 4 * z;
    let decoder, head;
    [decoder, off] = readMlp(buf, dv, off, nDec);
    [head, off] = readMlp(buf, dv, off, nHead);

    // Reference evaluations from torch: (Ca, lambda, t) and the positions the
    // trained model produced there.
    const golden = [];
    for (let k = 0; k < nGolden; k++) {
      const ca = dv.getFloat32(off, true);
      const lam = dv.getFloat32(off + 4, true);
      const t = dv.getFloat32(off + 8, true);
      off += 12;
      golden.push({ ca, lam, t, pos: new Float32Array(buf, off, 3 * nVerts) });
      off += 12 * nVerts;
    }

    const nPairs = z / 2;
    const logCa = !!(flags & 1);
    const condDecoder = !!(flags & 2);

    // Scratch, allocated once. `latent` and `decode` write into these, so a
    // frame costs no allocation at all.
    const cond = new Float32Array(condDim);
    const zBuf = new Float32Array(z);
    const decIn = new Float32Array(z + (condDecoder ? condDim : 0));
    const flat = new Float32Array(3 * nVerts);
    const omega = new Float32Array(nPairs);
    const decay = new Float32Array(nPairs);
    const rStar = new Float32Array(nPairs);

    const model = {
      nVerts, nFaces, faces, z, nPairs, pair, dt, sigma, a0, v0, mu, zEq,
      domain, span, phys, driftMax, logCa, condDecoder, golden, decoder, head,
      params: { omega, decay, rStar },

      // (Ca, lambda) -> standardized conditions. Whether Ca enters as its
      // logarithm is the checkpoint's business, carried in the flags.
      cond(ca, lam) {
        cond[0] = ((logCa ? Math.log(ca) : ca) - condMean[0]) / condStd[0];
        cond[1] = (Math.log(lam) - condMean[1]) / condStd[1];
        return cond;
      },

      // omega, contraction rate and attracting radius per oscillator pair.
      slParams(c) {
        const w = head.forward(c);
        for (let k = 0; k < nPairs; k++) {
          omega[k] = w[3 * k];
          decay[k] = softplus(w[3 * k + 1]);
          rStar[k] = softplus(w[3 * k + 2]);
        }
        return model.params;
      },

      // The latent state t shear times after z0, in closed form: each pair
      // spirals onto its circle while rotating, and every t follows directly
      // from z0 rather than from a chain of steps.
      latent(z0, t) {
        for (let k = 0; k < nPairs; k++) {
          const x = z0[2 * k], y = z0[2 * k + 1];
          const r0 = Math.hypot(x, y);
          const th = Math.atan2(y, x) + omega[k] * t;
          const r = rStar[k] + (r0 - rStar[k]) * Math.exp(-decay[k] * t);
          zBuf[2 * k] = r * Math.cos(th);
          zBuf[2 * k + 1] = r * Math.sin(th);
        }
        return zBuf;
      },

      // Latent state -> physical vertex positions, flat and PLANAR
      // (x0..xN-1, y0..yN-1, z0..zN-1), the layout the training data used.
      decode(zState, c) {
        decIn.set(zState);
        if (condDecoder) decIn.set(c, z);
        const out = decoder.forward(decIn);
        for (let i = 0; i < flat.length; i++) flat[i] = out[i] * sigma + mu[i];
        return flat;
      },

      // |omega| of the pair carrying the fundamental: the membrane's material
      // rotation rate. The tank-treading frequency is omega / 2pi, and the
      // inclination angle oscillates at 2 omega because the weakly deformed
      // cell is nearly two-fold symmetric.
      frequency() { return Math.abs(omega[pair]); },

      inDomain(ca, lam) {
        return ca >= domain.caLo && ca <= domain.caHi
            && lam >= domain.lamLo && lam <= domain.lamHi;
      },

      // The dimensional flow (Ca, lambda) stands for, as the sweep defined it:
      // lambda = eta_in / eta_out, Ca = tau * radius / mu_s.
      physical(ca, lam) {
        const etaOut = phys.etaIn / lam;                 // mPa s
        const tau = (ca * phys.muS) / phys.radiusUm;     // Pa
        return { etaOut, tau, rate: tau / (1e-3 * etaOut) };
      },
    };
    return model;
  }

  async function loadModel(url) {
    return parseModel(await MV.fetchBlob(url));
  }

  // --- geometry -------------------------------------------------------------

  // Planar (all x, then y, then z) -> interleaved xyz, which is what the
  // render core and the GPU want.
  function interleave(flat, n, out) {
    for (let i = 0; i < n; i++) {
      out[3 * i] = flat[i];
      out[3 * i + 1] = flat[n + i];
      out[3 * i + 2] = flat[2 * n + i];
    }
    return out;
  }

  // Total area and enclosed volume of the closed mesh, from interleaved
  // positions: the same formulas the training loss penalized.
  function areaVolume(pos, faces) {
    let area = 0;
    let vol = 0;
    for (let t = 0; t < faces.length; t += 3) {
      const i = faces[t] * 3, j = faces[t + 1] * 3, k = faces[t + 2] * 3;
      const ux = pos[j] - pos[i], uy = pos[j + 1] - pos[i + 1],
            uz = pos[j + 2] - pos[i + 2];
      const vx = pos[k] - pos[i], vy = pos[k + 1] - pos[i + 1],
            vz = pos[k + 2] - pos[i + 2];
      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      area += 0.5 * Math.hypot(cx, cy, cz);
      vol += (pos[i] * cx + pos[i + 1] * cy + pos[i + 2] * cz) / 6;
    }
    return { area, vol };
  }

  // Long-axis angle in the shear (x-z) plane via the gyration tensor -- the
  // inclination angle Fischer & Korzeniewski measure, and the dataset's own
  // definition.
  function inclination(pos, n) {
    let mx = 0, mz = 0;
    for (let i = 0; i < n; i++) { mx += pos[3 * i]; mz += pos[3 * i + 2]; }
    mx /= n; mz /= n;
    let xx = 0, zz = 0, xz = 0;
    for (let i = 0; i < n; i++) {
      const dx = pos[3 * i] - mx, dz = pos[3 * i + 2] - mz;
      xx += dx * dx; zz += dz * dz; xz += dx * dz;
    }
    return 0.5 * Math.atan2(2 * xz, xx - zz) * 180 / Math.PI;
  }

  function boundingRadius(model, work) {
    // The cell elongates with Ca, so frame the camera on the largest shape the
    // sliders can reach: sample the corners of the slider range over a cycle
    // and keep the worst case. Re-framing while a slider moves would read as
    // the cell breathing, which it is not.
    const { span } = model;
    let r = 0;
    for (const ca of [span.caLo, span.caHi]) {
      for (const lam of [span.lamLo, span.lamHi]) {
        const c = model.cond(ca, lam);
        model.slParams(c);
        for (let t = 0; t <= 40; t += 5) {
          interleave(model.decode(model.latent(model.zEq, t), c),
                     model.nVerts, work);
          for (let i = 0; i < work.length; i += 3) {
            r = Math.max(r, Math.hypot(work[i], work[i + 1], work[i + 2]));
          }
        }
      }
    }
    return r;
  }

  // --- sliders --------------------------------------------------------------

  // Both conditions were sampled logarithmically, so the slider is
  // logarithmic too; 1000 steps is finer than the model's own resolution.
  const STEPS = 1000;
  const fromSlider = (v, lo, hi) => lo * Math.pow(hi / lo, v / STEPS);
  const toSlider = (x, lo, hi) => Math.round(
    STEPS * Math.log(x / lo) / Math.log(hi / lo));

  // Shade the part of the track the model was actually trained on. The reader
  // can leave it -- the readout says so -- but should be able to see where the
  // edge is without moving the handle. The stops go on the wrapper, because the
  // band that reads them is the input's sibling and custom properties only
  // travel downwards.
  function trackShading(el, lo, hi, inLo, inHi) {
    // Clamped, because the training range can reach past the slider: the
    // sliders stop where the model stops producing physical shapes, which on
    // one axis is inside the data's own spread.
    const at = (x) => Math.min(100, Math.max(0,
      100 * Math.log(x / lo) / Math.log(hi / lo)));
    const a = at(inLo);
    const b = at(inHi);
    const target = el.parentElement || el;
    target.style.setProperty('--in-start', `${a.toFixed(2)}%`);
    target.style.setProperty('--in-end', `${b.toFixed(2)}%`);
  }

  // --- viewer ---------------------------------------------------------------

  function init(root) {
    const canvas = root.querySelector('canvas');
    const status = root.querySelector('.mesh-anim-status');
    const play = root.querySelector('.mesh-anim-play');
    const timeSlider = root.querySelector('.mesh-anim-slider');
    const reset = root.querySelector('.rbc-reset');
    const caSlider = root.querySelector('.rbc-slider[data-param="ca"]');
    const lamSlider = root.querySelector('.rbc-slider[data-param="lam"]');
    const readout = root.querySelector('.rbc-readout');
    const say = (msg) => { if (status) status.textContent = msg; };

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!gl) {
      say('This visualization needs WebGL2.');
      return;
    }

    loadModel(root.dataset.src).then((model) => {
      say('');
      const n = model.nVerts;
      const pos = new Float32Array(3 * n);

      // State: the orbit the reader is on. `z0` is where the current rollout
      // started and `t` how far along it is -- never an accumulated state, so
      // scrubbing backwards is exact and nothing drifts.
      const z0 = Float32Array.from(model.zEq);
      let ca = Math.sqrt(model.domain.caLo * model.domain.caHi);
      let lam = Math.sqrt(model.domain.lamLo * model.domain.lamHi);
      let t = 0;
      let playing = root.dataset.autoplay !== 'false';
      let last = 0;
      let stale = true;              // the shape on the GPU is out of date
      let msPerFrame = 0;            // reported by ?selftest=1, not on the page

      const view = MV.create({
        root, canvas, gl, faces: model.faces, nVerts: n,
        color: (root.dataset.color || '0.80,0.25,0.25').split(',').map(Number),
        radius: boundingRadius(model, pos),
        onVisibility: (visible) => { if (!visible) last = 0; },
      });

      caSlider.max = String(STEPS);
      lamSlider.max = String(STEPS);
      caSlider.value = String(toSlider(ca, model.span.caLo, model.span.caHi));
      lamSlider.value = String(toSlider(lam, model.span.lamLo,
                                        model.span.lamHi));
      trackShading(caSlider, model.span.caLo, model.span.caHi,
                   model.domain.caLo, model.domain.caHi);
      trackShading(lamSlider, model.span.lamLo, model.span.lamHi,
                   model.domain.lamLo, model.domain.lamHi);
      timeSlider.max = String(Math.round(T_MAX / model.dt));
      timeSlider.disabled = false;
      play.disabled = false;
      play.textContent = playing ? 'Pause' : 'Play';

      function refresh() {
        const started = performance.now();
        const c = model.cond(ca, lam);
        model.slParams(c);
        interleave(model.decode(model.latent(z0, t), c), n, pos);
        view.setPositions(pos);
        msPerFrame = 0.8 * msPerFrame + 0.2 * (performance.now() - started);

        const { area, vol } = areaVolume(pos, model.faces);
        const p = model.physical(ca, lam);
        const omega = model.frequency();
        const inside = model.inDomain(ca, lam);
        // Two different warnings. Being outside the shaded range says the
        // conditions are unusual; the drift says THIS shape is not a physical
        // cell any more, which is the one that matters and which can happen
        // inside the range too, since the trained region is not a rectangle.
        const drift = Math.max(Math.abs(vol / model.v0 - 1),
                               Math.abs(area / model.a0 - 1));
        const offManifold = drift > model.driftMax;
        root.classList.toggle('is-extrapolating', !inside || offManifold);
        // Deliberately short: the two conditions the reader sets, what they
        // mean for a real cell, and the two things the model predicts. The
        // area/volume drift stays computed above but is not printed -- it
        // earns its keep as the off-manifold warning, not as another number.
        readout.innerHTML = [
          ['Ca', MV.formatValue(Number(ca.toPrecision(3)))],
          ['&lambda;', MV.formatValue(Number(lam.toPrecision(3)))],
          ['&eta;<sub>out</sub>', `${p.etaOut.toFixed(1)} mPa&thinsp;s`],
          ['&gamma;&#775;', `${p.rate.toFixed(1)} s<sup>&minus;1</sup>`],
          ['&theta;', `${inclination(pos, n).toFixed(1)}&deg;`],
          ['TTF', (2 * omega).toFixed(3)],
        ].map(([k, v]) => `<span class="rbc-quantity"><i>${k}</i> ${v}</span>`)
          .join('')
          + (inside ? '' : '<span class="rbc-warn">outside the training '
                           + 'range</span>')
          + (offManifold ? '<span class="rbc-warn">shape is off the model\'s '
                           + 'manifold</span>' : '');
        stale = false;
      }

      // Changing the flow keeps the shape and restarts the clock: the cell
      // carries on from where it is and relaxes onto the new limit cycle,
      // which is what a quasi-static change of shear rate would do -- and it
      // is the only handoff that cannot jump.
      function handoff() {
        z0.set(model.latent(z0, t));
        t = 0;
        timeSlider.value = '0';
        stale = true;
      }

      caSlider.addEventListener('input', () => {
        ca = fromSlider(Number(caSlider.value), model.span.caLo,
                        model.span.caHi);
        handoff();
      });
      lamSlider.addEventListener('input', () => {
        lam = fromSlider(Number(lamSlider.value), model.span.lamLo,
                         model.span.lamHi);
        handoff();
      });
      timeSlider.addEventListener('input', () => {
        t = Number(timeSlider.value) * model.dt;
        playing = false;
        play.textContent = 'Play';
        stale = true;
      });
      play.addEventListener('click', () => {
        playing = !playing;
        last = 0;
        play.textContent = playing ? 'Pause' : 'Play';
        view.invalidate();
      });
      if (reset) {
        reset.addEventListener('click', () => {
          // Back to the shape every simulation started from, so the transient
          // onto the cycle can be watched from the beginning.
          z0.set(model.zEq);
          t = 0;
          timeSlider.value = '0';
          stale = true;
        });
      }

      view.start((now) => {
        if (playing) {
          if (last) {
            // Absolute time, wrapped: because the flow is closed form, a
            // dropped frame costs nothing and a long run accumulates nothing.
            t += ((now - last) / 1000) * SPEED;
            if (t > T_MAX) t -= T_MAX;
            timeSlider.value = String(Math.round(t / model.dt));
            stale = true;
          }
          last = now;
        }
        if (stale) refresh();
      });

      // The port's own test: replay the references the exporter computed in
      // torch and report how far off this implementation is.
      if (/[?&]selftest/.test(location.search) && model.golden.length) {
        let worst = 0;
        for (const g of model.golden) {
          const c = model.cond(g.ca, g.lam);
          model.slParams(c);
          const got = model.decode(model.latent(model.zEq, g.t), c);
          let sq = 0;
          for (let i = 0; i < n; i++) {
            sq += (got[i] - g.pos[i]) ** 2
                + (got[n + i] - g.pos[n + i]) ** 2
                + (got[2 * n + i] - g.pos[2 * n + i]) ** 2;
          }
          const rmse = Math.sqrt(sq / n);
          worst = Math.max(worst, rmse);
          console.log(`rbc-surrogate selftest: Ca=${g.ca.toFixed(3)} `
                      + `lam=${g.lam.toFixed(3)} t=${g.t} -> per-vertex RMSE `
                      + `${rmse.toExponential(2)} (cell radii)`);
        }
        console.log(`rbc-surrogate selftest: worst ${worst.toExponential(2)}, `
                    + `against the model's own 6.5e-2 rollout error`);
        console.log(`rbc-surrogate selftest: ${msPerFrame.toFixed(1)} ms per `
                    + `decoded frame (${model.nVerts} vertices)`);
        say(`selftest: worst per-vertex RMSE ${worst.toExponential(2)}`);
        setTimeout(() => say(''), 6000);
        // The self-test rolled from the equilibrium latent; put the reader's
        // state back.
        stale = true;
      }
    }).catch((err) => {
      say('Could not load the surrogate.');
      console.error(err);
    });
  }

  // The numeric runtime, so it can be driven without a page: same entry points
  // the viewer above uses.
  window.RbcSurrogate = { parseModel, interleave, areaVolume, inclination,
                          halfToFloat32 };

  function boot() {
    document.querySelectorAll('.rbc-surrogate').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
