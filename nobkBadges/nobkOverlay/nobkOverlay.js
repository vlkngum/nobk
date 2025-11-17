console.log("[EXTENSION] nobkOverlay.js YÜKLENDİ");

let lastPlayedUrl = null;
let isPlaying = false;

/* ─────────────────────────
   KULLANICI ADI ALMA
────────────────────────── */
function getUsername() {
  let userImg = document.querySelector('button.userNameBtn_wpYSY img[alt]');

  if (!userImg) {
    userImg = document.querySelector('img[alt*="#"]');
  }

  if (!userImg) {
    console.error("[USER] Kullanıcı resmi bulunamadı.");
    return null;
  }

  const username = userImg.alt.split("#")[0]; 
  console.log("[USER] Kullanıcı adı:", username);
  return username;
}

/* ─────────────────────────
   KULLANICI PUANI ALMA
────────────────────────── */
async function getUserScore(username) {
  try {
    const res = await fetch("https://nobk-badge-back.vercel.app/api/get-users");
    const data = await res.json();

    const user = data.find(u => u.username === username);

    if (!user) {
      console.error("[USER] Kullanıcı bulunamadı:", username);
      return null;
    }

    return user.score;
  } catch (err) {
    console.error("[USER SCORE HATA]", err);
    return null;
  }
}

/* ─────────────────────────
   PUAN -1 GÖNDERME
────────────────────────── */
async function decreaseScore(username) {
  try {
    const res = await fetch("https://nobk-badge-back.vercel.app/api/get-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[SCORE UPDATE HATA]", err);
    return null;
  }
}

/* ─────────────────────────
   BACKGROUND
────────────────────────── */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[BACKGROUND MESAJ ALINDI]", request);

  if (request.action === "API_POST") {
    fetch("https://nobk-badge-back.vercel.app/api/selected-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: request.videoUrl })
    })
      .then(r => r.json())
      .then(resp => sendResponse({ ok: true, data: resp }))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }

  if (request.action === "API_DELETE") {
    fetch("https://nobk-badge-back.vercel.app/api/selected-video", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    })
      .then(r => r.json())
      .then(resp => sendResponse({ ok: true, data: resp }))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }

  if (request.action === "API_GET") {
    fetch("https://nobk-badge-back.vercel.app/api/selected-video")
      .then(r => r.json())
      .then(resp => sendResponse({ ok: true, data: resp }))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }
});

let allOverlays = [];

/* ─────────────────────────
   MODAL
────────────────────────── */
const modalOverlay = document.createElement("div");
modalOverlay.id = "ganimet-modal-overlay";
modalOverlay.innerHTML = `
  <div id="ganimet-modal-content">
    <div class="modal-header">
      <p id="ganimet-user-info"></p>
      <button id="ganimet-modal-close">&times;</button>
    </div>
    <input type="search" id="ganimet-search" placeholder="Video ara...">
    <div id="ganimet-data-container"><p>Yükleniyor...</p></div>
  </div>
`;
document.body.appendChild(modalOverlay);

modalOverlay.querySelector("#ganimet-search").addEventListener("input", e => {
  updateModal(e.target.value);
});

/* ─────────────────────────
   LİSTELEME BUTONU
────────────────────────── */
const listButton = document.createElement("button");
listButton.id = "ganimet-listele-btn";
listButton.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" stroke="currentColor">
    <path d="M21 16V8l-8-5-8 5v8l8 5 8-5z"/>
  </svg>
`;
document.body.appendChild(listButton);

listButton.addEventListener("click", async () => {
  modalOverlay.style.display = "block";

  const container = document.getElementById("ganimet-data-container");
  container.innerHTML = "<p>Veriler yükleniyor...</p>";

  const username = getUsername();
  const score = await getUserScore(username);

  document.querySelector("#ganimet-user-info").textContent =
    `Kullanıcı: ${username} | Puan: ${score}`;

  const res = await fetch("https://nobk-badge-back.vercel.app/api/get-overlay");
  const data = await res.json();

  allOverlays = data.overlays || [];
  updateModal("");
});

/* ─────────────────────────
   MODAL FİLTRELEME
────────────────────────── */
function updateModal(searchTerm = "") {
  const container = document.getElementById("ganimet-data-container");
  container.innerHTML = "";

  const filtered = allOverlays.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filtered.length === 0) {
    container.textContent = "Eşleşen video bulunamadı.";
    return;
  }

  const list = document.createElement("div");
  list.className = "ganimet-list";

  filtered.forEach(item => {
  const itemEl = document.createElement("div");
  itemEl.className = "ganimet-item";

  /* ────────────────
     Küçük Video Önizleme
  ───────────────── */
  const preview = document.createElement("video");
  preview.src = item.video_url;
  preview.muted = true;
  preview.autoplay = true;
  preview.loop = true;
  preview.playsInline = true;
  preview.style.cssText = `
    width: 100%;
    height: 45px;
    object-fit: cover;
    margin-right: 8px;
    border-radius: 4px;
    background: black;
  `;
  itemEl.appendChild(preview);

  /* ────────────────
     Başlık
  ───────────────── */
  const name = document.createElement("strong");
  name.textContent = item.name;
  itemEl.appendChild(name);

  /* ────────────────
     Kullan Butonu
  ───────────────── */
  const kullanBtn = document.createElement("button");
  kullanBtn.textContent = "Kullan";
  kullanBtn.className = "kullan-btn";

  kullanBtn.addEventListener("click", async () => {
    const username = getUsername();
    const score = await getUserScore(username);

    if (score < 1) {
      alert("Yeterli puanın yok!");
      return;
    }

    await fetch("https://nobk-badge-back.vercel.app/api/selected-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: item.video_url })
    });

    await decreaseScore(username);

    playVideoDirect(item.video_url);
    modalOverlay.style.display = "none";
  });

  itemEl.appendChild(kullanBtn);
  list.appendChild(itemEl);
});


  container.appendChild(list);
}

/* ─────────────────────────
   VİDEO OYNATMA
────────────────────────── */
function playVideoDirect(url) {
  const old = document.getElementById("video-overlay-player");
  if (old) old.remove();

  const wrap = document.createElement("div");
  wrap.id = "video-overlay-player";
  wrap.dataset.videoUrl = url;

  wrap.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  width: auto;
  height: 225px;
  z-index: 999999999;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  background: black;
`;

  const v = document.createElement("video");
  v.src = url;
  v.autoplay = true;
  v.controls = false;
  v.style.cssText = `
    height: 100%;
    width: auto;
    object-fit: contain;
  `;

  v.addEventListener("ended", () => {
    wrap.remove();
    isPlaying = false;
  });

  wrap.appendChild(v);
  document.body.appendChild(wrap);
}

/* ─────────────────────────
   POLLING (Çift Oynatma FIX)
────────────────────────── */
async function checkActiveVideo() {
  try {
    if (isPlaying) return;

    const res = await fetch("https://nobk-badge-back.vercel.app/api/selected-video");
    const data = await res.json();

    if (!data.success) return;

    const url = data.data?.video_url;
    if (!url) return;

    if (lastPlayedUrl === url) return;

    lastPlayedUrl = url;
    isPlaying = true;

    // ÇALMADAN ÖNCE SİL — ÇİFT OYNATMAYI %100 ENGELLER
    fetch("https://nobk-badge-back.vercel.app/api/selected-video", {
      method: "DELETE",
    });

    playVideoDirect(url);

  } catch (err) {
    console.error("[POLL HATA]", err);
  }
}

/* ─────────────────────────
   EVENTS
────────────────────────── */
document.getElementById("ganimet-modal-close").addEventListener("click", () => {
  modalOverlay.style.display = "none";
});

window.addEventListener("load", () => {
  checkActiveVideo();
  setInterval(checkActiveVideo, 500);
});
