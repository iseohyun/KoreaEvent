# Project Architecture & Development Rules (KoreaEvent)

## 1. CSS 스타일링 아키텍처 (Component-Scoped Modular CSS)
- **방식**: 컴포넌트별 모듈형 CSS (**CSS Modules**, `*.module.css`)를 기본 스타일링 정책으로 사용한다.
- **전역 스타일**: CSS 변수(디자인 토큰), 리셋, 폰트 설정만 `src/styles/global.css`에 최소한으로 정의하고, 각 UI 컴포넌트의 스타일은 반드시 해당 컴포넌트와 동일한 경로/이름의 `ComponentName.module.css`로 격리하여 작성한다.

## 2. 이원화 버전 관리 및 캐시 버스팅 (Dual Versioning & Cache-Busting)
- **버전 파일**: `src/version.ts`에서 정식 시맨틱 버전(`SEMVER`)과 일자 기반 캐시 버스팅 빌드 태그(`BUILD_TAG`: `YYYYMMDDvN`)를 이원화하여 관리한다.
- **갱신 규칙**:
  - `BUILD_TAG` (`YYYYMMDDvN`): 코드 수정 및 빌드 시 당일 날짜 기준으로 `v1`, `v2`... 형태로 자동 갱신하며, Vite 빌드 시 에셋 파일명 해시/태그 및 HTML 메타데이터에 주입하여 브라우저 강제 새로고침(Hard Refresh) 없이도 최신 번들이 즉시 반영되도록 한다.
  - `SEMVER` (`v0.1.0` 등): 사용자의 명시적인 릴리즈 승인 시에만 버전을 올린다.

## 3. 행정 지도 및 행사 데이터 통합 아키텍처
- **행정 지도 UI**:
  - 대한민국 17개 광역자치단체(법정동 시도코드 `lDongRegnCd` 매핑, `KorService2` v4.4의 `12: 전남광주통합특별시` 코드 및 광주/전남 개별 필터링 완벽 호환) 인터랙티브 SVG 폴리곤 지도와 `ldongCode2` 기반 시·군·구(`lDongSignguCd`) 드릴다운 선택기를 제공한다.
  - 개별 행사의 GPS 좌표(`mapx`, `mapy`)를 시각적으로 확인할 수 있는 상세 위치 지도 뷰(Leaflet)를 함께 제공한다.
- **데이터 소스 및 분류 체계**:
  - **공공데이터포털 (`KorService2` v4.4)**: `https://apis.data.go.kr/B551011/KorService2` 엔드포인트의 `searchFestival2`, `ldongCode2`, `lclsSystmCode2`, `detailCommon2`, `detailIntro2`, `searchKeyword2`를 연동하며, `JSON` 응답과 `XML` 응답(에러 메시지 및 XML 포맷 요청 포함)을 모두 파싱할 수 있는 하이브리드 파서를 갖춘다.
  - **지자체 행정 홈페이지 행사 어댑터**: 각 지자체(시·도청 및 시·군·구청 홈페이지/열린데이터광장/보도자료)에서 수집·가져오기(JSON/CSV/직접 추가)한 행사 데이터를 표준 `UnifiedEventItem` 스키마로 정규화하여 공공데이터포털 행사와 통합/비교/분류 표시한다.
  - **신분류체계 (`lclsSystm1~3`)**: `EV01`(축제: 문화관광/문화예술/지역특산물/전통역사/생태자연/기타), `EV02`(공연: 전통/연극/뮤지컬/오페라/무용/클래식/콘서트/영화/넌버벌), `EV03`(행사: 전시회/박람회/스포츠/기타) 및 지자체 고유 행정행사(시민참여/행정공고/교육강좌/지역장터) 분류를 지원한다.

## 4. 데이터 정책 (2026-11-08 추가)
- **예시·가짜 데이터 금지**: 실제로 수집하지 않은 행사를 코드나 JSON에 넣지 않는다. (2026-11-08 `municipalEventAdapter.ts`의 예시 행사 39건 삭제)
- **크롤링 파이프라인**: `npm run crawl` = `crawl-municipal-events` → `crawl-swimming-federations` → `crawl-sports-all` → `normalize-events`
  - 첫 단계는 `auto-crawled-events.json`을 **새로 만들고**, 나머지는 기존 JSON에 병합한다. 하나만 실행하거나 순서를 바꾸면 스포츠 대회 데이터가 사라진다.
  - 마지막 `normalize-events.mjs`가 최종 정규화, 회차 시리즈 재계산, 압축(들여쓰기 없는) 저장을 맡는다.
  - 크롤링 없이 정규화만 다시 할 때는 `npm run normalize-data`를 쓴다.
- **단일 정규화 지점**: 행사 정규화 규칙은 `src/shared/promoPolicy.js`의 `normalizeEventDoc()` 하나만 쓴다. (크롤러와 프런트엔드 공용)
  - 스포츠 행사가 연중 더미 일정(`YYYY0101~YYYY1231`)이면 제외한다.
  - 일반 행사가 연중 더미 일정이면 `eventDate.dateUnknown = true`로 표시한다. 이런 행사는 달력과 주차 지도에 표시하지 않고, 목록에는 "일정 미정"으로 표시한다.
  - 스포츠 대회의 지자체와 범위는 **대회 제목의 지자체명이 지자체 코드의 몇 단계(1단계 광역시도 / 2단계 시군구)에 속하는지**로 정한다. 어느 홈페이지에서 홍보했는지는 기준이 아니다.
  - 개최지와 무관한 전국 대회 브랜드(교보생명컵, 전국체육대회, 동아수영 등)는 지역명 규칙보다 먼저 `"세계/대한연맹"`으로 판정한다.
  - 사용자가 직접 편집한 문서(`manualEdited`)는 자동으로 덮어쓰지 않는다.
- **회차 시리즈 링크**는 크롤러가 미리 계산해 JSON에 저장한다. 프런트엔드에서 다시 계산하지 않는다.
- **지명 정규식**: 일반 명사와 겹치는 지명(영광, 예산, 음성, 달성, 경기, 세종, 영동, 동해 등)은 `ambiguousPlaceRe()`나 부정 전방탐색으로 오탐을 막는다. 새 지명 규칙을 추가할 때는 오탐 사례도 함께 확인한다.

## 5. UI 용어 정책
- 범위 이름은 `"세계/대한연맹"`, `"광역시도"`, `"시군구"`, `"동네"`만 쓴다. UI에 `lv` / `Lv.` 표기를 노출하지 않는다.
- 보기 방식(목록보기, 달력보기, 지도보기)은 상단 메뉴바의 아이콘으로만 바꾼다. (페이지 안에 별도 전환 탭을 두지 않음)
- 지역, 날짜, 범위, 행사 형태, 행사 상태, 세부 검색은 모두 상단 필터 패널 한 곳에서 다룬다.

## 6. 보안·설정 정책
- API 키를 소스에 넣지 않는다.
  - 프런트엔드: `.env.local`의 `VITE_KORSERVICE2_KEY` (git에 올리지 않음)
  - CI: GitHub Actions Secret `KORSERVICE2_KEY` (`deploy.yml`, `daily-crawl.yml`에서 주입)
  - 키가 없으면 공공데이터포털 보조 조회만 건너뛰고, 정적 JSON으로 정상 동작해야 한다.
- Firebase Web API 키는 공개용 식별자이므로 코드에 둘 수 있다. 대신 Firestore 보안 규칙으로 쓰기 권한을 막아야 한다.

## 7. 안정성 정책
- `src/main.tsx`는 `AppErrorBoundary`로 앱 전체를 감싼다. 렌더링 오류가 나도 화면 전체가 하얗게 비지 않게 하기 위해서다.
- 빈 `catch`는 새로 만들지 않는다. 무시할 때도 `console.warn`/`console.error`로 이유를 남긴다.
