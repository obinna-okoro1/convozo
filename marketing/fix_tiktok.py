#!/usr/bin/env python3
"""Fix downloadReel in tiktok-reels.html to use crop-from-display approach."""
import re

with open('tiktok-reels.html', 'r', encoding='utf-8') as f:
    content = f.read()

new_fn = r"""  async function downloadReel(n, durationSec) {
    const btn = document.getElementById('dl' + n);
    if (btn.disabled) return;

    // Capture the tab display BEFORE opening fullscreen
    // (Chrome requires the user gesture to be active when calling getDisplayMedia)
    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
        preferCurrentTab: true,
      });
    } catch { return; } // user cancelled

    btn.disabled = true;
    btn.textContent = '\u23fa Recording\u2026';

    // Now open the fullscreen overlay so the reel fills as much screen as possible
    playInFS(n);
    await new Promise(r => setTimeout(r, 400)); // let overlay paint

    // Locate the rendered reel inside the fullscreen host
    const hostEl = document.getElementById('fsHost');
    const rect   = hostEl.getBoundingClientRect();
    const dpr    = window.devicePixelRatio || 1;

    // Wire the display stream into a hidden <video> so we can drawImage from it
    const displayVideo   = document.createElement('video');
    displayVideo.srcObject = displayStream;
    displayVideo.muted   = true;
    displayVideo.playsInline = true;
    await displayVideo.play();

    // Output canvas at 1080x1920 (exact 9:16 portrait — correct for TikTok/iPhone)
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Continuous crop-and-scale: cut just the reel from the full-screen capture
    let rafId;
    function drawFrame() {
      ctx.drawImage(
        displayVideo,
        Math.round(rect.left  * dpr), Math.round(rect.top    * dpr),  // src x, y
        Math.round(rect.width * dpr), Math.round(rect.height * dpr),  // src w, h
        0, 0, W, H                                                      // dst
      );
      rafId = requestAnimationFrame(drawFrame);
    }

    const mimeType = [
      'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9', 'video/webm'
    ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

    const canvasStream = canvas.captureStream(30);
    const recorder     = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks       = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(rafId);
      displayVideo.srcObject = null;
      displayStream.getTracks().forEach(t => t.stop());
      closeFS();

      const ext  = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mimeType });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `convozo-tiktok-reel${n}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      btn.disabled = false;
      btn.textContent = '\u2b07 Download';
    };

    rafId = requestAnimationFrame(drawFrame);
    recorder.start(100);

    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, durationSec * 1000);
  }"""

# Replace from "async function downloadReel" up to (not including) the close overlay listener
start = content.find('  async function downloadReel(n, durationSec)')
end   = content.find('\n  // Close fullscreen on backdrop click or Escape')

if start == -1 or end == -1:
    print(f'ERROR: start={start}, end={end}')
    exit(1)

content = content[:start] + new_fn + '\n' + content[end:]
with open('tiktok-reels.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('tiktok-reels.html: OK')
