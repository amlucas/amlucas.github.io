// Player glue for {{video_hls(...)}} figures (see tools/utils.py:embed_video_hls).
//
// Each <video data-src="…/master.m3u8"> is attached to hls.js, which picks a
// rung from the measured bandwidth and caps it at the player's on-screen size
// (full screen on a 4K display gets 2160p, a phone gets 720p). Nothing but the
// poster is fetched until the reader presses play. A small menu in the corner
// shows the rung being played and lets the reader pin one, e.g. to force 4K
// when looking at fine detail. Browsers without MSE (older iOS Safari) play
// the playlist natively and get no menu.
(function () {
  'use strict';

  function label(level) {
    return level.height + 'p';
  }

  function attachHls(video, src) {
    var hls = new Hls({
      autoStartLoad: false,        // wait for play: preload="none" in spirit
      capLevelToPlayerSize: true,  // never fetch more pixels than are shown
      maxBufferLength: 20,         // seconds ahead; 4K segments are large
      maxMaxBufferLength: 40,
    });
    hls.loadSource(src);
    hls.attachMedia(video);

    var started = false;
    video.addEventListener('play', function () {
      if (!started) {
        started = true;
        hls.startLoad(-1);
      }
    });

    var select = document.createElement('select');
    select.className = 'video-hls-quality';
    select.setAttribute('aria-label', 'Video quality');
    video.parentNode.insertBefore(select, video.nextSibling);

    function setAutoText(current) {
      var auto = select.options[0];
      if (!auto) return;
      auto.textContent = current >= 0 && hls.levels[current]
        ? 'Auto (' + label(hls.levels[current]) + ')'
        : 'Auto';
    }

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      select.innerHTML = '';
      var auto = document.createElement('option');
      auto.value = '-1';
      auto.textContent = 'Auto';
      select.appendChild(auto);
      // Highest first, as players usually list them.
      for (var i = hls.levels.length - 1; i >= 0; i--) {
        var opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = label(hls.levels[i]);
        select.appendChild(opt);
      }
      select.value = '-1';
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, function (_, data) {
      setAutoText(data.level);
    });

    select.addEventListener('change', function () {
      var level = parseInt(select.value, 10);
      // Manual selection bypasses ABR and the player-size cap; -1 restores both.
      hls.currentLevel = level;   // switches immediately (flushes the buffer)
      if (level < 0) setAutoText(hls.currentLevel);
    });

    hls.on(Hls.Events.ERROR, function (_, data) {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      else hls.destroy();
    });
  }

  function init() {
    var videos = document.querySelectorAll('.video-hls video[data-src]');
    for (var i = 0; i < videos.length; i++) {
      var video = videos[i];
      var src = video.getAttribute('data-src');
      if (window.Hls && Hls.isSupported()) {
        attachHls(video, src);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
