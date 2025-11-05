(async () => {
  // 7TV API'den emote setini dinamik olarak yükle
  async function load7TVEmotes() {
    try {
      const EMOTE_SET_ID = '01JKR969M7FQ4R5G8YYHM4G2AE';
      const response = await fetch(`https://7tv.io/v3/emote-sets/${EMOTE_SET_ID}`);
      const data = await response.json();
      
      // Emote'ları map'e dönüştür - İsimleri orijinal haliyle tut
      const emojiMap = {};
      if (data.emotes && Array.isArray(data.emotes)) {
        data.emotes.forEach(emote => {
          const name = emote.name;
          const id = emote.id;
          emojiMap[name] = `https://cdn.7tv.app/emote/${id}/4x.webp`;
        });
      }
      
      console.log('7TV emotes loaded:', Object.keys(emojiMap).length);
      return emojiMap;
    } catch (error) {
      console.error('7TV emotes yüklenemedi:', error);
      return {};
    }
  }

  // Local emoji.json dosyasını yükle
  async function loadLocalEmojis() {
    try {
      const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL("emoji.json")
        : "emoji.json";
      const res = await fetch(url);
      const localEmojis = await res.json();
      
      // Local emoji URL'lerini düzenle
      const processedEmojis = {};
      for (const [key, value] of Object.entries(localEmojis)) {
        processedEmojis[key] = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
          ? chrome.runtime.getURL(value)
          : value;
      }
      
      console.log('Local emojis loaded:', Object.keys(processedEmojis).length);
      return processedEmojis;
    } catch (error) {
      console.error('Local emojis yüklenemedi:', error);
      return {};
    }
  }

  // Her iki kaynaktan emoji yükle ve birleştir
  const [tvEmotes, localEmotes] = await Promise.all([
    load7TVEmotes(),
    loadLocalEmojis()
  ]);

  // 7TV emote'ları öncelikli, sonra local emojiler (çakışma varsa 7TV kazanır)
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

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const patterns = Object.keys(emojiMap).map(key => ({
    key,
    regex: new RegExp(`\\b${escapeRegex(key)}\\b`, 'i'),
    url: emojiMap[key],
    source: tvEmotes[key] ? '7tv' : 'local' // Kaynak bilgisi
  }));
  
  console.debug('patterns loaded:', patterns.length);
  try { window.__emojiPatterns = patterns; } catch (e) {}

  function replaceEmojis(root) {
    try {
      const enabled = window.__emojiReplacerEnabled === undefined
        ? (localStorage.getItem('emojiReplacerEnabled') !== 'false')
        : !!window.__emojiReplacerEnabled;
      if (!enabled) return;
    } catch (e) {}
    
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parentTag = node.parentElement && node.parentElement.tagName;
        if (!parentTag) return NodeFilter.FILTER_REJECT;
        const skipTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'];
        if (skipTags.includes(parentTag)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    const toReplace = [];
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      for (const p of patterns) {
        if (p.regex.test(textNode.nodeValue)) {
          toReplace.push({ textNode, pattern: p });
          break;
        }
      }
    }

    toReplace.forEach(({ textNode, pattern }) => {
      const parent = textNode.parentNode;
      const parts = textNode.nodeValue.split(new RegExp(`(${pattern.regex.source})`, 'i'));
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        if (i % 2 === 1) {
          const img = document.createElement('img');
          img.src = pattern.url;
          img.style.height = '32px';
          img.style.verticalAlign = 'middle';
          parent.insertBefore(img, textNode);
        } else {
          parent.insertBefore(document.createTextNode(part), textNode);
        }
      }
      parent.removeChild(textNode);
    });
  }

  function ensureEmojiPanel() {
    if (document.querySelector('#emoji-panel-button')) return;

    // Button (dex.png)
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

  function insertToComposer(text) {
    const ta = document.querySelector('.ce-textarea');
    if (ta && ta.tagName === 'TEXTAREA') {
      ta.focus();
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
            try { ce.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch (e) {}
            return;
          }
        }
      } catch (e) {}

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
          const range2 = document.createRange();
          range2.selectNodeContents(ce);
          range2.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range2);
        }
      } catch (e) {
        ce.innerText = (ce.innerText || '') + text;
      }
      try { ce.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch (e) {}
      try { ce.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
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