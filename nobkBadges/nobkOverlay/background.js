chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "API_POST") {
    fetch("https://nobk-badge-back.vercel.app/api/selected-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: request.videoId })
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
