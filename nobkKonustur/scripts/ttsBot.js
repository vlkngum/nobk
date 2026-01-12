console.log("[NOBK TTS] Eklenti Başlatıldı (Temiz Veritabanı Modu)...");

const POLL_INTERVAL = 1000;
const MESSAGE_COST = 5; // Puan maliyeti
let isProcessing = false;

// --- ÖNEMLİ: Aynı mesajı tekrar okumamak için ID tutuyoruz ---
let lastPlayedData = "";
// -----------------------------------------------------------

// --- CSS STİLLERİ ---
const style = document.createElement('style');
style.textContent = `
    /* --- 1. AYAR PANELİ VE BUTON --- */
    #tts-overlay {
        display: none; position: fixed; top: 0; left: 0;
        width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7);
        z-index: 9999999; justify-content: center; align-items: center;
        backdrop-filter: blur(5px);
    }
    #tts-modal {
        background: #1e272e; width: 400px; padding: 25px;
        border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        color: white; font-family: sans-serif; text-align: center;
        border: 1px solid #485460; position: relative;
    }
    #tts-close-btn {
        position: absolute; top: 15px; right: 15px; background: none; border: none;
        color: #ff5e57; font-size: 20px; cursor: pointer;
    }
    .tts-field { margin-bottom: 15px; text-align: left; }
    .tts-label { display: block; font-size: 12px; color: #d2dae2; margin-bottom: 5px; }
    #tts-username-display { font-weight: bold; color: #cacacaff; font-size: 16px; }
    #tts-score-display { font-size: 14px; color: #ffdd59; float: right; font-weight: bold; }
    .tts-input {
        width: 100%; padding: 12px; background: #000000;
        border: 1px solid #485460; border-radius: 8px; color: white; font-size: 14px; box-sizing: border-box;
    }
    #tts-send-btn {
        width: 100%; padding: 12px; background: #0b42e8ff; color: #dadadaff;
        font-weight: bold; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; transition: 0.2s;
    }
    #tts-send-btn:hover { background: #193aa0ff; }
    #tts-send-btn:disabled { background: #485460; cursor: not-allowed; color: #808e9b; }
    #tts-float-btn {
        position: fixed; width: 45px; height: 45px; border-radius: 50%; font-size: 24px; 
        background-color: #ff4757; color: white; border: none; cursor: pointer; z-index: 999999;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s;
        display: flex; justify-content: center; align-items: center;
    }
    #tts-float-btn:hover { transform: scale(1.1); }

    /* --- 2. GÖRSEL BİLDİRİM --- */
    @keyframes slideInDown { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    @keyframes pulseGlow { 0% { box-shadow: 0 0 10px #2043aeff; } 50% { box-shadow: 0 0 25px #152e7aff; } 100% { box-shadow: 0 0 10px #0d215cff; } }
    #tts-alert-container {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        z-index: 99999999; display: flex; flex-direction: column; align-items: center; pointer-events: none;
    }
    .donation-card {
        background: linear-gradient(135deg, #1e272e 0%, #485460 100%);
        border-left: 5px solid #0b42e8ff; padding: 15px 25px; border-radius: 8px; color: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 10px 20px rgba(0,0,0,0.5); animation: slideInDown 0.5s ease-out, pulseGlow 2s infinite;
        text-align: center; min-width: 300px; max-width: 500px;
    }
    .donation-header { font-size: 18px; font-weight: bold; color: #ffffffff; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
    .donation-amount { font-size: 28px; font-weight: 900; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); margin-bottom: 10px; display: block; }
    .donation-msg { font-size: 16px; color: #d2dae2; font-style: italic; line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; }
`;
document.head.appendChild(style);

function createUI() {
    const openBtn = document.createElement("button");
    openBtn.innerText = "💸"; openBtn.id = "tts-float-btn";
    document.body.appendChild(openBtn);

    const overlay = document.createElement("div");
    overlay.id = "tts-overlay";
    overlay.innerHTML = `
        <div id="tts-modal">    
            <button id="tts-close-btn">✖</button>
            <h2 style="margin-top:0; color:#0b42e8ff;">Bağış Gönder</h2>
            <div class="tts-field" style="background: #2f3640; padding: 10px; border-radius: 8px;">
                <span class="tts-label">Gönderen:</span>
                <div><span id="tts-username-display">Yükleniyor...</span> <span id="tts-score-display">Puan: ...</span></div>
            </div>
            <div class="tts-field"><label class="tts-label">Bağış Miktarı (Sanal TL)</label><input type="number" id="tts-amount" class="tts-input" value="10"></div>
            <div class="tts-field"><label class="tts-label">Mesajın (Ücret: ${MESSAGE_COST} Puan)</label><textarea id="tts-msg" class="tts-input" rows="3" placeholder="Mesajını buraya yaz..."></textarea></div>
            <button id="tts-send-btn">GÖNDER (${MESSAGE_COST} Puan)</button>
            <div id="tts-status" style="margin-top:10px; font-size:12px; height:15px;"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    function alignButton() {
        const targetBtn = document.getElementById("ganimet-listele-btn");
        const myBtn = document.getElementById("tts-float-btn");
        if (targetBtn && myBtn) {
            const rect = targetBtn.getBoundingClientRect();
            myBtn.style.top = rect.top + "px"; myBtn.style.left = (rect.left - myBtn.offsetWidth - 10) + "px";
        } else if (myBtn) { myBtn.style.bottom = "20px"; myBtn.style.right = "80px"; }
    }
    setInterval(alignButton, 500); window.addEventListener("resize", alignButton); alignButton();

    openBtn.addEventListener("click", async () => {
        const username = getUsername();
        document.getElementById("tts-username-display").innerText = username;
        document.getElementById("tts-score-display").innerText = "Yükleniyor...";
        overlay.style.display = "flex";
        const score = await getUserScore(username);
        document.getElementById("tts-score-display").innerText = `Puan: ${score !== null ? score : 'Hata'}`;
    });

    document.getElementById("tts-close-btn").addEventListener("click", () => overlay.style.display = "none");
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.style.display = "none"; });

    document.getElementById("tts-send-btn").addEventListener("click", async () => {
        const sendBtn = document.getElementById("tts-send-btn");
        const msgInput = document.getElementById("tts-msg");
        const amountInput = document.getElementById("tts-amount");
        const status = document.getElementById("tts-status");

        const text = msgInput.value.trim();
        const amount = amountInput.value || "0";
        const username = document.getElementById("tts-username-display").innerText;

        if (!text) { status.innerText = "⚠️ Mesaj yazmalısın!"; status.style.color = "yellow"; return; }

        sendBtn.disabled = true; status.innerText = "Puan kontrol ediliyor..."; status.style.color = "white";

        try {
            const currentScore = await getUserScore(username);
            if (currentScore === null) throw new Error("Puan alınamadı.");
            if (currentScore < MESSAGE_COST) {
                status.innerText = `❌ Yetersiz Puan! (${currentScore}/${MESSAGE_COST})`; status.style.color = "red";
                sendBtn.disabled = false; return;
            }

            status.innerText = "Puan düşülüyor...";
            await decreaseScore(username);

            status.innerText = "Ses gönderiliyor...";
            chrome.runtime.sendMessage({
                action: "SEND_MESSAGE",
                payload: { text, sender: username, amount: parseInt(amount) }
            }, (response) => {
                if (response && response.success) {
                    status.innerText = "Bağışlandı!"; status.style.color = "#f6f7f7ff"; msgInput.value = "";
                    setTimeout(() => { overlay.style.display = "none"; status.innerText = ""; }, 1500);
                } else { status.innerText = "Mesaj Hatası!"; status.style.color = "red"; }
                sendBtn.disabled = false;
            });
        } catch (err) {
            console.error(err); status.innerText = "❌ İşlem Başarısız!"; status.style.color = "red"; sendBtn.disabled = false;
        }
    });
}

function showNotification(sender, amount, text) {
    const old = document.getElementById("tts-alert-container");
    if (old) old.remove();
    const container = document.createElement("div");
    container.id = "tts-alert-container";
    container.innerHTML = `<div class="donation-card"><div class="donation-header">${sender} BAĞIŞLADI!</div><span class="donation-amount">${amount} TL</span><div class="donation-msg">${text}</div></div>`;
    document.body.appendChild(container);
    setTimeout(() => { if (container) container.remove(); }, 8000);
}

async function getUserScore(username) {
    try {
        const res = await fetch("https://nobk-badge-back.vercel.app/api/get-users");
        const data = await res.json();
        const user = data.find(u => u.username === username);
        return user ? user.score : 0;
    } catch (err) { console.error("[USER SCORE HATA]", err); return null; }
}

async function decreaseScore(username) {
    try {
        const res = await fetch("https://nobk-badge-back.vercel.app/api/get-users", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username })
        });
        return await res.json();
    } catch (err) { console.error("[SCORE UPDATE HATA]", err); return null; }
}

async function speakText(text) {
    if (!text) return;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "tr-TR"; window.speechSynthesis.speak(utterance);
    }
}

function checkMessages() {
    if (isProcessing) return;
    isProcessing = true;

    chrome.runtime.sendMessage({ action: "CHECK_MESSAGE" }, (response) => {
        if (response && response.success) {
            const data = response.data;
            const uniqueID = data.text + data.created_at;

            if (data && data.text && uniqueID !== lastPlayedData) {

                lastPlayedData = uniqueID;

                const amount = data.amount || 0;
                const fullMsg = `${data.sender} ${amount} lira göndermiş. ${data.text}`;

                speakText(fullMsg);
                showNotification(data.sender, amount, data.text);

                setTimeout(() => {
                    console.log("[TTS] Mesaj süresi doldu, siliniyor...");
                    chrome.runtime.sendMessage({ action: "DELETE_MESSAGE" });
                }, 20000);
            }
        }
        isProcessing = false;
    });
}

function getUsername() {
    let userImg = document.querySelector('button.userNameBtn_wpYSY img[alt]');
    if (!userImg) userImg = document.querySelector('img[alt*="#"]');
    return userImg ? userImg.alt.split("#")[0] : "İsimsiz";
}

window.addEventListener("load", () => {
    createUI();
    setInterval(checkMessages, POLL_INTERVAL);
});