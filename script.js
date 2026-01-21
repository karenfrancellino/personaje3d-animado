// Configuration
const SKINS = [
  {
    id: 'sickjacken',
    name: 'Sick Jacken',
    url: 'https://raw.githubusercontent.com/karenfrancellino/ar-models/main/DROYZ_ANIMAPP_SiCkJacken_v005.glb'
  },
  {
    id: 'psycho',
    name: 'Psycho Realm',
    url: 'https://raw.githubusercontent.com/karenfrancellino/ar-models/main/DROYZ_ANIMAPP_SiCkJacken_v005.glb' // Placeholder: Reuse model for demo
  },
  {
    id: 'droyz_v1',
    name: 'Droyz Standard',
    url: 'https://raw.githubusercontent.com/karenfrancellino/ar-models/main/DROYZ_ANIMAPP_SiCkJacken_v005.glb' // Placeholder
  },
  {
    id: 'gold',
    name: 'Golden Edition',
    url: 'https://raw.githubusercontent.com/karenfrancellino/ar-models/main/DROYZ_ANIMAPP_SiCkJacken_v005.glb' // Placeholder
  }
];

// Elements
const viewer = document.querySelector('#viewer');
const carousel = document.querySelector('#skinCarousel');
const btnSnapshot = document.querySelector('#btnSnapshot');
const btnRecord = document.querySelector('#btnRecord');
const overlay = document.querySelector('#overlay');
const lockScreen = document.querySelector('#lock-screen');

// State
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];

/* ----------------------------------------------------------------
   1. INIT & SECURITY
---------------------------------------------------------------- */
function init() {
  const params = new URLSearchParams(window.location.search);
  const skinParam = params.get('skin');
  const tokenParam = params.get('token');

  // Security Simulation (Uncomment to enforce)
  // if (!tokenParam) {
  //   lockScreen.style.display = 'flex';
  //   overlay.style.display = 'none';
  //   return; 
  // }

  renderSkins();

  if (skinParam) {
    selectSkin(skinParam);
  } else {
    // Select first by default
    selectSkin(SKINS[0].id);
  }
}

/* ----------------------------------------------------------------
   2. SKIN SYSTEM
---------------------------------------------------------------- */
function renderSkins() {
  carousel.innerHTML = '';
  SKINS.forEach(skin => {
    const btn = document.createElement('div');
    btn.className = 'skin-item';
    btn.innerHTML = `
      <div class="skin-icon">👕</div>
      <div>${skin.name}</div>
    `;
    btn.dataset.id = skin.id;

    btn.onclick = () => selectSkin(skin.id);
    carousel.appendChild(btn);
  });
}

function selectSkin(id) {
  const skin = SKINS.find(s => s.id === id) || SKINS[0];

  // Update Model
  // Note: model-viewer handles transition automatically
  viewer.src = skin.url;

  // Update UI
  document.querySelectorAll('.skin-item').forEach(el => {
    el.classList.remove('selected');
    if (el.dataset.id === id) el.classList.add('selected');
  });

  console.log(`Switched to skin: ${skin.name}`);
}

/* ----------------------------------------------------------------
   3. FLUTTERFLOW BRIDGE
---------------------------------------------------------------- */
function sendToApp(type, dataUrl) {
  console.log(`Sending ${type} to app... (Size: ${dataUrl.length})`);
  const payload = JSON.stringify({ type: type, data: dataUrl });

  // 1. FlutterFlow Interface
  if (window.FlutterFlow && window.FlutterFlow.postMessage) {
    window.FlutterFlow.postMessage(payload);
    return true;
  }

  // 2. Standard WebView Interface
  if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
    window.flutter_inappwebview.callHandler('onCapture', payload);
    return true;
  }

  // 3. Fallback: Download
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `droyz_capture_${Date.now()}.${type === 'photo' ? 'png' : 'webm'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return false;
}

/* ----------------------------------------------------------------
   4. CAPTURE LOGIC
---------------------------------------------------------------- */

// Snapshot
btnSnapshot.onclick = async () => {
  try {
    // Use model-viewer's built-in snapshot
    // toBlob() is standard.
    const blob = await viewer.toBlob({ mimeType: 'image/png' });
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      sendToApp('photo', reader.result);
      // Flash effect
      const flasher = document.createElement('div');
      flasher.style.position = 'fixed';
      flasher.style.top = 0; flasher.style.left = 0;
      flasher.style.width = '100%'; flasher.style.height = '100%';
      flasher.style.background = 'white';
      flasher.style.opacity = '0.8';
      flasher.style.transition = 'opacity 0.5s';
      flasher.style.zIndex = 9999;
      document.body.appendChild(flasher);
      requestAnimationFrame(() => flasher.style.opacity = '0');
      setTimeout(() => document.body.removeChild(flasher), 500);
    };
  } catch (e) {
    console.error("Snapshot failed:", e);
    alert("Snapshot failed. Note: This feature works best in 'Inline' mode. In AR mode, please use system buttons.");
  }
};

// Video Recording
// Note: model-viewer does not expose a video stream easily for `MediaRecorder` 
// UNLESS we capture the canvas it renders to.
// However, model-viewer isolates its canvas in Shadow DOM in some versions.
// We must try to access the internal canvas or use a different approach.
// Fortuantely, `viewer` is a custom element.
btnRecord.onclick = () => {
  if (isRecording) {
    stopRecording();
    return;
  }
  startRecording();
};

function startRecording() {
  try {
    // Attempt to access canvas. 
    // Usually model-viewer shadowRoot contains the canvas.
    const canvas = viewer.shadowRoot.querySelector('canvas');
    if (!canvas) {
      throw new Error("Could not find model-viewer canvas.");
    }

    const stream = canvas.captureStream(30); // 30 FPS
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' }); // VP9 or VP8

    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        sendToApp('video', reader.result);
      };
    };

    mediaRecorder.start();
    isRecording = true;
    btnRecord.classList.add('recording');

  } catch (e) {
    console.warn("Video recording failed/unsupported:", e);
    alert("Video recording not supported in this browser view. Please use system screen recording.");
  }
}

function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  isRecording = false;
  btnRecord.classList.remove('recording');
}


// Start
window.addEventListener('DOMContentLoaded', init);

viewer.addEventListener('error', (e) => {
  console.error("Model Viewer Error:", e);
  // Create an on-screen simplified alert for mobile debugging
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '10px';
  errDiv.style.left = '10px';
  errDiv.style.right = '10px';
  errDiv.style.background = 'rgba(255,0,0,0.8)';
  errDiv.style.color = 'white';
  errDiv.style.padding = '10px';
  errDiv.style.borderRadius = '5px';
  errDiv.style.zIndex = '99999';
  errDiv.style.fontSize = '12px';
  errDiv.innerText = "Error loading model: " + (e.detail?.message || "Unknown error");
  document.body.appendChild(errDiv);
});
