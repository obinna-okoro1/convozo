#!/usr/bin/env python3
"""Fix downloadReel in reels.html to use crop-from-display approach."""

with open('reels.html', 'r', encoding='utf-8') as f:
    content = f.read()

new_fn = r"""  // Capture display → crop reel element → scale to 1080x1920 → record.
  // Works for CSS animations and all content. Plays correctly on iPhone.
  async function downloadReel(reelId, durationSec) {
    const dlBtn = document.getElementById('dl-' + reelId);
    if (dlBtn.disabled) return;

    // Must call getDisplayMedia while the user-gesture is still active
    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
        preferCurrentTab: true,
      });
    } catch { return; }

    dlBtn.disabled = true;
    dlBtn.textContent = '\u23fa Recording\u2026';

    // Restart animation, show fullscreen
    restartReel(reelId);
    playReel(reelId);
    await new Promise(r => setTimeout(r, 400)); // let overlay paint

    // Crop coordinates: the host div that holds the reel in the fullscreen overlay
    const hostEl = document.getElementById('fsHost');
    const rect   = hostEl.getBoundingClientRect();
    const dpr    = window.devicePixelRatio || 1;

    // Pipe display stream into a hidden video
    const displayVideo = document.createElement('video');
    displayVideo.srcObject = displayStream;
    displayVideo.muted = true;
    displayVideo.playsInline = true;
    await displayVideo.play();

    // Output canvas: 1080x1920 (9:16 portrait)
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    let rafId;
    function drawFrame() {
      ctx.drawImage(
        displayVideo,
        Math.round(rect.left  * dpr), Math.round(rect.top    * dpr),
        Math.round(rect.width * dpr), Math.round(rect.height * dpr),
        0, 0, W, H
      );
      rafId = requestAnimationFrame(drawFrame);
    }

    const mimeType = [
      'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9', 'video/webm'
    ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

    const canvasStream = canvas.captureStream(30);
    const recorder     = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks       = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(rafId);
      displayVideo.srcObject = null;
      displayStream.getTracks().forEach(t => t.stop());
      closeFullscreen();

      const ext  = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mimeType });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `convozo-${reelId}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      dlBtn.disabled = false;
      dlBtn.textContent = '\u2b07 Download';
    };

    rafId = requestAnimationFrame(drawFrame);
    recorder.start(100);

    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, durationSec * 1000);
  }"""

start = content.find('  // \u2500\u2500 Download via canvas capture')
end   = content.find('\n  // Close on backdrop click')

if start == -1 or end == -1:
    print(f'ERROR: start={start}, end={end}')
    exit(1)

content = content[:start] + new_fn + '\n' + content[end:]
with open('reels.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('reels.html: OK')
