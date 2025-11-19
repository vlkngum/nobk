let badgeData = {};

function injectBadges(messageElement) {
  if (!messageElement || messageElement.dataset.layoutModified) {
    return;
  }

  const ownerBadge = messageElement.querySelector('.badge_3zGFV.badge_3AnmB');
  if (ownerBadge) {
    ownerBadge.remove();
  }

  const timeElement = messageElement.querySelector('.time_2hGP-');
  const mainContainer = messageElement.children[0];
  
  if (timeElement && mainContainer) {
    mainContainer.appendChild(timeElement);
    timeElement.classList.add('custom-time-right');
  }

  const usernameEl = messageElement.querySelector('h3.userName_2Rhmz');
  const container = messageElement.querySelector('.userNameContainer_3qH0y');
  
  if (usernameEl && container) {
    const usernameOnPage = usernameEl.textContent.trim().toLowerCase();
    const dbUsernameKey = Object.keys(badgeData).find(key => key.toLowerCase() === usernameOnPage);
    
    const userBadges = dbUsernameKey ? badgeData[dbUsernameKey] : null;

    if (userBadges && userBadges.length > 0) {
      console.log(`${usernameOnPage} için ${userBadges.length} rozet bulundu:`, userBadges);
      
      userBadges.forEach(badgeInfo => {
        const img = document.createElement('img');
        img.src = badgeInfo.url; 
        img.className = 'custom-badge-img';
        img.title = badgeInfo.name; 
        
        container.appendChild(img);
        console.log(`Rozet eklendi: ${badgeInfo.name} - ${badgeInfo.url}`);
      });
    }
  }
  
  messageElement.dataset.layoutModified = 'true';
}

function startObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { 
          if (node.matches && node.matches('.message_1Ng5r')) {
            injectBadges(node);
          }
          node.querySelectorAll('.message_1Ng5r').forEach(injectBadges);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  document.querySelectorAll('.message_1Ng5r').forEach(injectBadges);
}

chrome.runtime.sendMessage({ action: "getBadgeData" }, (response) => {
  console.log('Arka plandan gelen HAM YANIT (response):', response); 
  console.log('Response yapısı:', JSON.stringify(response, null, 2));

  if (response && response.success) {
    badgeData = response.data;
    console.log('VERİ BAŞARILI: badgeData içeriği:', badgeData);
    console.log('Kullanıcı isimleri:', Object.keys(badgeData));
    
    Object.keys(badgeData).forEach(username => {
      console.log(`${username} kullanıcısının rozetleri:`, badgeData[username]);
    });
    
    startObserver();
  } else {
    console.error('VERİ HATASI:', response ? response.error : 'Bilinmeyen bir hata.');
  }

});
