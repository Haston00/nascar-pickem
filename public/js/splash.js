// Splash Screen with YouTube Video
// Dale Earnhardt Sr. 1998 Daytona 500 — "After 20 years of trying!"
//
// TO CHANGE THE VIDEO: Replace the VIDEO_ID below with any YouTube video ID.
// The video ID is the part after "v=" in a YouTube URL.
// Example: https://youtube.com/watch?v=XXXXXXXX → VIDEO_ID = 'XXXXXXXX'

const Splash = (() => {
  // ============================================
  // CHANGE THIS to your preferred YouTube video ID
  // Find the Dale Earnhardt 1998 Daytona 500 finish on YouTube,
  // copy the video ID from the URL, and paste it here.
  //
  // Some great options to search for:
  //   "Dale Earnhardt 1998 Daytona 500 finish" (the GOAT moment)
  //   "Ross Chastain wall ride Martinsville" (the Hail Melon)
  //   "Ricky Craven Kurt Busch Darlington 2003" (closest finish ever)
  // ============================================
  const VIDEO_ID = 'PASTE_YOUTUBE_VIDEO_ID_HERE';

  const MIN_DISPLAY_SECONDS = 20;
  let player = null;
  let startTime = null;
  let skipReady = false;

  function init() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    // Check if splash was already shown this session
    if (sessionStorage.getItem('splash_shown')) {
      splash.classList.add('hidden');
      return;
    }

    // If no video ID set, show static splash for 3 seconds then enter
    if (VIDEO_ID === 'PASTE_YOUTUBE_VIDEO_ID_HERE') {
      splash.addEventListener('click', () => {
        closeSplash();
      });
      return;
    }

    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    // Tap to start video
    splash.addEventListener('click', onSplashTap, { once: true });
  }

  function onSplashTap() {
    const tapPrompt = document.getElementById('splash-tap');
    const videoContainer = document.getElementById('splash-video-container');
    const skipBtn = document.getElementById('splash-skip');

    if (VIDEO_ID === 'PASTE_YOUTUBE_VIDEO_ID_HERE') {
      closeSplash();
      return;
    }

    // Hide tap prompt, show video
    tapPrompt.style.display = 'none';
    videoContainer.style.display = 'block';

    // Create YouTube player
    startTime = Date.now();
    player = new YT.Player('youtube-player', {
      videoId: VIDEO_ID,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        playsinline: 1,  // Critical for mobile
        fs: 0,
        iv_load_policy: 3
      },
      events: {
        onReady: (e) => {
          e.target.playVideo();
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING && !skipReady) {
            // Show skip button after minimum time
            setTimeout(() => {
              skipBtn.style.display = 'block';
              skipReady = true;
            }, MIN_DISPLAY_SECONDS * 1000);
          }
          // If video ends, auto-close
          if (e.data === YT.PlayerState.ENDED) {
            closeSplash();
          }
        }
      }
    });

    // Also allow tapping skip
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSplash();
    });
  }

  function closeSplash() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    // Stop video if playing
    if (player && player.stopVideo) {
      try { player.stopVideo(); } catch (e) {}
    }

    // Fade out
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.classList.add('hidden');
    }, 800);

    // Remember for this session
    sessionStorage.setItem('splash_shown', '1');
  }

  return { init };
})();

// YouTube API callback (required by YouTube IFrame API)
function onYouTubeIframeAPIReady() {
  // Player gets created on tap, not here
}

document.addEventListener('DOMContentLoaded', () => Splash.init());
