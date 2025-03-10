/**
 * 유틸리티 함수 모음
 */

/**
 * 두 날짜 사이의 시간 차이를 밀리초 단위로 계산합니다.
 */
function getTimeGap(now, date) {
  if (!date) return -1;
  return new Date(date).getTime() - now.getTime();
}

/**
 * 밀리초를 사람이 읽기 쉬운 형식으로 변환합니다.
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
  if (typeof str !== "string") return "";
  return str.replace(/_/g, " ");
}

/**
 * 항목을 남은 시간 순으로 정렬합니다.
 */
function sortByRemainingTime(items) {
  return [...items].sort((a, b) => a.remainingTime_ms - b.remainingTime_ms);
}

/**
 * 마감 임박도에 따른 클래스를 반환합니다.
 */
function getUrgencyClass(remainingTime_ms) {
  const hours6 = 6 * 60 * 60 * 1000;
  const hours12 = 12 * 60 * 60 * 1000;
  const hours24 = 24 * 60 * 60 * 1000;

  if (remainingTime_ms <= hours6) return "urgent";
  if (remainingTime_ms <= hours12) return "soon";
  if (remainingTime_ms <= hours24) return "warning";
  return "";
}

// 브라우저 환경에서 사용 시 전역 객체로 노출
if (typeof window !== "undefined") {
  window.iCampusUtils = {
    getTimeGap,
    msToTime,
    dateToLocaleString,
    dayOfWeek,
    addSpace,
    replaceUnderbar,
    sortByRemainingTime,
    getUrgencyClass,
  };
}
