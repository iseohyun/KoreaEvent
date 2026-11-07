# Project Architecture & Development Rules (KoreaEventList)

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
