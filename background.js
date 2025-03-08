// Function to enable or disable the extension
function setExtensionState(tabId, enabled) {
  if (enabled) {
    chrome.action.enable(tabId);
    chrome.action.setIcon({
      tabId: tabId,
      path: "icon.png",
    });
  } else {
    chrome.action.disable(tabId);
    chrome.action.setIcon({
      tabId: tabId,
      path: "icon_disabled.png",
    });
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const enabled = changeInfo.url.includes("canvas.skku.edu");
    setExtensionState(tabId, enabled);
  }
});

// Check already open tabs when the service worker starts
chrome.tabs.query({}).then((tabs) => {
  for (let tab of tabs) {
    if (tab.url) {
      const enabled = tab.url.includes("canvas.skku.edu");
      setExtensionState(tab.id, enabled);
    }
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId).then((tab) => {
    if (tab.url) {
      const enabled = tab.url.includes("canvas.skku.edu");
      setExtensionState(tab.id, enabled);
    }
  });
});
