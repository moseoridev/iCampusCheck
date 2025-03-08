// HTML DOM이 로드된 후 실행
document.addEventListener("DOMContentLoaded", function () {
  checkTokenAndRun();
});

// 토큰 확인 및 발행, 데이터 로드 시작
async function checkTokenAndRun() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0].id;

    // content.js에 정의된 getCookie 함수를 호출하여 토큰 확인
    const tokenResult = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => getCookie("xn_api_token"),
    });
    const token = tokenResult[0].result;

    if (!token) {
      // 토큰이 없으면 과목 데이터를 가져와서 새 탭 열기
      const coursesResult = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: async () => {
          try {
            const response = await fetch(
              "https://canvas.skku.edu/api/v1/courses"
            );
            if (response.ok) {
              return await response.json();
            } else {
              console.error("과목 데이터 가져오기 실패:", response.status);
              return null;
            }
          } catch (error) {
            console.error("Fetch 요청 오류:", error);
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

          // 토큰 생성 대기 (최대 30초)
          let attempts = 0;
          const maxAttempts = 60; // 500ms * 60 = 30초
          const timerID = setInterval(async () => {
            const tokenCheckResult = await chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => getCookie("xn_api_token"),
            });
            attempts++;
            if (tokenCheckResult[0].result) {
              clearInterval(timerID);
              getLearnStatus();
            } else if (attempts >= maxAttempts) {
              clearInterval(timerID);
              document.querySelector("#assignment").innerHTML =
                "토큰 생성에 실패했습니다. 새로고침 후 다시 시도해주세요.";
            }
          }, 500);
        } else {
          console.error("유효한 과목이 없습니다.");
        }
      } else {
        console.error("과목 데이터를 가져오지 못했습니다.");
      }
    } else {
      // 토큰이 있으면 바로 학습 상태 확인
      getLearnStatus();
    }
  } catch (error) {
    console.error("토큰 확인 중 오류:", error);
  }
}

// 학습 상태 데이터를 가져오기 위해 executescript.js 실행
async function getLearnStatus() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0].id;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["/executescript.js"],
    });
    const result = results[0].result;

    if (result) {
      const thingsToDo = sortToDo(result);
      viewToDo(thingsToDo, function () {
        for (let i = 0; i < thingsToDo.lecture.length; i++) {
          const id = "lecture" + i;
          const action_url = thingsToDo.lecture[i].url;
          document.getElementById(id).addEventListener("click", () => {
            console.log(action_url);
            moveToContent(action_url);
          });
        }
        for (let i = 0; i < thingsToDo.assignment.length; i++) {
          const id = "assignment" + i;
          const action_url = thingsToDo.assignment[i].url;
          document.getElementById(id).addEventListener("click", () => {
            moveToContent(action_url);
          });
        }
      });
    } else {
      document.querySelector("#assignment").innerHTML =
        "데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.";
    }
  } catch (error) {
    console.error("데이터 가져오기 오류:", error);
    document.querySelector("#assignment").innerHTML =
      "데이터 로드 중 오류가 발생했습니다.";
  }
}

// 새 탭에서 콘텐츠 열기
function moveToContent(action_url) {
  chrome.tabs.create({ url: action_url, active: false });
}

// To-Do 리스트를 HTML 테이블로 표시
function viewToDo(thingsToDo, callback) {
  const lecture = document.querySelector("#lecture");
  const assignment = document.querySelector("#assignment");
  lecture.border = 1;
  assignment.border = 1;

  const lectureHTML =
    "<table class='lecture'><caption>강의</caption>" +
    add_HTMLTAG(thingsToDo.lecture, "lecture");
  const assignmentHTML =
    "<table class='assignment'><caption><span class='caption'>과제</span></caption>" +
    add_HTMLTAG(thingsToDo.assignment, "assignment");

  lecture.innerHTML = lectureHTML;
  assignment.innerHTML = assignmentHTML;

  callback();
}

// 테이블에 삽입할 HTML 생성
function add_HTMLTAG(data, type) {
  let html =
    '<thead><tr><th class="colum1">과목</th><th class="colum2">제목</th><th class="colum3">마감기한</th><th class="colum4">남은시간</th></tr></thead><tbody>';
  for (let i = 0; i < data.length; i++) {
    const id = `${type}${i}`;
    const rowClass = i % 2 === 0 ? ' class="even"' : "";
    html += `<tr${rowClass}><td>${replaceUnderbar(
      data[i].course
    )}</td><td class="title" id="${id}">${replaceUnderbar(
      data[i].title
    )}</td><td>${dateToLocaleString(
      data[i].due
    )}</td><td class="colum4">${msToTime(data[i].remainingTime_ms)}</td></tr>`;
  }
  html += "</tbody></table>";
  return html;
}

// 남은 시간순으로 정렬
function sortToDo(thingsToDo) {
  thingsToDo.lecture.sort((a, b) => a.remainingTime_ms - b.remainingTime_ms);
  thingsToDo.assignment.sort((a, b) => a.remainingTime_ms - b.remainingTime_ms);
  return thingsToDo;
}

// 시간 차이 계산
function gapTime(now, date) {
  return new Date(date).getTime() - now.getTime();
}

// 남은 시간을 보기 좋게 변환
function msToTime(time_ms) {
  const minutes = Math.floor((time_ms / (1000 * 60)) % 60);
  const hours = Math.floor((time_ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(time_ms / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}일`;
  if (hours > 0) return `${hours}시간`;
  if (minutes > 0) return `${minutes}분`;
  return "";
}

// 날짜를 보기 좋게 포맷팅
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

// 요일 반환
function dayOfWeek(date) {
  const week = ["일", "월", "화", "수", "목", "금", "토"];
  return week[date.getDay()];
}

// 한 자리 수 앞에 공백 추가
function addSpace(num) {
  return num < 10 ? "  " + num : num;
}

// 언더바를 공백으로 교체
function replaceUnderbar(str) {
  return str.replace(/_/g, " ");
}
