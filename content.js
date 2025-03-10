/**
 * 지정된 이름의 쿠키 값을 반환합니다.
 *
 * @param {string} name - 검색할 쿠키 이름
 * @return {string|null} 쿠키 값 또는 찾지 못한 경우 null
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}
