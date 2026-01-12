chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // URL'nin sonunun doğru olduğundan emin ol
    const BASE_URL = "https://nobk-badge-back.vercel.app/api/tts";

    // Ortak Fetch Fonksiyonu (Kod tekrarını önlemek için)
    const handleRequest = (method, body = null) => {
        const options = {
            method: method,
            headers: { "Content-Type": "application/json" }
        };
        if (body) options.body = JSON.stringify(body);

        fetch(BASE_URL, options)
            .then(async (res) => {
                // 1. Önce sunucudan gelen ham veriyi (text) alalım
                const textData = await res.text();

                // 2. Durum kodunu kontrol edelim (200-299 arası başarılıdır)
                if (!res.ok) {
                    console.error(`[API HATA] Status: ${res.status}`, textData);
                    return sendResponse({
                        success: false,
                        error: `Sunucu Hatası: ${res.status}`,
                        details: textData
                    });
                }

                // 3. Veri boşsa hata vermesin (JSON parse etmeye çalışma)
                if (!textData) {
                    return sendResponse({ success: true, data: {} });
                }

                // 4. Şimdi JSON'a çevirmeyi deneyelim
                try {
                    const jsonData = JSON.parse(textData);
                    sendResponse({ success: true, data: jsonData });
                } catch (e) {
                    console.error("[JSON PARSE HATA]", textData);
                    sendResponse({ success: false, error: "Sunucu JSON dönmedi (HTML olabilir)." });
                }
            })
            .catch(err => {
                console.error("[FETCH HATA]", err);
                sendResponse({ success: false, error: err.message });
            });
    };

    // --- YÖNLENDİRMELER ---
    if (request.action === "SEND_MESSAGE") {
        handleRequest("POST", request.payload);
        return true;
    }

    if (request.action === "CHECK_MESSAGE") {
        handleRequest("GET");
        return true;
    }

    if (request.action === "DELETE_MESSAGE") {
        handleRequest("DELETE");
        return true;
    }
});