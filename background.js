// Function to enable or disable the extension
function setExtensionState(tabId, enabled) {
  if (enabled) {
    browser.action.enable(tabId);
    browser.action.setIcon({
      tabId: tabId,
      path: "icon.png",
    });
  } else {
    browser.action.disable(tabId);
    browser.action.setIcon({
      tabId: tabId,
      path: "icon.png",
    });
  }
}

// Listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const enabled = changeInfo.url.includes("canvas.skku.edu");
    setExtensionState(tabId, enabled);
  }
});

// Check already open tabs
browser.tabs.query({}).then((tabs) => {
  for (let tab of tabs) {
    const enabled = tab.url.includes("canvas.skku.edu");
    setExtensionState(tab.id, enabled);
  }
});

// Listen for tab activation
browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId).then((tab) => {
    const enabled = tab.url.includes("canvas.skku.edu");
    setExtensionState(tab.id, enabled);
  });
});
