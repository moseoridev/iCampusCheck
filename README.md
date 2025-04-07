# iCampus Check V2 (아캠체크)

<img src="https://github.com/moseoridev/iCampusCheck/blob/master/icons/icon128.png?raw=true">

## 소개

iCampus Check(아캠체크)는 성균관대학교 아이캠퍼스 시스템에서 남은 강의와 과제를 한눈에 확인할 수 있는 크롬 확장 프로그램입니다. 2020년 [ductility](https://github.com/ductility)님이 처음 개발한 것을 2025년 [moseoridev](https://github.com/moseoridev)가 현대화하여 V2로 개선했습니다.

## 주요 기능 및 변경점

1. **Manifest V3 지원**: 크로미움 브라우저(크롬, 엣지, 웨일 등)와 Firefox 최신 버전에서 정상 작동
2. **성능 크게 개선**: 비동기 병렬 요청으로 로딩 시간 획기적 단축
3. **캐시 지원**: 창을 잠시 닫았다가 열어도 다시 로딩하지 않음
4. **2025년 아캠 지원**: "강의콘텐츠" 탭에서 정보를 가져오도록 업데이트
5. **디자인 개선**: 마감 임박 항목 강조 및 직관적인 레이아웃 제공
6. **다크 모드 지원**: 시스템 설정값을 따르거나 수동으로 변경 가능

## 설치 방법

[크롬 웹 스토어](https://chromewebstore.google.com/detail/glihclmiddhfjbffmbbelpadojbakkae?utm_source=item-share-cb)에서 설치하실 수 있습니다.

## 사용법

<img src="https://github.com/moseoridev/iCampusCheck/blob/master/images/chrome_store.png?raw=true">

1. canvas.skku.edu에 로그인합니다.
2. 브라우저 상단의 확장 프로그램 아이콘을 클릭합니다.
3. 마감기한이 남은 강의와 과제가 남은 시간 순으로 정렬되어 표시됩니다.
4. 강의/과제를 클릭하면 해당 페이지가 새 창에서 열립니다.

## 주의사항

- **"강의콘텐츠"** 탭에 속해있는 자료를 기반으로 정보를 가져옵니다.
- 2025년 아캠 시스템에 맞게 업데이트되었습니다.

## 버전 히스토리

### V2 (0.2) by moseoridev

- **0.2.1**
  > Firefox 지원
- **0.2.0**
  > Manifest V3 지원 추가
  > 2025년 아캠 시스템 호환성 업데이트
  > 성능 및 로딩 속도 대폭 개선
  > 캐시 시스템 도입입
  > 다크 모드 지원
  > 마감 임박 항목 강조 표시시

### 이전 버전 (by ductility)

- **0.1.2**
  > 2학기 일부 과목을 가져오지 못하는 현상 수정  
  > 사이드메뉴 - 과목 - 모든과목에서 별표 표시된 과목의 데이터만 가져옴
- **0.1.1**
  > 도전학기 강의도 불러올 수 있게 변경  
  > 툴팁 삭제
- **0.1.0**
  > 신아캠(canvas.skku.edu)에서만 아이콘 활성화 되게 함  
  > 아직 열리지 않은 강의/과제는 목록에서 제외  
  > 강의/과제를 클릭하면 새 창에 강의/과제가 열림  
  > '과제 및 평가' 항목이 있는 과목은 가져오지못함을 알리는 툴팁 추가
- **0.0.3**
  > 과목, 강의/과제 제목에서 언더바(\_)를 제거해서 자동 줄바꿈이 되게 함
- **0.0.2**
  > 수강 철회한 과목 데이터 수집으로 인한 오류 해결

## 오류 및 문의

오류나 문의가 있으시면 GitHub 이슈를 통해 남겨주시거나 배포 게시글 댓글을 이용해 주세요.

## 감사의 말

원작자 [ductility](https://github.com/ductility)님께 감사드립니다.
