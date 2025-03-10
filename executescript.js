/**
 * 두 날짜 사이의 시간 차이를 밀리초 단위로 계산합니다.
 *
 * @param {Date} now - 현재 시간
 * @param {string|Date} date - 비교할 날짜
 * @return {number} 시간 차이(밀리초), 날짜가 없으면 -1
 */
function getTimeGap(now, date) {
  if (!date) return -1;
  return new Date(date).getTime() - now.getTime();
}

/**
 * Canvas API에서 사용자의 즐겨찾기 과목 목록을 가져옵니다.
 */
async function getCourses() {
  const url = "https://canvas.skku.edu/api/v1/users/self/favorites/courses";

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    let text = await response.text();
    text = text.replace(/^while\(1\);/, ""); // Canvas API 응답에서 "while(1);" 제거
    return JSON.parse(text);
  } catch (error) {
    return [];
  }
}

/**
 * 특정 과목의 모듈(강의 및 과제) 정보를 가져옵니다.
 */
async function getCourseModules(courseId, courseName) {
  const authorizationToken = "Bearer " + getCookie("xn_api_token");
  const url = `https://canvas.skku.edu/learningx/api/v1/courses/${courseId}/modules`;
  const now = new Date();
  const result = { lecture: [], assignment: [] };

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        Authorization: authorizationToken,
      },
    });

    let text = await response.text();
    text = text.replace(/^while\(1\);/, "");
    const modules = JSON.parse(text);

    // 모든 모듈을 순회
    for (const module of modules) {
      if (!module.module_items || !Array.isArray(module.module_items)) {
        continue;
      }

      // 모듈 내 모든 항목 순회
      for (const item of module.module_items) {
        // content_data가 없으면 건너뛰기
        if (!item.content_data || !item.content_data.due_at) {
          continue;
        }

        const remainingTime = getTimeGap(now, item.content_data.due_at);
        const isUnlocked =
          !item.content_data.unlock_at ||
          getTimeGap(now, item.content_data.unlock_at) < 0;

        // 열람 가능하고 마감기한이 남은 항목만 처리
        if (remainingTime > 0 && isUnlocked) {
          const commonData = {
            course: courseName,
            title: item.title,
            remainingTime_ms: remainingTime,
            due: item.content_data.due_at,
            url: `https://canvas.skku.edu/courses/${courseId}/modules/items/${item.module_item_id}`,
          };

          // 강의 항목 처리
          if (
            item.content_data.use_attendance &&
            item.attendance_status !== "attendance"
          ) {
            result.lecture.push(commonData);
          }
          // 과제 항목 처리
          else if (item.content_type === "assignment" && !item.completed) {
            result.assignment.push(commonData);
          }
        }
      }
    }

    return result;
  } catch (error) {
    return { lecture: [], assignment: [] };
  }
}

/**
 * 모든 과목의 과제 및 강의 정보를 병렬로 가져옵니다.
 */
async function getAllCourseAssignments() {
  try {
    // 1. 모든 과목 정보 가져오기
    const courses = await getCourses();

    if (!courses || courses.length === 0) {
      return { lecture: [], assignment: [] };
    }

    // 2. 각 과목별로 모듈 정보를 병렬로 가져오고 처리하기
    const modulePromises = courses.map((course) =>
      getCourseModules(course.id, course.name)
    );

    const results = await Promise.all(modulePromises);

    // 3. 결과 병합
    const thingsToDo = {
      lecture: [],
      assignment: [],
    };

    results.forEach((result) => {
      thingsToDo.lecture.push(...result.lecture);
      thingsToDo.assignment.push(...result.assignment);
    });

    // 4. 마감기한에 따라 정렬
    thingsToDo.lecture.sort((a, b) => a.remainingTime_ms - b.remainingTime_ms);
    thingsToDo.assignment.sort(
      (a, b) => a.remainingTime_ms - b.remainingTime_ms
    );

    return thingsToDo;
  } catch (error) {
    return { lecture: [], assignment: [] };
  }
}

// 스크립트 실행 및 결과 반환
getAllCourseAssignments();
