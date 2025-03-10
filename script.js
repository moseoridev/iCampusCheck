/**
 * HTML DOM이 로드된 후 실행
 */
document.addEventListener("DOMContentLoaded", function () {
  checkTokenAndRun();
});

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
      <img src="loading.svg" alt="Loading" />
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

    // 토큰 확인
    const tokenResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => getCookie("xn_api_token"),
    });
    const token = tokenResult[0].result;

    if (!token) {
      await generateToken(tabId);
    } else {
      await getLearnStatus();
    }
  } catch (error) {
    showError("데이터를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.");
  }
}

/**
 * 토큰을 생성합니다.
 */
async function generateToken(tabId) {
  try {
    // 과목 데이터를 가져와서 새 탭 열기
    const coursesResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        try {
          const response = await fetch(
            "https://canvas.skku.edu/api/v1/courses"
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
    const courses = coursesResult[0].result;

    if (courses && courses.length > 0) {
      // 유효한 과목 찾기
      let index = 0;
      while (index < courses.length && !courses[index].name) index++;

      if (index < courses.length) {
        const action_url = `https://canvas.skku.edu/courses/${courses[index].id}/external_tools/5`;
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
    showError("토큰 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
  }
}

/**
 * 토큰이 생성될 때까지 대기합니다.
 */
function waitForToken(tabId) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 60; // 500ms * 60 = 30초
    let attempts = 0;

    const checkToken = async () => {
      const tokenCheckResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => getCookie("xn_api_token"),
      });

      if (tokenCheckResult[0].result) {
        clearInterval(timerID);
        getLearnStatus();
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
async function getLearnStatus() {
  try {
    showLoading("학습 데이터를 가져오는 중입니다...");

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0].id;

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["/executescript.js"],
    });
    const result = results[0].result;

    if (result) {
      const thingsToDo = sortToDo(result);
      renderToDoList(thingsToDo);
    } else {
      showError("데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
    }
  } catch (error) {
    showError("데이터 로드 중 오류가 발생했습니다.");
  }
}

/**
 * 할 일 목록을 정렬합니다.
 */
function sortToDo(thingsToDo) {
  thingsToDo.lecture.sort((a, b) => a.remainingTime_ms - b.remainingTime_ms);
  thingsToDo.assignment.sort((a, b) => a.remainingTime_ms - b.remainingTime_ms);
  return thingsToDo;
}

/**
 * 할 일 목록을 렌더링하고 이벤트 리스너를 추가합니다.
 */
function renderToDoList(thingsToDo) {
  // HTML 생성
  const lectureHTML = generateTableHTML(thingsToDo.lecture, "강의", "lecture");
  const assignmentHTML = generateTableHTML(
    thingsToDo.assignment,
    "과제",
    "assignment"
  );

  // DOM에 삽입
  document.querySelector("#lecture").innerHTML = lectureHTML;
  document.querySelector("#assignment").innerHTML = assignmentHTML;

  // 이벤트 리스너 추가
  attachClickListeners(thingsToDo.lecture, "lecture");
  attachClickListeners(thingsToDo.assignment, "assignment");
}

/**
 * 항목에 클릭 이벤트 리스너를 추가합니다.
 */
function attachClickListeners(items, type) {
  items.forEach((item, index) => {
    const id = `${type}${index}`;
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("click", () => {
        chrome.tabs.create({ url: item.url, active: false });
      });
    }
  });
}

/**
 * 데이터로부터 HTML 테이블을 생성합니다.
 */
function generateTableHTML(data, caption, type) {
  if (data.length === 0) {
    return `<div class="empty-message">완료할 ${caption}가 없습니다</div>`;
  }

  let html = `<table class="${type}">
      <caption>${caption}</caption>
      <thead>
        <tr>
          <th class="colum1">과목</th>
          <th class="colum2">제목</th>
          <th class="colum3">마감기한</th>
          <th class="colum4">남은시간</th>
        </tr>
      </thead>
      <tbody>`;

  data.forEach((item, i) => {
    const rowClass = i % 2 === 0 ? ' class="even"' : "";
    html += `<tr${rowClass}>
        <td>${replaceUnderbar(item.course)}</td>
        <td class="title" id="${type}${i}">${replaceUnderbar(item.title)}</td>
        <td>${dateToLocaleString(item.due)}</td>
        <td class="colum4">${msToTime(item.remainingTime_ms)}</td>
      </tr>`;
  });

  html += "</tbody></table>";
  return html;
}

/**
 * 남은 시간을 사람이 읽기 쉬운 형식으로 변환합니다.
 */
function msToTime(time_ms) {
  const minutes = Math.floor((time_ms / (1000 * 60)) % 60);
  const hours = Math.floor((time_ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(time_ms / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}일`;
  if (hours > 0) return `${hours}시간`;
  if (minutes > 0) return `${minutes}분`;
  return "곧 마감";
}

/**
 * 날짜를 보기 좋은 형식으로 변환합니다.
 */
function dateToLocaleString(date) {
  const newDate = new Date(date);
  return (
    addSpace(newDate.getMonth() + 1) +
    "월 " +
    addSpace(newDate.getDate()) +
    "일(" +
    dayOfWeek(newDate) +
    ") " +
    newDate.toLocaleTimeString().slice(0, -3)
  );
}

/**
 * 요일을 반환합니다.
 */
function dayOfWeek(date) {
  const week = ["일", "월", "화", "수", "목", "금", "토"];
  return week[date.getDay()];
}

/**
 * 한 자리 수 앞에 공백을 추가합니다.
 */
function addSpace(num) {
  return num < 10 ? "  " + num : num;
}

/**
 * 언더바를 공백으로 교체합니다.
 */
function replaceUnderbar(str) {
  return str.replace(/_/g, " ");
}
