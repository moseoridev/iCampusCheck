/**
 * 쿠키 값을 가져옵니다.
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

/**
 * 두 날짜 사이의 시간 차이를 밀리초 단위로 계산합니다.
 */
function getTimeGap(now, date) {
  if (!date) return -1;
  return new Date(date).getTime() - now.getTime();
}

/**
 * 항목을 남은 시간 순으로 정렬합니다.
 */
function sortByRemainingTime(items) {
  return [...items].sort((a, b) => a.remainingTime_ms - b.remainingTime_ms);
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
      // 요청 시간 제한
      signal: AbortSignal.timeout(5000),
    });

    let text = await response.text();
    text = text.replace(/^while\(1\);/, "");
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
      // 요청 시간 제한
      signal: AbortSignal.timeout(5000),
    });

    let text = await response.text();
    text = text.replace(/^while\(1\);/, "");
    const modules = JSON.parse(text);

    // 모듈 처리를 최적화: Promise.all로 병렬 처리
    await Promise.all(
      modules.map(async (module) => {
        if (!module.module_items || !Array.isArray(module.module_items)) {
          return;
        }

        // 항목 처리 최적화: Promise.all 사용하여 병렬 처리
        const itemPromises = module.module_items.map(async (item) => {
          // content_data가 없거나 마감기한이 없으면 null 반환
          if (!item.content_data || !item.content_data.due_at) {
            return null;
          }

          const remainingTime = getTimeGap(now, item.content_data.due_at);
          const isUnlocked =
            !item.content_data.unlock_at ||
            getTimeGap(now, item.content_data.unlock_at) < 0;

          // 열람 가능하고 마감기한이 남은 항목만 처리
          if (remainingTime > 0 && isUnlocked) {
            const itemData = {
              course: courseName,
              title: item.title,
              remainingTime_ms: remainingTime,
              due: item.content_data.due_at,
              url: `https://canvas.skku.edu/courses/${courseId}/modules/items/${item.module_item_id}`,
            };

            // 강의 항목
            if (
              item.content_data.use_attendance &&
              item.attendance_status !== "attendance"
            ) {
              return { type: "lecture", data: itemData };
            }
            // 과제 항목
            else if (item.content_type === "assignment" && !item.completed) {
              return { type: "assignment", data: itemData };
            }
          }
          return null;
        });

        // 모든 항목 처리가 완료될 때까지 기다림
        const processedItems = await Promise.all(itemPromises);

        // null이 아닌 항목만 필터링하고 해당 배열에 추가
        processedItems
          .filter((item) => item !== null)
          .forEach((item) => {
            result[item.type].push(item.data);
          });
      }),
    );

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

    // 2. 각 과목별로 모듈 정보를 병렬로 가져오고 처리
    const modulePromises = courses.map((course) =>
      getCourseModules(course.id, course.name),
    );

    // Promise.allSettled로 일부 실패해도 계속 진행
    const results = await Promise.allSettled(modulePromises);

    // 3. 결과 병합 (성공한 요청만)
    const thingsToDo = {
      lecture: [],
      assignment: [],
    };

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        thingsToDo.lecture.push(...result.value.lecture);
        thingsToDo.assignment.push(...result.value.assignment);
      }
    });

    // 4. 마감기한에 따라 정렬
    thingsToDo.lecture = sortByRemainingTime(thingsToDo.lecture);
    thingsToDo.assignment = sortByRemainingTime(thingsToDo.assignment);

    return thingsToDo;
  } catch (error) {
    return { lecture: [], assignment: [] };
  }
}

// 스크립트 실행 및 결과 반환
getAllCourseAssignments();
