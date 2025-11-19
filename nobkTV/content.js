(async () => {
  async function load7TVEmotes() {
  try {
    const EMOTE_SET_ID = '01JKR969M7FQ4R5G8YYHM4G2AE';
    const response = await fetch(`https://7tv.io/v3/emote-sets/${EMOTE_SET_ID}`);

    if (!response.ok) {
      console.error("7TV API hata:", response.status);
      return {};
    }

    const data = await response.json();

    if (!data.emotes || !Array.isArray(data.emotes)) {
      console.error("7TV emote datası geçersiz:", data);
      return {};
    }

    const emojiMap = {};

    data.emotes.forEach(e => {
      if (!e || !e.id || !e.name) return;
      emojiMap[e.name] = `https://cdn.7tv.app/emote/${e.id}/4x.webp`;
    });

    console.log('7TV emotes loaded:', Object.keys(emojiMap).length);
    return emojiMap;

  } catch (error) {
    console.error('7TV emotes yüklenemedi:', error);
    return {};
  }
}


  async function loadLocalEmojis() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL("emoji.json")
      : "emoji.json";

    const res = await fetch(url);
    if (!res.ok) {
      console.error("Local emoji dosyası okunamadı:", res.status);
      return {};
    }

    const json = await res.json();
    const out = {};

    for (const key in json) {
      const fileUrl = chrome?.runtime?.getURL
        ? chrome.runtime.getURL(json[key])
        : json[key];

      out[key] = fileUrl;
    }

    console.log("Local emojis loaded:", Object.keys(out).length);
    return out;

  } catch (error) {
    console.error('Local emojis yüklenemedi:', error);
    return {};
  }
}


  const [tvEmotes, localEmotes] = await Promise.all([
    load7TVEmotes(),
    loadLocalEmojis()
  ]);

  const emojiMap = { ...localEmotes, ...tvEmotes };
  
  console.log('Total emojis loaded:', Object.keys(emojiMap).length);
  
  try {
    window.__emojiMap = emojiMap;
    window.__7tvEmotes = tvEmotes;
    window.__localEmotes = localEmotes;
    window.__emojiReplacerEnabled = localStorage.getItem('emojiReplacerEnabled') !== 'false';
  } catch (e) {}

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      const observer = new MutationObserver((mutations, obs) => {
        const el2 = document.querySelector(selector);
        if (el2) {
          obs.disconnect();
          resolve(el2);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error("Element not found: " + selector));
      }, timeout);
    });
  }

  let chatContainer;
  try {
    chatContainer = await waitForElement(".messageList_1GRn-");
  } catch (e) {
    console.error("Chat container bulunamadı:", e);
    return;
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          setTimeout(() => {
            node.querySelectorAll(".ce-msg").forEach(msg => replaceEmojis(msg));
            if (node.matches && node.matches(".ce-msg")) {
              replaceEmojis(node);
            }
          }, 40);
        }
      }
      if (mutation.type === 'characterData') {
        const parentEl = mutation.target.parentElement;
        if (parentEl) {
          const msgEl = parentEl.closest && parentEl.closest('.ce-msg');
          if (msgEl) replaceEmojis(msgEl);
        }
      }
    }
  });

  observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });
  document.querySelectorAll(".ce-msg").forEach(msg => replaceEmojis(msg));

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const patterns = Object.keys(emojiMap).map(key => {
    const safe = escapeRegex(key);

    return {
      key,
      regex: new RegExp(`(^|[^\\p{L}\\p{N}_])(${safe})(?=([^\\p{L}\\p{N}_]|$))`, "u"),
      url: emojiMap[key]
    };
  });

console.debug('patterns loaded:', patterns.length);
try { window.__emojiPatterns = patterns; } catch (e) {}

  function replaceEmojis(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  const nodes = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    nodes.push(n);
  }

  for (const node of nodes) {
    const txt = node.nodeValue;
    const matches = [];

    for (const p of (window.__emojiPatterns || [])) {
      let flags = "gu";
      try {
        // mevcut regex'in flag'lerini korumaya çalış, ama mutlaka 'g' ve 'u' ekle
        const existingFlags = (p.regex && p.regex.flags) ? p.regex.flags : "";
        flags = Array.from(new Set(existingFlags.split("").concat(["g","u"]))).join("");
      } catch (e) {
        flags = "gu";
      }
      const rx = new RegExp(p.regex.source, flags);

      let m;
      while ((m = rx.exec(txt)) !== null) {
        const prefixLen = (m[1] != null) ? String(m[1]).length : 0;
        const emoteText = m[2] != null ? m[2] : m[0];
        const emoteStart = m.index + prefixLen;
        const emoteEnd = emoteStart + emoteText.length;

        matches.push({
          start: emoteStart,
          end: emoteEnd,
          key: p.key,
          url: p.url,
          text: emoteText,
          priority: 0 
        });

        if (rx.lastIndex === m.index) rx.lastIndex++;
      }
    }

    if (matches.length === 0) continue;

    matches.sort((a,b) => a.start - b.start || a.end - b.end);
    const filtered = [];
    let lastEnd = -1;
    for (const mt of matches) {
      if (mt.start >= lastEnd) {
        filtered.push(mt);
        lastEnd = mt.end;
      } 
    }

    // DocumentFragment inşa et
    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const m of filtered) {
      if (m.start > cursor) {
        frag.appendChild(document.createTextNode(txt.slice(cursor, m.start)));
      }

      const img = document.createElement('img');
      img.src = m.url;
      img.alt = m.key;
      img.title = m.key;
      img.style.height = '32px';
      img.style.verticalAlign = 'middle';
      frag.appendChild(img);

      cursor = m.end;
    }
    if (cursor < txt.length) {
      frag.appendChild(document.createTextNode(txt.slice(cursor)));
    }

    const parent = node.parentNode;
    if (parent) parent.replaceChild(frag, node);
  }
}



  function ensureEmojiPanel() {
    if (document.querySelector('#emoji-panel-button')) return;

    const btn = document.createElement('button');
    btn.id = 'emoji-panel-button';
    btn.style.position = 'fixed';
    btn.style.right = '12px';
    btn.style.bottom = '12px';
    btn.style.zIndex = '999999';
    btn.style.padding = '0';
    btn.style.borderRadius = '50%';
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.width = '30px';
    btn.style.height = '30px';
    
    const btnImg = document.createElement('img');
    btnImg.src = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('emoji/dex.png')
      : 'emoji/dex.png';
    btnImg.alt = 'Show Emojis';
    btnImg.style.width = '100%';
    btnImg.style.height = '100%';
    btnImg.style.objectFit = 'contain';
    btnImg.style.display = 'block';
    btn.appendChild(btnImg);

    const panel = document.createElement('div');
    panel.id = 'emoji-panel';
    panel.style.cssText = `
      position: fixed;
      right: 12px;
      bottom: 56px;
      z-index: 999999;
      width: 500px;
      max-height: 70vh;
      overflow: auto;
      background: #18181b;
      color: #fff;
      border: 1px solid #2f2f35;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.6);
      display: none;
    `;

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search emojis...';
    search.style.cssText = `
      width: 100%;
      padding: 8px;
      margin-bottom: 12px;
      border-radius: 6px;
      border: 1px solid #2f2f35;
      background: #0e0e10;
      color: #fff;
    `;

    const grid = document.createElement('div');
    grid.id = 'emoji-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    `;

    panel.appendChild(search);
    panel.appendChild(grid);
    document.body.appendChild(panel);
    document.body.appendChild(btn);

    let allEmojis = [];
    let currentPage = 0;
    const PAGE_SIZE = 20;
    let isLoading = false;

    function loadMore() {
      if (isLoading) return;
      isLoading = true;

      const start = currentPage * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const batch = allEmojis.slice(start, end);

      batch.forEach(p => {
        const card = document.createElement('div');
        card.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
          border: 1px solid #2f2f35;
        `;
        card.onmouseenter = () => card.style.background = '#2f2f35';
        card.onmouseleave = () => card.style.background = 'transparent';
        
        const img = document.createElement('img');
        img.src = p.url;
        img.style.cssText = `
          width: 64px;
          height: 64px;
          object-fit: contain;
        `;
        img.title = p.key;
        
        const label = document.createElement('div');
        label.textContent = p.key;
        label.style.cssText = `
          font-size: 12px;
          color: #adadb8;
          font-weight: 500;
          word-break: break-word;
          text-align: center;
          width: 100%;
        `;
        
        card.addEventListener('click', function() {
          insertToComposer(p.key + ' ');
          panel.style.display = 'none';
        });
        
        card.appendChild(img);
        card.appendChild(label);
        grid.appendChild(card);
      });

      currentPage++;
      isLoading = false;

      if (end < allEmojis.length) {
        checkScroll();
      }
    }

    function checkScroll() {
      const { scrollTop, scrollHeight, clientHeight } = panel;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        loadMore();
      }
    }

    function populate(searchTerm) {
      grid.innerHTML = '';
      currentPage = 0;
      
      const patternsLocal = window.__emojiPatterns || [];
      
      let filtered = patternsLocal;
      
      // Arama terimine göre filtrele
      if (searchTerm) {
        filtered = filtered.filter(p => 
          p.key.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      allEmojis = filtered;
      loadMore();
    }

    panel.addEventListener('scroll', checkScroll);

    btn.addEventListener('click', () => {
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        if (grid.children.length === 0) {
          populate('');
        }
      } else {
        panel.style.display = 'none';
      }
    });

    search.addEventListener('input', (e) => populate(e.target.value));
  }

  window.replaceEmojisAll = function() {
    document.querySelectorAll('.ce-msg').forEach(m => replaceEmojis(m));
  };

  function fixPlaceholderBug(ta) {
  if (ta.value === "" || ta.value == null) {
    ta.value = "";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  }
}

function insertToComposer(text) {
  const ta = document.querySelector('.ce-textarea');
  if (ta && ta.tagName === 'TEXTAREA') {

    fixPlaceholderBug(ta);

    try {
      const start = (typeof ta.selectionStart === 'number') ? ta.selectionStart : ta.value.length;
      const end = (typeof ta.selectionEnd === 'number') ? ta.selectionEnd : start;
      const val = ta.value;

      ta.value = val.slice(0, start) + text + val.slice(end);
      ta.selectionStart = ta.selectionEnd = start + text.length;

      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    } catch (e) {
      ta.value += text;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }

  const ce = document.querySelector('.ce-msgbox.richTextArea_2hdAB[contenteditable="true"], .richTextArea_2hdAB[contenteditable="true"], .ce-msgbox[contenteditable="true"]');

  if (ce) {
    ce.focus();

    try {
      if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        const ok = document.execCommand('insertText', false, text);
        if (ok) {
          ce.dispatchEvent(new InputEvent('input', { bubbles: true }));
          return;
        }
      }
    } catch {}

    const sel = window.getSelection();
    try {
      let didInsert = false;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (ce.contains(range.startContainer)) {
          range.deleteContents();
          const node = document.createTextNode(text);
          range.insertNode(node);
          range.setStartAfter(node);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          didInsert = true;
        }
      }
      if (!didInsert) {
        const node = document.createTextNode(text);
        ce.appendChild(node);
      }
    } catch {
      ce.innerText = (ce.innerText || '') + text;
    }

    try { ce.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch {}
    try { ce.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
  }
}

  try { ensureEmojiPanel(); } catch (e) {}
  try { makePostedEmojisClickable(); } catch (e) {}

  function makePostedEmojisClickable() {
    document.querySelectorAll('.ce-msg img').forEach(img => {
      try {
        const src = img.src || '';
        const patternsLocal = window.__emojiPatterns || [];
        const match = patternsLocal.find(p => (p.url && src.indexOf(p.url) !== -1));
        if (match) {
          img.style.cursor = 'pointer';
          if (!img.dataset.emojiClick) {
            img.dataset.emojiClick = '1';
            img.addEventListener('click', () => {
              const name = match.key + ' ';
              insertToComposer(name);
            });
          }
        }
      } catch (e) {}
    });
  }

  const postedObserver = new MutationObserver(() => {
    makePostedEmojisClickable();
  });
  postedObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
