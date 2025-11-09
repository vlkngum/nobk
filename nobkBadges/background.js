const API_URL = 'https://nobk-badge-back.vercel.app/api/get-badges';
const CACHE_DURATION = 60000; // 1 dakika (test için)

async function fetchBadgeData() {
  try {
    // Cache bypass ekle
    const response = await fetch(API_URL + '?t=' + Date.now(), {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`API Hatası: ${response.status} (${response.statusText})`);
    }
    
    const data = await response.json();
    console.log('🔥 API\'dan gelen RAW data:', JSON.stringify(data, null, 2));
    
    const cacheData = {
      badgeData: data,
      lastFetch: Date.now()
    };
    await chrome.storage.local.set(cacheData);
    console.log('✅ Rozet verisi önbelleğe alındı:', cacheData);
    return { success: true, data: data };
  } catch (error) {
    console.error('❌ Rozet verisi çekilemedi:', error);
    return { success: false, error: error.message };
  }
}

async function getCachedBadgeData(forceRefresh = false) {
  try {
    if (!forceRefresh) {
      const cache = await chrome.storage.local.get(['badgeData', 'lastFetch']);
      console.log('📦 Cache içeriği:', cache);
      
      if (cache.badgeData && (Date.now() - cache.lastFetch < CACHE_DURATION)) {
        console.log('♻️ Cache\'den yüklendi (geçerlilik süresi kaldı:', Math.round((CACHE_DURATION - (Date.now() - cache.lastFetch)) / 1000), 'saniye)');
        return { success: true, data: cache.badgeData };
      }
    }
    
    console.log('🌐 API\'dan yeni veri çekiliyor...');
    return await fetchBadgeData();
  } catch (e) {
    console.error('⚠️ Cache okuma hatası:', e);
    return await fetchBadgeData();
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBadgeData') {
    (async () => {
      const response = await getCachedBadgeData();
      console.log('📤 Content script\'e gönderilen veri:', JSON.stringify(response, null, 2));
      sendResponse(response);
    })();
    return true;
  }
  
  // Cache'i manuel temizleme komutu
  if (request.action === 'clearCache') {
    (async () => {
      await chrome.storage.local.clear();
      console.log('🗑️ Cache tamamen temizlendi!');
      const freshData = await fetchBadgeData();
      sendResponse(freshData);
    })();
    return true;
  }
  
  // Zorla yenileme komutu
  if (request.action === 'forceRefresh') {
    (async () => {
      const response = await getCachedBadgeData(true);
      sendResponse(response);
    })();
    return true;
  }
});

 