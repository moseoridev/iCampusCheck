/**
 * HTML DOM이 로드된 후 실행
 */
document.addEventListener("DOMContentLoaded", function () {
  // 시스템 다크모드 감지
  checkDarkMode();

  // 메인 기능 실행
  checkTokenAndRun();

  // 다크모드 토글 버튼 이벤트 리스너
  document
    .getElementById("theme-toggle")
    .addEventListener("click", toggleTheme);

  // 새로고침 버튼 이벤트 리스너
  document
    .getElementById("refresh-button")
    .addEventListener("click", refreshData);
});

/**
 * 시스템 다크모드 감지 및 적용
 */
function checkDarkMode() {
  // 저장된 테마 설정 확인
  chrome.storage.local.get("darkMode", (result) => {
    if (result.darkMode) {
      document.body.classList.add("dark-mode");
    } else if (result.darkMode === false) {
      document.body.classList.remove("dark-mode");
    } else {
      // 설정이 없는 경우 시스템 설정 따르기
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        document.body.classList.add("dark-mode");
      }
    }
  });

  // 시스템 다크모드 변경 감지
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      chrome.storage.local.get("darkMode", (result) => {
        // 사용자가 명시적으로 설정하지 않은 경우에만 시스템 설정 따르기
        if (result.darkMode === undefined) {
          if (e.matches) {
            document.body.classList.add("dark-mode");
          } else {
            document.body.classList.remove("dark-mode");
          }
        }
      });
    });
}

/**
 * 다크모드 토글
 */
function toggleTheme() {
  const isDarkMode = document.body.classList.toggle("dark-mode");
  // 설정 저장
  chrome.storage.local.set({ darkMode: isDarkMode });
}

/**
 * 데이터 새로고침
 */
function refreshData() {
  // 캐시 초기화
  chrome.storage.local.remove(["courseData", "cacheTimestamp"], () => {
    checkTokenAndRun();
  });
}

/**
 * 오류 메시지를 UI에 표시합니다.
 */
function showError(message) {
  document.querySelector(
    "#assignment"
  ).innerHTML = `<div class="error-message">${message}</div>`;
}

/**
 * 로딩 상태를 UI에 표시합니다.
 */
function showLoading(message = "데이터를 불러오는 중입니다...") {
  document.querySelector("#assignment").innerHTML = `
    <div class="loading">
      <h2>${message}</h2>
      <div class="spinner"></div>
    </div>
  `;
}

/**
 * 토큰 확인 및 발행, 데이터 로드 시작
 */
async function checkTokenAndRun() {
  try {
    showLoading();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0].id;

    // 캐시된 데이터 확인
    const cachedData = await checkCache();
    if (cachedData) {
      // 캐시된 데이터로 UI 렌더링
      renderToDoList(cachedData);

      // 백그라운드에서 최신 데이터 확인 (TTL 초과 시에만)
      const now = Date.now();
      chrome.storage.local.get("cacheTimestamp", async (result) => {
        const cacheAge = now - (result.cacheTimestamp || 0);
        // 캐시가 10분 이상 지났으면 업데이트
        if (cacheAge > 10 * 60 * 1000) {
          await refreshDataInBackground(tabId);
        }
      });

      return;
    }

    // 토큰 확인
    const tokenResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return document.cookie
          .split("; ")
          .find((row) => row.startsWith("xn_api_token="))
          ?.split("=")[1];
      },
    });
    const token = tokenResult[0].result;

    if (!token) {
      await generateToken(tabId);
    } else {
      await getLearnStatus(tabId);
    }
  } catch (error) {
    showError("데이터를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.");
    console.log(error);
  }
}

/**
 * 캐시된 데이터 확인
 */
function checkCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["courseData", "cacheTimestamp"], (result) => {
      if (result.courseData && result.cacheTimestamp) {
        const now = Date.now();
        const cacheAge = now - result.cacheTimestamp;

        // 캐시가 30분 이내라면 사용
        if (cacheAge < 30 * 60 * 1000) {
          resolve(result.courseData);
          return;
        }
      }
      resolve(null);
    });
  });
}

/**
 * 백그라운드에서 데이터 새로고침
 */
async function refreshDataInBackground(tabId) {
  try {
    // 토큰 확인
    const tokenResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return document.cookie
          .split("; ")
          .find((row) => row.startsWith("xn_api_token="))
          ?.split("=")[1];
      },
    });

    if (tokenResult[0].result) {
      // 백그라운드에서 데이터 가져오기
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        files: ["executescript.js"],
      });

      if (results[0].result) {
        // 캐시 업데이트
        chrome.storage.local.set({
          courseData: results[0].result,
          cacheTimestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    console.error("백그라운드 데이터 업데이트 실패:", error);
  }
}

/**
 * 토큰을 생성합니다. (병렬 처리 최적화)
 */
async function generateToken(tabId) {
  try {
    // AbortController로 요청 중단 기능 추가
    const controller = new AbortController();
    const signal = controller.signal;

    // 5초 후 자동 중단
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // 과목 데이터를 가져와서 새 탭 열기
    const coursesResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        try {
          const response = await fetch(
            "https://canvas.skku.edu/api/v1/courses",
            {
              method: "GET",
              credentials: "include",
            }
          );

          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (error) {
          return null;
        }
      },
    });

    clearTimeout(timeoutId);
    const courses = coursesResult[0].result;

    if (courses && courses.length > 0) {
      // Promise.race로 가장 빨리 유효한 과목 찾기
      const validCoursePromises = courses.map((course, index) => {
        return new Promise((resolve) => {
          if (course.name) {
            resolve({ course, index });
          } else {
            resolve(null);
          }
        });
      });

      const validCourses = await Promise.all(validCoursePromises);
      const firstValidCourse = validCourses.find((result) => result !== null);

      if (firstValidCourse) {
        const { course } = firstValidCourse;
        const action_url = `https://canvas.skku.edu/courses/${course.id}/external_tools/5`;
        chrome.tabs.create({ url: action_url, active: false });

        showLoading("토큰을 생성하는 중입니다...");

        // 토큰 생성 대기
        await waitForToken(tabId);
      } else {
        showError("유효한 과목을 찾을 수 없습니다. 다시 시도해주세요.");
      }
    } else {
      showError("과목 데이터를 가져오지 못했습니다. 다시 시도해주세요.");
    }
  } catch (error) {
    if (error.name === "AbortError") {
      showError(
        "요청 시간이 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해주세요."
      );
    } else {
      showError("토큰 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  }
}

/**
 * 토큰이 생성될 때까지 대기합니다. (Promise 기반 대기)
 */
function waitForToken(tabId) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 60; // 500ms * 60 = 30초
    let attempts = 0;

    const checkToken = async () => {
      const tokenCheckResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return document.cookie
            .split("; ")
            .find((row) => row.startsWith("xn_api_token="))
            ?.split("=")[1];
        },
      });

      if (tokenCheckResult[0].result) {
        clearInterval(timerID);
        await getLearnStatus(tabId);
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(timerID);
        showError("토큰 생성에 실패했습니다. 새로고침 후 다시 시도해주세요.");
        reject(new Error("Token generation timeout"));
      }

      attempts++;
    };

    const timerID = setInterval(checkToken, 500);
  });
}

/**
 * 학습 상태 데이터를 가져옵니다.
 */
async function getLearnStatus(tabId) {
  try {
    showLoading("학습 데이터를 가져오는 중입니다...");

    // AbortController로 요청 중단 기능 추가
    const controller = new AbortController();
    const signal = controller.signal;

    // 15초 후 자동 중단
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // executescript.js 실행
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["executescript.js"],
    });

    clearTimeout(timeoutId);
    const result = results[0].result;

    if (result) {
      // 캐시 업데이트
      chrome.storage.local.set({
        courseData: result,
        cacheTimestamp: Date.now(),
      });

      renderToDoList(result);
    } else {
      showError("데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
    }
  } catch (error) {
    if (error.name === "AbortError") {
      showError(
        "데이터 로드 시간이 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해주세요."
      );
    } else {
      showError("데이터 로드 중 오류가 발생했습니다.");
    }
  }
}

/**
 * 항목 개수 배지 업데이트
 */
function updateCountBadges(data) {
  // 강의 카운트
  const lectureCount = document.getElementById("lecture-count");
  if (data.lecture.length > 0) {
    lectureCount.textContent = data.lecture.length;
    lectureCount.style.display = "inline-block";
  } else {
    lectureCount.style.display = "none";
  }

  // 과제 카운트
  const assignmentCount = document.getElementById("assignment-count");
  if (data.assignment.length > 0) {
    assignmentCount.textContent = data.assignment.length;
    assignmentCount.style.display = "inline-block";
  } else {
    assignmentCount.style.display = "none";
  }
}

/**
 * 할 일 목록을 렌더링하고 이벤트 리스너를 추가합니다.
 */
function renderToDoList(thingsToDo) {
  // 성능을 위해 DocumentFragment 사용
  const lectureFragment = document.createDocumentFragment();
  const assignmentFragment = document.createDocumentFragment();

  // 이전 이벤트 리스너를 제거하기 위해 이전 요소를 제거
  const lectureContainer = document.querySelector("#lecture");
  const assignmentContainer = document.querySelector("#assignment");

  // 강의 테이블 생성
  const lectureElement = document.createElement("div");
  lectureElement.innerHTML = generateTableHTML(
    thingsToDo.lecture,
    "강의",
    "lecture"
  );
  lectureFragment.appendChild(lectureElement);

  // 과제 테이블 생성
  const assignmentElement = document.createElement("div");
  assignmentElement.innerHTML = generateTableHTML(
    thingsToDo.assignment,
    "과제",
    "assignment"
  );
  assignmentFragment.appendChild(assignmentElement);

  // 렌더링 최적화를 위해 requestAnimationFrame 사용
  requestAnimationFrame(() => {
    // DOM에 한번에 삽입 (리플로우 최소화)
    lectureContainer.innerHTML = "";
    lectureContainer.appendChild(lectureFragment);

    assignmentContainer.innerHTML = "";
    assignmentContainer.appendChild(assignmentFragment);

    // 카운트 업데이트
    updateCountBadges(thingsToDo);

    // 이벤트 위임 적용
    setupEventDelegation(thingsToDo);
  });
}

/**
 * 이벤트 위임 설정
 */
function setupEventDelegation(thingsToDo) {
  // 강의 테이블 이벤트
  document.querySelector("#lecture").addEventListener("click", (e) => {
    handleItemClick(e, thingsToDo.lecture, "lecture");
  });

  // 과제 테이블 이벤트
  document.querySelector("#assignment").addEventListener("click", (e) => {
    handleItemClick(e, thingsToDo.assignment, "assignment");
  });
}

/**
 * 클릭 이벤트 처리
 */
function handleItemClick(e, items, type) {
  const titleElement = e.target.closest(".title");
  if (!titleElement) return;

  const id = titleElement.id;
  const index = parseInt(id.replace(type, ""));

  if (items[index]) {
    chrome.tabs.create({ url: items[index].url, active: false });
  }
}

/**
 * 데이터로부터 HTML 테이블을 생성합니다.
 */
function generateTableHTML(data, caption, type) {
  if (!data || data.length === 0) {
    return `<div class="empty-message">완료할 ${caption}가 없습니다</div>`;
  }

  // 템플릿 문자열 사용하여 HTML 생성 최적화
  let html = `<table class="${type}">
      <caption>${caption} <span class="badge" id="${type}-count">${data.length}</span></caption>
      <thead>
        <tr>
          <th class="colum1">과목</th>
          <th class="colum2">제목</th>
          <th class="colum3">마감기한</th>
          <th class="colum4">남은시간</th>
        </tr>
      </thead>
      <tbody>`;

  // map과 join 사용하여 HTML 생성 최적화
  html += data
    .map((item, i) => {
      const rowClass = i % 2 === 0 ? ' class="even"' : "";
      const urgencyClass = getUrgencyClass(item.remainingTime_ms);
      const urgencyClassAttr = urgencyClass ? ` class="${urgencyClass}"` : "";

      return `<tr${rowClass}>
      <td>${replaceUnderbar(item.course)}</td>
      <td class="title" id="${type}${i}">${replaceUnderbar(item.title)}</td>
      <td>${dateToLocaleString(item.due)}</td>
      <td${urgencyClassAttr}>${msToTime(item.remainingTime_ms)}</td>
    </tr>`;
    })
    .join("");

  html += "</tbody></table>";
  return html;
}
