/**
 * 확장 프로그램의 활성화 상태를 설정합니다.
 *
 * @param {number} tabId - 대상 탭 ID
 * @param {boolean} enabled - 활성화 여부
 */
function setExtensionState(tabId, enabled) {
  const iconPath = enabled ? "icons/icon128.png" : "icons/icon_disabled.png";

  chrome.action.setIcon({ tabId, path: iconPath });
  chrome.action[enabled ? "enable" : "disable"](tabId);
}

/**
 * 주어진 URL이 캔버스 도메인인지 확인합니다.
 *
 * @param {string} url - 확인할 URL
 * @return {boolean} 캔버스 도메인 여부
 */
function isCanvasUrl(url) {
  return url && url.includes("canvas.skku.edu");
}

/**
 * 탭의 URL을 기반으로 확장 프로그램 상태를 업데이트합니다.
 *
 * @param {number} tabId - 대상 탭 ID
 * @param {string} url - 탭 URL
 */
function updateExtensionForTab(tabId, url) {
  setExtensionState(tabId, isCanvasUrl(url));
}

// 탭 URL 변경 감지
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateExtensionForTab(tabId, changeInfo.url);
  }
});

// 서비스 워커 시작 시 열린 탭 확인
chrome.tabs.query({}).then((tabs) => {
  tabs.forEach((tab) => updateExtensionForTab(tab.id, tab.url));
});

// 탭 활성화 감지
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId).then((tab) => {
    updateExtensionForTab(tab.id, tab.url);
  });
});
