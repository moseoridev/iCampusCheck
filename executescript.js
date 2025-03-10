// 두 날짜 사이의 시간 차이 계산 (밀리초)
function getTimeGap(now, date) {
  if (!date) return -1;
  return new Date(date).getTime() - now.getTime();
}

// Canvas API에서 사용자의 즐겨찾기 과목 목록 가져오기
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

    const data = JSON.parse(text);
    console.log("Fetched courses:", data);
    return data;
  } catch (error) {
    console.error("Error fetching courses:", error);
    return [];
  }
}

// 특정 과목의 모듈(강의 및 과제) 정보 가져오기
async function getCourseModules(courseId, courseName) {
  const authorizationToken = "Bearer " + getCookie("xn_api_token");
  const url = `https://canvas.skku.edu/learningx/api/v1/courses/${courseId}/modules`;

  console.log(`Fetching modules for course: ${courseName} (ID: ${courseId})`);

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

    console.log(`Received ${modules.length} modules for ${courseName}`);

    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);

    const result = { lecture: [], assignment: [] };

    // 모든 모듈을 순회
    for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
      const module = modules[moduleIndex];
      console.log(
        `Processing module ${moduleIndex + 1}/${modules.length}: ${
          module.name || "Unnamed module"
        }`
      );

      if (!module.module_items || !Array.isArray(module.module_items)) {
        console.log(`  Module has no items or items property is not an array`);
        continue;
      }

      console.log(`  Module has ${module.module_items.length} items`);

      // 모듈 내 모든 항목 순회
      for (
        let itemIndex = 0;
        itemIndex < module.module_items.length;
        itemIndex++
      ) {
        const item = module.module_items[itemIndex];
        console.log(
          `  Processing item ${itemIndex + 1}: ${
            item.title || "Unnamed item"
          } (Type: ${item.content_type || "unknown"})`
        );

        // content_data가 없으면 건너뛰기
        if (!item.content_data) {
          console.log(`    Item has no content_data, skipping`);
          continue;
        }

        // 마감 기한이 있는 경우만 처리 (due_at은 content_data 안에 있음)
        if (item.content_data.due_at) {
          const remainingTime = getTimeGap(now, item.content_data.due_at);
          console.log(
            `    Remaining time: ${remainingTime} ms (${
              remainingTime > 0 ? "not expired" : "expired"
            })`
          );

          // unlock_at도 content_data 안에 있음
          const isUnlocked =
            !item.content_data.unlock_at ||
            getTimeGap(now, item.content_data.unlock_at) < 0;
          console.log(
            `    Is unlocked: ${isUnlocked} (unlock time: ${
              item.content_data.unlock_at || "not set"
            })`
          );

          // 열람 가능하고 마감기한이 남은 항목만 처리
          if (remainingTime > 0 && isUnlocked) {
            console.log(`    Item is valid (not expired and unlocked)`);

            // 강의 항목 처리 (use_attendance는 content_data 안에 있음)
            if (
              item.content_data.use_attendance &&
              item.attendance_status !== "attendance"
            ) {
              console.log(
                `    Adding to lectures (use_attendance: true, attendance_status: ${item.attendance_status})`
              );
              result.lecture.push({
                course: courseName,
                title: item.title,
                remainingTime_ms: remainingTime,
                due: item.content_data.due_at,
                url: `https://canvas.skku.edu/courses/${courseId}/modules/items/${item.module_item_id}`,
              });
            }
            // 과제 항목 처리 (content_type 사용)
            else if (item.content_type === "assignment" && !item.completed) {
              console.log(
                `    Adding to assignments (content_type: assignment, completed: ${item.completed})`
              );
              result.assignment.push({
                course: courseName,
                title: item.title,
                remainingTime_ms: remainingTime,
                due: item.content_data.due_at,
                url: `https://canvas.skku.edu/courses/${courseId}/modules/items/${item.module_item_id}`,
              });
            } else {
              console.log(
                `    Item does not match criteria for lecture or assignment`
              );
              console.log(
                `    content_data.use_attendance: ${item.content_data.use_attendance}, attendance_status: ${item.attendance_status}`
              );
              console.log(
                `    content_type: ${item.content_type}, completed: ${item.completed}`
              );
            }
          } else {
            console.log(
              `    Item skipped (${
                remainingTime <= 0 ? "expired" : "still locked"
              })`
            );
          }
        } else {
          console.log(`    Item has no due date in content_data, skipping`);
        }
      }
    }

    console.log(
      `Finished processing course ${courseName}. Found: ${result.lecture.length} lectures, ${result.assignment.length} assignments`
    );
    return result;
  } catch (error) {
    console.error(`Error processing modules for course ${courseName}:`, error);
    return { lecture: [], assignment: [] };
  }
}

// 모든 과목의 과제 및 강의 정보를 병렬로 가져오는 함수
async function getAllCourseAssignments() {
  try {
    // 1. 모든 과목 정보 가져오기
    const courses = await getCourses();

    if (!courses || courses.length === 0) {
      console.warn("No courses found or error occurred");
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

    console.log("All course assignments:", thingsToDo);
    return thingsToDo;
  } catch (error) {
    console.error("Error getting all course assignments:", error);
    return { lecture: [], assignment: [] };
  }
}

// 스크립트 실행 및 결과 반환
getAllCourseAssignments();
