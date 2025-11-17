console.log("🔥 Nobk Title Manager: Başlatıldı");

const SERVER_ORIGIN = "https://nobk-badge-back.vercel.app";
const TITLE_API = `${SERVER_ORIGIN}/api/get-title`;

const nobkText = document.createElement("div");
Object.assign(nobkText.style, {
  position: "fixed",
  top: "20px",
  left: "30px",
  zIndex: "9999",
  color: "#fff",
  fontFamily: "Inter, sans-serif, system-ui",
  fontSize: "18px",
  fontWeight: "600",
  textShadow: "0 0 8px rgba(0,0,0,0.5)",
  padding: "4px",
  paddingLeft: "75px",
  userSelect: "none",
  transition: "all 0.25s ease",
  background: "transparent"
});
nobkText.textContent = "Başlık yükleniyor...";
document.body.appendChild(nobkText);

let lastSeenTitleFromServer = null;
let lastProcessedMessageText = null;


// --------------------------------------------------
// GET – Sunucudan başlık çek
// --------------------------------------------------
async function getTitleFromServer() {
  try {
    const res = await fetch(TITLE_API, { method: "GET", credentials: "omit" });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);

    const data = await res.json();
    const title = data.title ?? null;

    if (title && title !== lastSeenTitleFromServer) {
      lastSeenTitleFromServer = title;
      nobkText.textContent = title;
      console.log("🟢 NobkTitle (server):", title);
    }
  } catch (err) {
    console.error("🚨 Title alınamadı:", err);
    nobkText.textContent = "Bağlantı hatası";
  }
}


// --------------------------------------------------
// PATCH – Yeni başlığı server'a gönder
// --------------------------------------------------
async function patchTitleToServer(newTitle) {
  try {
    console.log("📤 PATCH gönderiliyor:", newTitle);

    const res = await fetch(TITLE_API, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
      credentials: "omit"
    });

    let data = {};
    try { data = await res.json(); } catch(e) {}

    if (!res.ok) {
      console.error("🚨 Server hata:", res.status, data);
      return;
    }

    lastSeenTitleFromServer = newTitle;
    nobkText.textContent = newTitle;

    console.log("✅ Başlık güncellendi:", newTitle);
  } catch (err) {
    console.error("🚨 PATCH gönderilemedi:", err);
  }
}


// --------------------------------------------------
// Mesajları tarar – !title komutunu bulur
// --------------------------------------------------
function checkAllMessages() {
  const chatContainer = document.querySelector('.messageList_1GRn-');
  if (!chatContainer) return;

  const messages = chatContainer.querySelectorAll('.ce-msg');
  if (messages.length === 0) return;

  for (let i = messages.length - 1; i >= 0; i--) {
    const text = messages[i].textContent?.trim();
    if (!text) continue;

    if (text.startsWith("!title ")) {
      if (text === lastProcessedMessageText) return;

      console.log("🆕 Yeni !title mesajı:", text);
      lastProcessedMessageText = text;

      const newTitle = text.replace(/^!title\s+/, "").trim();

      if (newTitle) {
        console.log("🎯 Yeni başlık:", newTitle);
        patchTitleToServer(newTitle);
      }
      return;
    }
  }
}


// --------------------------------------------------
// Chat observer (DOM değişimi yakalar)
// --------------------------------------------------
function initChatObserver() {
  console.log("👀 Chat Observer başlatılıyor...");

  const chatContainer = document.querySelector('.messageList_1GRn-');
  if (!chatContainer) {
    console.warn("⚠️ Chat container yok, tekrar denenecek...");
    setTimeout(initChatObserver, 1000);
    return;
  }

  let checkTimer = null;

  const observer = new MutationObserver(() => {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
      console.log("🔄 DOM değişti, mesaj kontrol ediliyor...");
      checkAllMessages();
    }, 100);
  });

  observer.observe(chatContainer, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log("✅ Observer aktif");
}


// --------------------------------------------------
// Periyodik tarama
// --------------------------------------------------
function startPeriodicCheck() {
  setInterval(() => {
    console.log("⏰ Periyodik kontrol...");
    checkAllMessages();
  }, 2000);
}


// --------------------------------------------------
// Başlangıç
// --------------------------------------------------
console.log("🚀 Sistem başlatılıyor...");
getTitleFromServer();
setInterval(getTitleFromServer, 5000);

setTimeout(checkAllMessages, 1000);
initChatObserver();
startPeriodicCheck();

console.log("💡 Hazır! '!title [başlık]' ile başlık değiştirebilirsiniz.");
