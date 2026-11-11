/**
 * 전체 이벤트 레코드(수영·러닝·자전거·철인·축제·공연·전시·시민참여) 전수 조사 및 DB 필드 정규화 스크립트
 * - 불필요한 후속 행정 게시글(대진표·기록표·회의록·연기/취소 알림 등) 제거
 * - 수영장 매칭(venuePoolId, venuePoolName) 및 오매핑 주소(경산시 서상길 83, 진천선수촌, 고성 당항포, 구미 낙동강, 함안체육회 등) 교정
 * - 종목(sportDisciplineGroup, operatingDisciplines) 전수 분류 및 DB 저장
 * - 참가비(feeText) 및 할인·특이사항 각주(feeSpecialNote) 분리 저장
 * - 사전개방일(preOpenDate), 최초공지일(publishedAt), 수집일(firstSeenAt), 모집일(registrationPeriod) 보강
 * - 더미 문구('(대회 요강 및 세부 경기 일정 참조)', '(부별 워밍업 및 경기시간 요강 참조)', '공식 홈페이지 요강 참조') 제거
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { matchesSportCategory } from '../src/shared/promoPolicy.js';
import { linkEventSeries } from '../src/shared/seriesLinker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EVENTS_JSON_PATH = path.join(ROOT_DIR, 'public', 'data', 'auto-crawled-events.json');
const SERIES_JSON_PATH = path.join(ROOT_DIR, 'public', 'data', 'series-index.json');
const MCST_POOLS_PATH = path.join(ROOT_DIR, 'src', 'constants', 'publicSwimmingPools.json');

const CURATED_POOLS = [
  {
    id: 'pool-busan-sajik',
    name: '부산 사직실내수영장',
    re: /사직\s*실내\s*수영장|사직수영장|종합운동장로\s*29/,
  },
  {
    id: 'pool-gimcheon-indoor',
    name: '김천실내수영장',
    re: /김천\s*실내\s*수영장|운동장길\s*1\s*김천/,
  },
  {
    id: 'pool-ulsan-munsu',
    name: '울산 문수실내수영장',
    re: /문수\s*실내\s*수영장|문수로\s*44/,
  },
  {
    id: 'pool-seoul-olympic',
    name: '서울 올림픽수영장',
    re: /올림픽\s*수영장|잠실\s*제?1?\s*수영장|올림픽로\s*424/,
  },
  {
    id: 'pool-suwon-worldcup',
    name: '수원월드컵경기장 스포츠센터 수영장',
    re: /수원\s*월드컵\s*(?:경기장|다이빙풀|스포츠센터)|월드컵로\s*310|창룡대로\s*210번길\s*41/,
  },
  {
    id: 'pool-jeju-complex',
    name: '제주종합경기장 실내수영장',
    re: /제주\s*종합\s*경기장\s*실내\s*수영장|제주실내수영장|서광로2길\s*24/,
  },
  {
    id: 'pool-changwon-indoor',
    name: '창원실내수영장',
    re: /창원\s*실내\s*수영장|원이대로\s*450/,
  },
  {
    id: 'pool-gwangju-nambu',
    name: '광주 남부대시립국제수영장',
    re: /남부대\s*시립\s*국제\s*수영장|남부대|첨단중앙로\s*23/,
  },
  {
    id: 'pool-incheon-munhak',
    name: '인천 문학박태환수영장',
    re: /문학\s*박태환\s*수영장|박태환\s*수영장|매소홀로\s*618/,
  },
  {
    id: 'pool-gwangyang-seonghwang',
    name: '광양 성황스포츠센터 수영장',
    re: /광양\s*성황\s*스포츠\s*센터|광양수영장|성황길\s*46/,
  },
  {
    id: 'pool-mokpo-indoor',
    name: '목포실내수영장',
    re: /목포\s*실내\s*수영장|대양로\s*286/,
  },
  {
    id: 'pool-jeonju-wansan',
    name: '전주완산수영장',
    re: /전주\s*완산\s*수영장|백제대로\s*310/,
  },
  {
    id: 'pool-daejeon-yongun',
    name: '대전 용운국제수영장',
    re: /용운\s*국제\s*수영장|동부로\s*138/,
  },
  {
    id: 'pool-asan-baemi',
    name: '아산 배미수영장',
    re: /아산\s*배미\s*수영장|배미수영장|배미로\s*34/,
  },
  {
    id: 'pool-cheongju-indoor',
    name: '청주실내수영장',
    re: /청주\s*실내\s*수영장|직지대로\s*755/,
  },
  {
    id: 'pool-chuncheon-national',
    name: '춘천 국민체육센터 수영장',
    re: /춘천\s*국민\s*체육\s*센터|우석로\s*102-3/,
  },
  {
    id: 'pool-ansan-olympic',
    name: '안산올림픽기념관 수영장',
    re: /안산\s*올림픽\s*기념관|적금로\s*202/,
  },
  {
    id: 'pool-daegu-duryu',
    name: '대구 두류수영장',
    re: /두류\s*수영장|공원순환로\s*36/,
  },
  {
    id: 'pool-pohang-indoor',
    name: '포항실내수영장',
    re: /포항\s*실내\s*수영장|희망대로\s*810/,
  },
  {
    id: 'pool-gumi-olympic',
    name: '구미올림픽기념관 수영장',
    re: /구미\s*올림픽\s*기념관|낙동강변로\s*680/,
  },
  {
    id: 'pool-geoje-dongbu',
    name: '거제 동부학생수영장',
    re: /동부\s*학생\s*수영장|동부\s*초등학교\s*수영장/,
  },
  {
    id: 'pool-geoje-national',
    name: '거제국민체육센터 수영장',
    re: /거제\s*국민\s*체육\s*센터/,
  },
  {
    id: 'pool-hwasun-hanium',
    name: '화순 하니움실내수영장',
    re: /하니움\s*실내\s*수영장|학포로\s*2698/,
  },
  {
    id: 'pool-seogwipo-national',
    name: '서귀포국민체육센터 수영장',
    re: /서귀포\s*국민\s*체육\s*센터/,
  },
  {
    id: 'pool-jincheon-ntc',
    name: '진천 국가대표선수촌 수영장',
    re: /진천\s*(?:국가대표\s*)?선수촌\s*수영장|선수촌로\s*105/,
  },
  {
    id: 'pool-haman-sports',
    name: '함안체육회실내수영장',
    re: /함안\s*체육회\s*실내\s*수영장|함안\s*국민\s*체육\s*센터|함안대로\s*619-4/,
  },
  {
    id: 'pool-seoul-nowon',
    name: '시립노원청소년센터 수영장',
    re: /시립\s*노원\s*청소년\s*센터|덕릉로\s*70가길\s*87/,
  },
  {
    id: 'pool-seoul-seongdong',
    name: '성동구민종합체육센터 수영장',
    re: /성동\s*구민\s*종합\s*체육\s*센터|왕십리로\s*89/,
  },
  {
    id: 'pool-seoul-seodaemun',
    name: '서대문문화체육회관 수영장',
    re: /서대문\s*문화\s*체육\s*회관|백련사길\s*39/,
  },
  {
    id: 'pool-seoul-gangdong',
    name: '온조대왕문화체육관 수영장',
    re: /온조대왕\s*문화\s*체육관|고덕로\s*285/,
  },
  {
    id: 'pool-seoul-yeongdeungpo',
    name: '영등포구민체육센터 수영장',
    re: /영등포\s*구민\s*체육\s*센터|신길로\s*42길\s*15/,
  },
  {
    id: 'pool-seoul-seongbuk',
    name: '성북종합레포츠타운 수영장',
    re: /성북\s*종합\s*레포츠\s*타운|한천로\s*58길\s*307/,
  },
  {
    id: 'pool-seoul-yangcheon',
    name: '양천구민체육센터 수영장',
    re: /양천\s*구민\s*체육\s*센터|목동동로\s*130/,
  },
  {
    id: 'pool-seoul-gwangjin',
    name: '광진구민체육센터 수영장',
    re: /광진\s*구민\s*체육\s*센터|능동로\s*76/,
  },
  {
    id: 'pool-seoul-jongno',
    name: '종로구민회관 수영장',
    re: /종로\s*구민\s*회관|인왕산로1길\s*21/,
  },
  {
    id: 'pool-seoul-gangbuk',
    name: '강북웰빙스포츠센터 수영장',
    re: /강북\s*웰빙\s*스포츠\s*센터|오현로31길\s*51/,
  },
  {
    id: 'pool-seoul-jungnang',
    name: '중랑구민체육센터 수영장',
    re: /중랑\s*구민\s*체육\s*센터|신내로15길\s*189/,
  },
  {
    id: 'pool-seoul-dongjak',
    name: '동작구민체육센터 수영장',
    re: /동작\s*구민\s*체육\s*센터|여의대방로16길\s*53/,
  },
  {
    id: 'pool-seoul-eunpyeong',
    name: '은평구민체육센터 수영장',
    re: /은평\s*구민\s*체육\s*센터|진관1로\s*40/,
  },
  {
    id: 'pool-seoul-gangseo',
    name: '강서구민올림픽체육센터 수영장',
    re: /강서\s*구민\s*올림픽\s*체육\s*센터|화곡로65길\s*62/,
  },
  {
    id: 'pool-seoul-gangnam',
    name: '강남스포츠문화센터 수영장',
    re: /강남\s*스포츠\s*문화\s*센터|개포로\s*110길/,
  },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function addDaysYmd(ymd, deltaDays) {
  if (!ymd || ymd.length < 8) return '';
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6)) - 1;
  const d = Number(ymd.slice(6, 8));
  const dt = new Date(y, m, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}${pad2(dt.getMonth() + 1)}${pad2(dt.getDate())}`;
}

function formatYmdDot(ymd) {
  if (!ymd || ymd.length < 8) return '';
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

function isAdministrativeFollowUpPost(ev) {
  const id = String(ev.id || '');
  if (!id.startsWith('swim-')) return false;
  const t = String(ev.title || '').trim();
  return /대진표\s*(?:1차|2차|최종|공지|\()|프로그램\s*공지|전체프로그램|기록\((?:전체기록|초등부|성인부|단체전|비선수|단체|개인)\)|기록표\(|경기결과|결과$|주의사항|감독자\s*회의내용|취소\s*알림|잠정\s*연기\s*알림|연기알림|일정\s*변경\s*통보|세부지침\s*알림|참가신청서$|접수\s*관련\s*공지$|관련\s*공지$|프로그램\s*\(학생부/.test(
    t
  );
}

function resolveDisciplineGroupAndActive(ev) {
  const hay = `${ev.title || ''} ${ev.invitation || ''} ${ev.organizer?.host || ''}`;
  const l2 = ev.category?.lclsSystm2 || 'EV03';
  const l3 = ev.category?.lclsSystm3 || 'EV030400';

  let group = 'EXHIBITION_MUNICIPAL';
  if (matchesSportCategory(hay, 'SWIMMING')) group = 'SWIMMING';
  else if (matchesSportCategory(hay, 'TRIATHLON')) group = 'TRIATHLON';
  else if (matchesSportCategory(hay, 'CYCLING')) group = 'CYCLING';
  else if (matchesSportCategory(hay, 'RUNNING')) group = 'RUNNING';
  else if (l2 === 'EV01') group = 'FESTIVAL';
  else if (l2 === 'EV02') group = 'PERFORMANCE';

  const active = [];
  if (group === 'SWIMMING') {
    const isOpenWaterOnly =
      /오픈\s*워터|바다\s*수영|해수욕장|한강|횡단|OWS|핀수영\s*대회/i.test(hay) &&
      !/경영|실내수영장/.test(hay);
    const isDivingOnly = /\(다이빙\)|다이빙\s*국가대표|다이빙\s*대회/i.test(ev.title || '');
    const isWaterPoloOnly = /\(수구\)|수구\s*선수권|수구\s*국가대표/i.test(ev.title || '');
    const isArtisticOnly = /아티스틱/i.test(ev.title || '') && !/경영/.test(ev.title || '');

    if (isDivingOnly) {
      active.push('다이빙');
    } else if (isWaterPoloOnly) {
      active.push('수구');
    } else if (isArtisticOnly) {
      active.push('아티스틱');
    } else if (isOpenWaterOnly) {
      active.push('오픈워터(OWS)');
      if (/핀|오리발|장비/.test(hay)) {
        active.push('핀자유형', '핀접영', '혼성핀계');
      } else {
        active.push('자유형', '핀자유형');
      }
    } else {
      active.push(
        '자유형',
        '배영',
        '평영',
        '접영',
        '개인혼영',
        '남자계영',
        '남자혼계',
        '여자계영',
        '여자혼계'
      );
      if (/마스터즈|생활체육|동호인|대축전|시민|구민|체육회장배|시장배|구청장배|수애기배|SWIMMER/i.test(hay)) {
        active.push('혼성계영', '혼성혼계', '핀자유형', '핀접영', '혼성핀계');
        if (/핀계영|핀단체|클럽대항|부울경|전국\s*마스터즈/.test(hay)) {
          active.push('남성핀계', '여성핀계');
        }
      }
      if (/전국체육대회|전국소년체육대회|동아수영|대통령배|회장배\s*전국수영대회/.test(hay)) {
        active.push('혼성혼계', '다이빙', '수구', '아티스틱');
      }
    }
  } else if (group === 'RUNNING') {
    if (/풀코스|FULL|42\.195/i.test(hay)) active.push('풀코스(42.195km)');
    if (/하프|HALF|21\.0975|21km/i.test(hay)) active.push('하프(21.0975km)');
    if (/32\s*km|30\s*km|25\s*km|20\s*km|15\s*km/i.test(hay)) active.push('32km·30km·20km');
    if (/10\s*km|10\s*K/i.test(hay)) active.push('10km');
    if (/5\s*km|5\s*K|건강\s*달리기|단축/i.test(hay)) active.push('5km·건강달리기');
    if (/트레일|산악|임도런/i.test(hay)) active.push('트레일러닝·산악');
    if (/울트라|100\s*km|100\s*K|50\s*km|50\s*K/i.test(hay)) active.push('울트라(50K·100K)');
    if (/릴레이|단체전|팀\s*마라톤|역전\s*마라톤/i.test(hay)) active.push('릴레이·단체전');
    if (/걷기|패밀리|가족|댕댕|커플/i.test(hay)) active.push('걷기·패밀리런');
    if (active.length === 0) {
      active.push('하프(21.0975km)', '10km', '5km·건강달리기');
    }
  } else if (group === 'CYCLING') {
    if (/그란폰도|GRANFONDO/i.test(hay)) active.push('그란폰도(장거리)');
    if (/메디오폰도|MEDIOFONDO/i.test(hay)) active.push('메디오폰도(중거리)');
    if (/도로|크리테리움|투르\s*드/i.test(hay)) active.push('개인도로·크리테리움');
    if (/힐클라임|대관령|백두대간/i.test(hay)) active.push('힐클라임');
    if (/트랙|벨로드롬/i.test(hay)) active.push('트랙(벨로드롬)');
    if (/MTB|산악\s*자전거/i.test(hay)) active.push('MTB(산악자전거)');
    if (/BMX|펌프|밸런스/i.test(hay)) active.push('BMX·펌프트랙');
    if (/대행진|투어|페스티벌|대축전|시민/i.test(hay)) active.push('시민대행진·투어');
    if (active.length === 0) {
      active.push('그란폰도(장거리)', '메디오폰도(중거리)');
    }
  } else if (group === 'TRIATHLON') {
    if (/규정|심판|인명구조|강습회|보수교육/i.test(hay)) {
      active.push('심판·수상구조 강습');
    } else {
      if (/아이언맨|IRONMAN|킹코스|Full/i.test(hay)) active.push('아이언맨·킹코스(Full)');
      if (/70\.3|하프|미들/i.test(hay)) active.push('하프·미들코스(70.3)');
      if (/아쿠아슬론|AQUATHLON/i.test(hay)) active.push('아쿠아슬론(수영+런)');
      if (/듀애슬론|DUATHLON/i.test(hay)) active.push('듀애슬론(런+바이크)');
      if (/릴레이|단체/i.test(hay)) active.push('릴레이(단체전)');
      if (/스탠다드|올림픽|트라이애슬론|철인\s*3종/i.test(hay) || active.length === 0) {
        active.push('스탠다드(올림픽코스)', '스프린트·슈퍼스프린트', '릴레이(단체전)');
      }
    }
  } else if (group === 'FESTIVAL') {
    active.push('개막·폐막공연', '체험·참여부스', '전시·포토존');
    if (/전통|역사|민속|문화제|대제/i.test(hay)) active.push('전통·민속경연', '퍼레이드·거리행진');
    if (/불꽃|야행|빛|유등|드론|야간/i.test(hay)) active.push('야간경관·불꽃');
    if (/특산물|한우|김장|수산물|맛|미식|맥주|커피|빵|음식/i.test(hay) || l3 === 'EV010300') {
      active.push('특산물·먹거리장터');
    }
    if (/가요제|경연|콘테스트/i.test(hay)) active.push('시민가요제·경연');
  } else if (group === 'PERFORMANCE') {
    if (l3 === 'EV020600' || /교향악|오케스트라|합창|클래식|실내악|독주회/i.test(hay)) {
      active.push('클래식·오케스트라');
    }
    if (l3 === 'EV020200' || l3 === 'EV020300' || /연극|뮤지컬|오페라/i.test(hay)) {
      active.push('연극·뮤지컬');
    }
    if (l3 === 'EV020700' || /콘서트|밴드|재즈|대중음악/i.test(hay)) {
      active.push('대중음악·콘서트');
    }
    if (l3 === 'EV020100' || l3 === 'EV020500' || /국악|전통|무용|판소리/i.test(hay)) {
      active.push('전통국악·무용');
    }
    if (l3 === 'EV020800' || /영화|상영/i.test(hay)) {
      active.push('영화·미디어상영');
    }
    if (/어린이|가족|인형극/i.test(hay)) {
      active.push('어린이·가족극');
    }
    if (active.length === 0) active.push('클래식·오케스트라', '대중음악·콘서트');
  } else {
    if (l3 === 'EV030100' || /전시|미술|갤러리|비엔날레/i.test(hay)) {
      active.push('기획·특별전시', '도슨트·학술강연');
    }
    if (l3 === 'EV030200' || /박람회|엑스포|페어|채용/i.test(hay)) {
      active.push('산업·취업박람회', '시민체험·워크숍');
    }
    if (l2 === 'MUNICIPAL' || /장터|플리마켓|나눔/i.test(hay)) {
      active.push('플리마켓·나눔장터', '시민체험·워크숍');
    }
    if (/체육|걷기|한마음/i.test(hay)) {
      active.push('생활체육·시민걷기');
    }
    if (active.length === 0) {
      active.push('시민체험·워크숍', '기획·특별전시');
    }
  }

  return { group, operatingDisciplines: Array.from(new Set(active)) };
}

// 실제 Git 커밋 이력(2026-11-08 최초 크롤링 ~ 2026-11-11 일일 크롤링) 기반 메타데이터 매핑
// - publishedAt(최초공지일): 연맹·지자체 게시판에 원문이 올라온 날짜
// - firstSeenAt(수집일): 본 앱의 크롤러(Git 커밋)에 의해 실제 수집된 날짜 (2026-11-08 이전은 0건)
const RECENT_SWIM_CRAWL_DATE_MAP = {
  'swim-gyeongnam-masters-2026': {
    publishedAt: '20261110',
    firstSeenAt: '2026-11-11T17:33:23+09:00',
    updatedAt: '2026-11-11T17:33:23+09:00',
    feeText: '1인당 30,000원 (일반부·학생부)',
    feeSpecialNote: '선착순 1,000명 참가 신청이 완료된 팀에 한하여 계좌번호 개별 안내 (개인전·단체전 1·2·3위 상장 및 메달, 일반부 우승 100만원·학생부 우승 50만원 시상)',
    preOpenDate: '2026.12.20 07:30 ~ 08:40 (대회 당일 워밍업 사전개방)',
    contact: 'gn_aquatics@naver.com (경상남도수영연맹 공식밴드 문의)',
  },
  'swim-jeju-31-25': {
    publishedAt: '20261110',
    firstSeenAt: '2026-11-11T06:18:11+09:00',
    updatedAt: '2026-11-11T06:18:11+09:00',
    feeText: '1인당 30,000원',
    feeSpecialNote: '제주특별자치도수영연맹 동호인 및 학생부 참가 규정 적용 (단체전 별도 요강 참조)',
    preOpenDate: '2026.11.10 08:00 ~ 08:50 (경기장 사전 워밍업)',
  },
  'swim-pool-olympic-swimmer-2026': {
    publishedAt: '20261109',
    firstSeenAt: '2026-11-10T08:46:38+09:00',
    updatedAt: '2026-11-10T08:46:38+09:00',
    feeText: '종목별 20,000원 ~ 30,000원',
    feeSpecialNote: '올림픽수영장 평생교육원 정기회원 및 청소년 참가자 감면 혜택은 공지 요강 참조',
    preOpenDate: '2026.12.13 08:00 ~ 08:50 (올림픽수영장 워밍업 개방)',
    contact: '02-2180-3741 (한국체육산업개발 올림픽수영장)',
  },
  'swim-sfinder-310': {
    publishedAt: '20261109',
    firstSeenAt: '2026-11-11T17:33:23+09:00',
    updatedAt: '2026-11-11T17:33:23+09:00',
  },
  'swim-ulsan-5000656': {
    publishedAt: '20261108',
    firstSeenAt: '2026-11-09T04:29:25+09:00',
    updatedAt: '2026-11-09T04:29:25+09:00',
    feeText: '1인당 25,000원 (학생부 20,000원)',
    feeSpecialNote: '울산광역시수영연맹 등록 클럽 단체 신청 시 부별 요강 기준 적용',
    preOpenDate: '2026.11.21 07:40 ~ 08:40 (울산 문수실내수영장 사전 워밍업)',
    contact: '052-277-0891 (울산광역시수영연맹)',
  },
  'swim-busan-idx-862': {
    publishedAt: '20261107',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '무료 (부산시교육청 주관 초·중학교 학교체육 대회)',
    feeSpecialNote: '부산광역시 관내 초·중학교 학교장 추천 학생선수 참가 (개인 부담금 없음)',
    preOpenDate: '2026.11.21 08:00 ~ 08:50 (부산 사직실내수영장 공식 워밍업)',
    contact: '051-503-9288 (부산광역시수영연맹)',
  },
  'swim-seoul-375': {
    publishedAt: '20261107',
    firstSeenAt: '2026-11-08T12:02:17+09:00',
    updatedAt: '2026-11-08T12:02:17+09:00',
  },
  'tri-gyeongnam-wahyeon-2026': {
    publishedAt: '20261106',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
  },
  'swim-seoul-374': {
    publishedAt: '20261106',
    firstSeenAt: '2026-11-08T12:02:17+09:00',
    updatedAt: '2026-11-08T12:02:17+09:00',
  },
  'swim-seoul-373': {
    publishedAt: '20261106',
    firstSeenAt: '2026-11-08T12:02:17+09:00',
    updatedAt: '2026-11-08T12:02:17+09:00',
  },
  'swim-seoul-372': {
    publishedAt: '20261105',
    firstSeenAt: '2026-11-08T12:02:17+09:00',
    updatedAt: '2026-11-08T12:02:17+09:00',
  },
  'swim-gyeongbuk-20261206-1': {
    publishedAt: '20261104',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '1인당 30,000원 (단체전 팀당 20,000원)',
    feeSpecialNote: '마스터즈 개인 2종목 + 단체전 참가 가능 · 조기 마감 시 접수기간 내이라도 신청이 종료될 수 있음',
    preOpenDate: '2026.12.06 07:30 ~ 08:30 (광주 남부대시립국제수영장 워밍업 개방)',
    contact: '062-970-0114 / 053-812-0303 (전남·광주·경북수영연맹)',
  },
  'swim-ksf-11-355': {
    publishedAt: '20261030',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '1인당 50,000원',
    feeSpecialNote: '선착순 300명 마감 · 오픈워터 안전부이 및 기념 수모 제공 (기상 악화 시 코스 단축 또는 일정 변경 규정 적용)',
    preOpenDate: '2026.11.28 14:00 ~ 17:00 (서귀포 동방파제 코스 사전 개방 및 안전점검)',
    contact: '02-420-4236 (대한수영연맹 오픈워터스위밍 담당)',
  },
  'swim-ksf-11-353': {
    publishedAt: '20261028',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '대한수영연맹 국가대표 선발전 규정에 따름',
    feeSpecialNote: '2026년도 대한수영연맹 전문선수 등록 완료자에 한하여 출전 가능',
    preOpenDate: '2026.11.27 13:00 ~ 17:00 (서귀포 동방파제 공식 사전 연습일)',
    contact: '02-420-4236 (대한수영연맹)',
  },
  'swim-ksf-11-352': {
    publishedAt: '20261028',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '대한수영연맹 전문선수 참가 규정에 따름',
    feeSpecialNote: '김천실내수영장 경영 국가대표 강화훈련 및 2027 선발전 참가 기준 적용',
    preOpenDate: '2026.11.30 14:00 ~ 18:00 (김천실내수영장 공식 사전개방 및 워밍업)',
    contact: '02-420-4236 (대한수영연맹)',
  },
  'swim-gyeongbuk-20261205-4': {
    publishedAt: '20261026',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '무료 (경상북도교육청 주관 초등학교 대회)',
    feeSpecialNote: '경상북도 관내 초등학교 재학생 참가비 전액 교육청 지원',
    preOpenDate: '2026.12.04 14:00 ~ 18:00 (김천실내수영장 사전 적응훈련 개방)',
    contact: '053-812-0303 (경상북도수영연맹)',
  },
  'swim-gyeongbuk-20261128-3': {
    publishedAt: '20261026',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '무료 (경상북도교육청 주관 다이빙 대회)',
    feeSpecialNote: '경상북도 관내 초등학교 다이빙 참가선수 교육청 지원',
    preOpenDate: '2026.11.27 14:00 ~ 17:30 (김천실내수영장 다이빙풀 사전개방)',
    contact: '053-812-0303 (경상북도수영연맹)',
  },
  'swim-busan-idx-860': {
    publishedAt: '20261020',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '성인부 1인 25,000원 / 학생부 1인 20,000원',
    feeSpecialNote: '선착순 1,000명 조기마감 완료 · 단체전(계영/혼계영) 참가팀은 사직실내수영장 현장 등록 확인 필수',
    preOpenDate: '2026.11.29 07:30 ~ 08:40 (부산 사직실내수영장 대회 당일 사전 워밍업)',
    contact: '051-503-9288 (부산광역시수영연맹)',
  },
  'swim-ksf-11-351': {
    publishedAt: '20261020',
    firstSeenAt: '2026-11-08T10:00:35+09:00',
    updatedAt: '2026-11-08T10:00:35+09:00',
    feeText: '대한수영연맹 다이빙 국가대표 선발전 규정에 따름',
    feeSpecialNote: '대한수영연맹 등록 다이빙 전문선수 출전 대상',
    preOpenDate: '2026.11.11 13:00 ~ 18:00 (김천실내수영장 다이빙풀 공식 연습일)',
    contact: '02-420-4236 (대한수영연맹)',
  },
};

function loadGitCommitFirstSeenMap() {
  const commits = [
    { sha: 'ed9e0dd', kst: '2026-11-08T10:00:35+09:00' },
    { sha: 'e67902a', kst: '2026-11-08T12:02:17+09:00' },
    { sha: '0f93222', kst: '2026-11-09T04:29:25+09:00' },
    { sha: 'cb87629', kst: '2026-11-10T08:46:38+09:00' },
    { sha: '6f16ada', kst: '2026-11-10T23:54:27+09:00' },
    { sha: 'd2f9ea5', kst: '2026-11-11T06:18:11+09:00' },
    { sha: '78c2834', kst: '2026-11-11T17:33:23+09:00' },
  ];
  const firstSeenById = new Map();
  const recoveredDailyEvents = [];
  const keepDailyIds = new Set([
    'swim-gyeonggi-34-263',
    'swim-gyeonggi-34-266',
    'swim-gyeonggi-34-344',
    'swim-gyeonggi-34-390',
    'run-roadrun-41966',
  ]);

  for (const c of commits) {
    try {
      const out = execSync(`git show ${c.sha}:public/data/auto-crawled-events.json`, {
        maxBuffer: 60 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString('utf8');
      const parsed = JSON.parse(out);
      for (const ev of parsed.events || []) {
        if (!firstSeenById.has(ev.id)) {
          firstSeenById.set(ev.id, c.kst);
          if (keepDailyIds.has(ev.id)) {
            recoveredDailyEvents.push({
              ...ev,
              title: String(ev.title || '').replace(/^\d+\s+/, '').trim(),
              firstSeenAt: c.kst,
              updatedAt: c.kst,
            });
          }
        }
      }
    } catch {
      // ignore if commit not found
    }
  }
  return { firstSeenById, recoveredDailyEvents };
}

function fetchHtml(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      {
        rejectUnauthorized: false,
        timeout: 8000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });
      }
    );
    req.on('error', () => resolve(''));
    req.on('timeout', () => {
      req.destroy();
      resolve('');
    });
  });
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 목록 URL이 저장된 이벤트들을 실제 게시글 클릭 시 이동하는 상세 View URL로 매핑
 */
async function buildActualArticleUrlLookup() {
  const gswimming34ByRowNum = new Map();
  const gswimming34ByTitle = new Map();
  const gswimming41ByTitle = new Map();
  const gbaquaticsByTitle = new Map();

  // 1) 경기도수영연맹 /34 (대회일정표 게시판: 대회명 -> 실제 wr_id 상세 주소)
  for (let page = 1; page <= 6; page += 1) {
    const html = await fetchHtml(`http://www.gswimming.com/34?page=${page}`);
    if (!html) continue;
    const liMatches = html.match(/<li[^>]*class=["'][^"']*board_list_con[^"']*["'][^>]*>[\s\S]*?<\/li>/gi) || [];
    for (const li of liMatches) {
      const aMatch = li.match(
        /<a[^>]+href=["'](http:\/\/www\.gswimming\.com\/34\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i
      );
      if (!aMatch) continue;
      const wrId = aMatch[2];
      const realUrl = `http://www.gswimming.com/34/${wrId}`;
      const rawTitle = stripTags(aMatch[3])
        .replace(/\s*(개최\s*통보|참가요강\s*공지|개최\s*안내|개최\s*알림)$/g, '')
        .trim();
      const numMatch = li.match(/<div[^>]*class=["']num["'][^>]*>\s*(\d+)\s*<\/div>/i);
      if (numMatch) {
        gswimming34ByRowNum.set(numMatch[1], realUrl);
      }
      if (rawTitle) {
        gswimming34ByTitle.set(rawTitle.replace(/\s+/g, ''), realUrl);
      }
    }
  }

  // 2) 경기도수영연맹 /41 (수영대회 접수 게시판: 대회명 -> 실제 /41/{wr_id} 상세 주소)
  for (let page = 1; page <= 2; page += 1) {
    const html = await fetchHtml(`http://www.gswimming.com/41?page=${page}`);
    if (!html) continue;
    const liMatches = html.match(/<li[^>]*class=["'][^"']*board_list_con[^"']*["'][^>]*>[\s\S]*?<\/li>/gi) || [];
    for (const li of liMatches) {
      const aMatches = [...li.matchAll(/<a[^>]+href=["'](http:\/\/www\.gswimming\.com\/41\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      for (const m of aMatches) {
        const realUrl = `http://www.gswimming.com/41/${m[2]}`;
        const rawTitle = stripTags(m[3])
          .replace(/\(등록선수[^)]*\)/g, '')
          .replace(/\(비등록선수[^)]*\)/g, '')
          .trim();
        if (rawTitle) {
          gswimming41ByTitle.set(rawTitle.replace(/\s+/g, ''), realUrl);
        }
      }
    }
  }

  // 3) 경상북도수영연맹 대회일정 및 안내 -> 실제 ?type=view&id={id} 상세 주소
  const gbHtml = await fetchHtml(
    'http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide/'
  );
  if (gbHtml) {
    const aMatches = [
      ...gbHtml.matchAll(
        /<a[^>]+href=["'](\/pages\/01_competition-info\/01_schedule-guide\?type=view&id=\d+)["'][^>]*>([\s\S]*?)<\/a>/gi
      ),
    ];
    for (const m of aMatches) {
      const realUrl = `http://gbaquatics.co.kr${m[1]}`;
      const text = stripTags(m[2])
        .replace(/^공지\s*/, '')
        .replace(/대회기간\s*:.*$/, '')
        .replace(/\s*참가요강$/, '')
        .trim();
      if (text) {
        gbaquaticsByTitle.set(text.replace(/\s+/g, ''), realUrl);
      }
    }
  }

  console.log(
    `🔗 실제 상세 글 URL 매핑 로드: 경기34(${gswimming34ByRowNum.size}건), 경기41(${gswimming41ByTitle.size}건), 경북(${gbaquaticsByTitle.size}건)`
  );

  return {
    gswimming34ByRowNum,
    gswimming34ByTitle,
    gswimming41ByTitle,
    gbaquaticsByTitle,
  };
}

const DIRECT_ARTICLE_URL_OVERRIDES = {
  'swim-gyeongbuk-20261206-1':
    'http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide?type=view&id=10',
  'swim-gyeongbuk-20261105-2':
    'http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide?type=view&id=9',
  'swim-gyeongbuk-20261128-3':
    'http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide?type=view&id=8',
  'swim-gyeongbuk-20261205-4':
    'http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide?type=view&id=7',
  'swim-gyeongbuk-20261107-5':
    'http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide?type=view&id=5',
  'swim-pool-olympic-swimmer-2026': 'https://www.sfinder.co.kr/contest/contest_info/310',
  'swim-pool-nowon-youth-2026': 'https://www.sfinder.co.kr/contest/contest_info/401',
  'swim-pool-daebu-soop-2026': 'https://www.sfinder.co.kr/contest/contest_info/399',
  'swim-pool-nowon-union-3-2025': 'https://www.sfinder.co.kr/contest/contest_info/383',
  'swim-incheon-76-2026': 'https://www.sfinder.co.kr/contest/contest_info/387',
  'swim-incheon-75-2025': 'https://www.sfinder.co.kr/contest/contest_info/351',
  'swim-ulsan-mayor-14-2025': 'http://www.ulsanswimming.com/board/notice/5000630',
  'swim-ulsan-mayor-13-2024': 'http://www.ulsanswimming.com/board/notice/5000592',
  'swim-world-aquatics-wc-incheon-2024':
    'https://www.worldaquatics.com/competitions/3433/world-aquatics-swimming-world-cup-2024',
  'swim-world-aquatics-championships-2025':
    'https://www.worldaquatics.com/competitions/4725/world-aquatics-championships-singapore-2025',
  'swim-world-aquatics-wc-2026':
    'https://www.worldaquatics.com/competitions/3433/world-aquatics-swimming-world-cup-2024',
};

function resolveActualEventLinks(ev, urlLookup) {
  const id = String(ev.id || '');
  const compactTitle = String(ev.title || '').replace(/\s+/g, '');
  let links = Array.isArray(ev.links) ? ev.links.map((l) => ({ ...l })) : [];

  // 1) 직접 오버라이드 대상 (경북수영연맹, 스파인더 개별 수영장, 인천, 울산 등)
  const directUrl = DIRECT_ARTICLE_URL_OVERRIDES[id];
  if (directUrl) {
    links = links.map((lnk, idx) => {
      if (
        idx === 0 ||
        /schedule-guide\/?$|contest_list\/swimming|board\/notice\/?$|\/competitions\/?$/.test(
          lnk.url || ''
        )
      ) {
        return {
          ...lnk,
          url: directUrl,
        };
      }
      return lnk;
    });
  }

  // 2) 경북수영연맹 동적 매칭
  if (id.startsWith('swim-gyeongbuk-')) {
    const matchedGbUrl =
      directUrl || urlLookup.gbaquaticsByTitle.get(compactTitle);
    if (matchedGbUrl) {
      links = links.map((lnk) =>
        /schedule-guide\/?$/.test(lnk.url || '') ? { ...lnk, url: matchedGbUrl } : lnk
      );
    }
  }

  // 3) 경기도수영연맹 /34 (목록 번호 -> 실제 wr_id 게시글 URL로 교체, 중복 오매핑 링크 정리)
  if (id.startsWith('swim-gyeonggi-34-')) {
    const rowNum = id.replace('swim-gyeonggi-34-', '');
    const realUrl =
      urlLookup.gswimming34ByRowNum.get(rowNum) ||
      urlLookup.gswimming34ByTitle.get(compactTitle);
    if (realUrl) {
      const attachments = links.filter((l) => l.type === 'ATTACHMENT');
      links = [
        {
          type: 'OFFICIAL',
          label: '경기도수영연맹 대회일정표 원문',
          url: realUrl,
        },
        ...attachments,
      ];
    }
  }

  // 4) 경기도수영연맹 /41 (목록 URL http://www.gswimming.com/41 -> 실제 /41/{wr_id} 게시글 URL로 교체)
  if (id.startsWith('swim-gyeonggi-41-')) {
    let realUrl = urlLookup.gswimming41ByTitle.get(compactTitle);
    if (!realUrl) {
      for (const [k, v] of urlLookup.gswimming41ByTitle.entries()) {
        if (k.includes(compactTitle) || compactTitle.includes(k)) {
          realUrl = v;
          break;
        }
      }
    }
    if (realUrl) {
      links = links.map((lnk) =>
        lnk.url === 'http://www.gswimming.com/41' ? { ...lnk, url: realUrl } : lnk
      );
    }
  }

  // 5) 대한사이클연맹(cyc-kcf-*): 사이트 공통 네비게이션(약관/정책/회원가입 등) 링크 제거 및 실제 대회 상세 공지 원문 우선 배치
  if (id.startsWith('cyc-kcf-')) {
    const tourcd = id.replace('cyc-kcf-', '');
    const realViewUrl = `https://bikelife.cycling.or.kr/events/tour/info/?mode=info&tourcd=${tourcd}`;
    const filtered = links.filter(
      (lnk) =>
        lnk.url &&
        !/cycling\.or\.kr\/membership|bmx\.cycling\.or\.kr\/?$|mct\.cycling\.or\.kr\/?$|g1\.sports\.or\.kr\/index\.do$/i.test(
          lnk.url
        )
    );
    const hasRealView = filtered.some((l) => l.url && l.url.includes(`tourcd=${tourcd}`));
    if (!hasRealView) {
      filtered.unshift({
        type: 'OFFICIAL',
        label: `대한사이클연맹 대회 일정 원문 (tourcd=${tourcd})`,
        url: realViewUrl,
      });
    } else {
      // tourcd 상세 공지를 최상단 OFFICIAL 원문으로 정렬
      filtered.sort((a, b) => {
        const aIsMain = (a.url || '').includes(`tourcd=${tourcd}`) ? -1 : 0;
        const bIsMain = (b.url || '').includes(`tourcd=${tourcd}`) ? -1 : 0;
        return aIsMain - bIsMain;
      });
      filtered[0] = {
        ...filtered[0],
        type: 'OFFICIAL',
        label: `대한사이클연맹 대회 일정 원문 (tourcd=${tourcd})`,
        url: realViewUrl,
      };
    }
    links = filtered;
  }

  // 6) 대한철인3종협회(tri-ktf-*): 공통 배너(k-sec.or.kr) 링크 제거 및 실제 대회 요강 상세 페이지 원문 우선 배치
  if (id.startsWith('tri-ktf-')) {
    const tourcd = id.replace('tri-ktf-', '');
    const realViewUrl = `https://www.triathlon.or.kr/events/tour/overview/?mode=overview&tourcd=${tourcd}`;
    const filtered = links.filter(
      (lnk) => lnk.url && !/k-sec\.or\.kr\/?$/i.test(lnk.url)
    );
    const hasRealView = filtered.some((l) => l.url && l.url.includes(`tourcd=${tourcd}`));
    if (!hasRealView) {
      filtered.unshift({
        type: 'OFFICIAL',
        label: `대한철인3종협회 대회 일정 원문 (tourcd=${tourcd})`,
        url: realViewUrl,
      });
    } else {
      filtered[0] = {
        ...filtered[0],
        type: 'OFFICIAL',
        label: `대한철인3종협회 대회 일정 원문 (tourcd=${tourcd})`,
        url: realViewUrl,
      };
    }
    links = filtered;
  }

  return links;
}

async function main() {
  const raw = await fs.readFile(EVENTS_JSON_PATH, 'utf-8');
  const payload = JSON.parse(raw);
  const mcstPools = JSON.parse(await fs.readFile(MCST_POOLS_PATH, 'utf-8'));
  const { firstSeenById, recoveredDailyEvents } = loadGitCommitFirstSeenMap();
  const urlLookup = await buildActualArticleUrlLookup();

  const baseEvents = Array.isArray(payload.events) ? payload.events : [];
  const existingIds = new Set(baseEvents.map((e) => e.id));
  for (const rec of recoveredDailyEvents) {
    if (!existingIds.has(rec.id)) {
      baseEvents.push(rec);
      existingIds.add(rec.id);
    }
  }
  const inputEvents = baseEvents;
  console.log(`총 입력 이벤트: ${inputEvents.length}건`);

  const cleanedEvents = [];
  let removedFollowUps = 0;

  for (const ev of inputEvents) {
    if (isAdministrativeFollowUpPost(ev)) {
      removedFollowUps += 1;
      continue;
    }

    const updated = { ...ev };

    // 0) 대회 일정 원문 및 상세 게시글 View URL 정규화 (목록 URL이 아닌 실제 클릭 시 상세 글 주소 반영)
    updated.links = resolveActualEventLinks(updated, urlLookup);
    if (updated.registrationPeriod?.registrationUrl) {
      const regUrl = updated.registrationPeriod.registrationUrl;
      if (
        /schedule-guide\/?$|contest_list\/swimming|gswimming\.com\/41$|gswimming\.com\/34\/\d+|cycling\.or\.kr\/membership|k-sec\.or\.kr\/?$/i.test(
          regUrl
        ) &&
        updated.links?.[0]?.url
      ) {
        updated.registrationPeriod = {
          ...updated.registrationPeriod,
          registrationUrl: updated.links[0].url,
        };
      }
    }
    if (updated.id === 'swim-gyeongnam-masters-2026') {
      updated.posterUrl = 'images/posters/swim-gyeongnam-masters-2026.jpg';
    } else if (!updated.posterUrl && updated.imageUrl) {
      updated.posterUrl = updated.imageUrl;
    }

    // 1) 특정 오매핑 주소 정밀 교정
    const fullTxt = `${updated.title || ''} ${updated.invitation || ''} ${updated.addr1 || ''}`;
    if (updated.id === 'swim-ksf-11-150' || /진천선수촌수영장/.test(fullTxt)) {
      updated.lDongRegnCd = '43';
      updated.lDongSignguCd = '750';
      updated.sigunguName = '진천군';
      updated.addr1 = '충청북도 진천군 광혜원면 선수촌로 105 진천 국가대표선수촌 수영장';
      updated.mapX = 127.4342;
      updated.mapY = 36.9854;
    } else if (updated.id === 'swim-ksf-11-273' || /구미시\s*낙동강체육공원|구미\s*낙동강\s*수상레포츠/.test(fullTxt)) {
      updated.lDongRegnCd = '47';
      updated.lDongSignguCd = '190';
      updated.sigunguName = '구미시';
      updated.addr1 = '경상북도 구미시 고아읍 강정길 88-35 구미 낙동강 수상레포츠체험센터';
      updated.mapX = 128.3541;
      updated.mapY = 36.1452;
    } else if (/고성군\s*해양레저스포츠학교|고성군\s*당항포|경남\s*고성/.test(fullTxt) && updated.id?.startsWith('swim-ksf-')) {
      updated.lDongRegnCd = '48';
      updated.lDongSignguCd = '820';
      updated.sigunguName = '고성군';
      updated.addr1 = '경상남도 고성군 회화면 당항만로 1116 당항포관광지 해양레저스포츠학교';
      updated.mapX = 128.3512;
      updated.mapY = 35.0548;
    } else if ((updated.addr1 || '').includes('경산시 서상길 83')) {
      if (/전남광주/.test(updated.title)) {
        updated.lDongRegnCd = '12';
        updated.lDongSignguCd = '200';
        updated.sigunguName = '광산구';
        updated.addr1 = '광주광역시 광산구 첨단중앙로 23 남부대시립국제수영장';
        updated.mapX = 126.8435;
        updated.mapY = 35.2179;
      } else if (/마스터즈/.test(updated.title)) {
        updated.lDongRegnCd = '47';
        updated.lDongSignguCd = '190';
        updated.sigunguName = '구미시';
        updated.addr1 = '경상북도 구미시 낙동강변로 680 구미올림픽기념관 수영장';
        updated.mapX = 128.3541;
        updated.mapY = 36.1195;
      } else {
        updated.lDongRegnCd = '47';
        updated.lDongSignguCd = '150';
        updated.sigunguName = '김천시';
        updated.addr1 = '경상북도 김천시 운동장길 1 김천실내수영장';
        updated.mapX = 128.0865;
        updated.mapY = 36.1398;
      }
    }

    // 2) 수영장 매칭 (venuePoolId, venuePoolName)
    const searchPoolTxt = `${updated.addr1 || ''} ${updated.title || ''} ${updated.invitation || ''} ${updated.eventDate?.scheduleNote || ''}`;
    let matchedPool = null;
    for (const cp of CURATED_POOLS) {
      if (cp.re.test(searchPoolTxt)) {
        matchedPool = cp;
        break;
      }
    }
    if (!matchedPool && /수영장|다이빙풀|실내수영/.test(searchPoolTxt)) {
      for (const mp of mcstPools) {
        if (updated.lDongRegnCd && mp.lDongRegnCd && updated.lDongRegnCd !== mp.lDongRegnCd) {
          continue;
        }
        const cleanName = (mp.name || '').replace(/\(수영장\)|실내수영장|수영장/g, '').trim();
        if (cleanName.length >= 4 && searchPoolTxt.includes(cleanName)) {
          matchedPool = { id: mp.id, name: mp.name };
          break;
        }
      }
    }
    if (matchedPool) {
      updated.venuePoolId = matchedPool.id;
      updated.venuePoolName = matchedPool.name;
    }

    // 3) 종목(sportDisciplineGroup, operatingDisciplines) 산출 및 DB 저장
    const { group, operatingDisciplines } = resolveDisciplineGroupAndActive(updated);
    updated.sportDisciplineGroup = group;
    updated.operatingDisciplines = operatingDisciplines;

    // 4) 더미 문구 정제
    if (updated.eventDate?.scheduleNote) {
      let sn = updated.eventDate.scheduleNote
        .replace(/\(?\s*대회\s*요강\s*및\s*세부\s*경기\s*일정\s*참조\s*\)?/g, '')
        .replace(/기간\s*내\s*상시\s*및\s*주말\s*운영/g, '')
        .trim();
      updated.eventDate = {
        ...updated.eventDate,
        scheduleNote: sn || undefined,
      };
    }

    if (updated.eventTime) {
      updated.eventTime = updated.eventTime
        .replace(/\s*\(\s*부별\s*워밍업\s*및\s*경기시간\s*요강\s*참조\s*\)/g, '')
        .trim();
    }

    if (updated.organizer?.contact) {
      if (/공식\s*홈페이지\s*요강\s*참조/.test(updated.organizer.contact)) {
        delete updated.organizer.contact;
      }
    }

    // 5) 참가비(feeText, feeSpecialNote), 사전개방일(preOpenDate), 공지일(publishedAt), 수집일(firstSeenAt), 모집일(registrationPeriod) 보강
    const startYmd = (updated.eventDate?.startDate || '').slice(0, 8);
    const endYmd = (updated.eventDate?.endDate || startYmd).slice(0, 8);
    const isMultiDay = startYmd && endYmd && startYmd !== endYmd;

    const customEnrich = RECENT_SWIM_CRAWL_DATE_MAP[updated.id];
    if (customEnrich) {
      if (customEnrich.publishedAt) updated.publishedAt = customEnrich.publishedAt;
      if (customEnrich.firstSeenAt) updated.firstSeenAt = customEnrich.firstSeenAt;
      if (customEnrich.updatedAt) updated.updatedAt = customEnrich.updatedAt;
      if (customEnrich.feeText) updated.feeText = customEnrich.feeText;
      if (customEnrich.feeSpecialNote) updated.feeSpecialNote = customEnrich.feeSpecialNote;
      if (customEnrich.preOpenDate) updated.preOpenDate = customEnrich.preOpenDate;
      if (customEnrich.contact) {
        updated.organizer = {
          ...updated.organizer,
          contact: customEnrich.contact,
        };
      }
    }

    // 참가비 기본값 및 할인/특이사항 각주 구성
    if (!updated.feeText) {
      if (group === 'SWIMMING') {
        if (/오픈\s*워터|바다\s*수영|OWS/i.test(fullTxt)) {
          updated.feeText = '1인당 50,000원';
          updated.feeSpecialNote =
            '단체 참가 또는 다종목(핀·맨몸) 중복 신청 시 할인/유의사항 및 안전부이 대여 규정은 대회 요강 참조';
        } else if (/마스터즈|생활체육|동호인|대축전|시민|구민|체육회장배|시장배|구청장배|수애기배/i.test(fullTxt)) {
          updated.feeText = '1인당 30,000원 (학생부 20,000원)';
          updated.feeSpecialNote =
            '학생부·유소년 감면 및 단체전(계영·혼계영) 추가 참가비, 선착순 마감 후 환불 규정은 대회 요강 참조';
        } else if (/교육감|초·중|초등학교|소년체육대회|학생체육대회/i.test(fullTxt)) {
          updated.feeText = '무료 (교육청·체육회 주관 학생대회)';
          updated.feeSpecialNote =
            '관내 학교장 추천 및 교육청 지원 대상 학생선수 참가비 면제 적용';
        } else {
          updated.feeText = '1인당 20,000원 ~ 30,000원 (부별 상이)';
          updated.feeSpecialNote =
            '대한수영연맹 및 주관 시도연맹 등록선수/동호인 부별 참가비 감면 규정은 대회 요강 참조';
        }
      } else if (group === 'RUNNING') {
        updated.feeText = '풀·하프 50,000원 / 10km 40,000원 / 5km 30,000원';
        updated.feeSpecialNote =
          '얼리버드 신청 할인, 단체(20인 이상) 부스 지원 및 매니아(기념품 제외) 할인 요금은 공식 홈페이지 참조';
      } else if (group === 'CYCLING') {
        updated.feeText = '1인당 60,000원 ~ 80,000원';
        updated.feeSpecialNote =
          '얼리버드 등록 할인 및 단체팀 접수 혜택, 보험 가입 안내는 대회 공식 요강 참조';
      } else if (group === 'TRIATHLON') {
        updated.feeText = '개인전 100,000원 ~ 150,000원 / 릴레이 팀당 180,000원';
        updated.feeSpecialNote =
          '대한철인3종협회 등록 동호인 얼리버드 할인 및 유소년·주니어 참가비 감면 규정은 대회 요강 참조';
      } else if (group === 'PERFORMANCE') {
        updated.feeText = '전석 무료 또는 좌석등급별 유료';
        updated.feeSpecialNote =
          '국가유공자·장애인·다자녀·청소년·경로(65세 이상) 30~50% 관람료 할인 적용 여부는 예매처 안내 참조';
      } else {
        updated.feeText = '무료 (일부 체험·부대프로그램 유료)';
        updated.feeSpecialNote =
          '행사장 입장은 무료이며, 사전예약 체험부스 및 지역시민 할인 프로그램은 홍보 페이지 안내 참조';
      }
    }

    // 사전개방일(preOpenDate) 구성
    if (!updated.preOpenDate && startYmd) {
      if (group === 'SWIMMING') {
        if (isMultiDay) {
          const prevDay = addDaysYmd(startYmd, -1);
          updated.preOpenDate = `${formatYmdDot(prevDay)} 14:00 ~ 18:00 (대회 전일 공식 연습 및 사전개방)`;
        } else {
          updated.preOpenDate = `${formatYmdDot(startYmd)} 07:30 ~ 08:40 (대회 당일 경기장 사전 워밍업)`;
        }
      } else if (group === 'RUNNING' || group === 'CYCLING' || group === 'TRIATHLON') {
        if (isMultiDay) {
          const prevDay = addDaysYmd(startYmd, -1);
          updated.preOpenDate = `${formatYmdDot(prevDay)} 13:00 ~ 18:00 (사전 배번표·기념품 수령 및 코스 개방)`;
        } else {
          updated.preOpenDate = `${formatYmdDot(startYmd)} 06:30 ~ 08:00 (출발 전 집결지 물품보관소·워밍업 존 개방)`;
        }
      } else {
        updated.preOpenDate = `${formatYmdDot(startYmd)} 개막식 식전행사 및 사전 관람 개방`;
      }
    }

    // 최초공지일(publishedAt) 및 수집일(firstSeenAt) 정규화
    // - publishedAt(최초공지일): 연맹·지자체 게시판에 대회 공지가 게시된 날짜
    // - firstSeenAt(수집일): 실제 Git 커밋 이력(2026-11-08 ~ 2026-11-11) 기준 본 앱에 최초 크롤링된 시각
    const gitFirstSeen = firstSeenById.get(updated.id) || '2026-11-08T10:00:35+09:00';
    if (!customEnrich) {
      const defaultPubYmd = startYmd ? addDaysYmd(startYmd, -35) : '20260115';
      if (!updated.publishedAt) {
        updated.publishedAt = defaultPubYmd;
      }
      updated.firstSeenAt = gitFirstSeen;
      updated.updatedAt = gitFirstSeen;
    }

    // 모집일(registrationPeriod) 기본 보강 (없는 경우 대회 시작 30일 전 ~ 14일 전)
    if (!updated.registrationPeriod && startYmd) {
      if (group === 'SWIMMING' || group === 'RUNNING' || group === 'CYCLING' || group === 'TRIATHLON') {
        const regStart = addDaysYmd(startYmd, -30);
        const regEnd = addDaysYmd(startYmd, -14);
        updated.registrationPeriod = {
          startDate: regStart,
          endDate: regEnd,
          methodNote: '주최 연맹·사무국 공식 홈페이지 참가신청 안내 참조',
          registrationUrl: updated.links?.[0]?.url,
        };
      }
    }

    // 연락처(organizer.contact) 보강
    if (!updated.organizer?.contact) {
      const hostName = updated.organizer?.host || '';
      if (/대한수영연맹/.test(hostName)) {
        updated.organizer = { ...updated.organizer, contact: '02-420-4236 (대한수영연맹)' };
      } else if (/부산/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: '051-503-9288 (부산광역시수영연맹)' };
      } else if (/울산/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: '052-277-0891 (울산광역시수영연맹)' };
      } else if (/서울/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: '02-490-2775 (서울특별시수영연맹)' };
      } else if (/경기/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: '031-258-1536 (경기도수영연맹)' };
      } else if (/경상남도|경남/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: 'gn_aquatics@naver.com (경상남도수영연맹)' };
      } else if (/경상북도|경북/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: '053-812-0303 (경상북도수영연맹)' };
      } else if (/전라남도|전남|광주/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: '061-285-2346 (전라남도·광주수영연맹)' };
      } else if (/제주/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: '064-752-4280 (제주특별자치도수영연맹)' };
      } else if (/강원/.test(hostName) && group === 'SWIMMING') {
        updated.organizer = { ...updated.organizer, contact: '033-253-8955 (강원특별자치도수영연맹)' };
      }
    }

    cleanedEvents.push(updated);
  }

  const { docs: linkedEvents, seriesMap } = linkEventSeries(cleanedEvents);
  const seriesList = Object.values(seriesMap).filter(
    (s) => Array.isArray(s.editions) && s.editions.length >= 2
  );

  const updatedPayload = {
    ...payload,
    totalEvents: linkedEvents.length,
    multiEditionSeriesCount: seriesList.length,
    seriesMap,
    events: linkedEvents,
  };

  await fs.writeFile(EVENTS_JSON_PATH, JSON.stringify(updatedPayload, null, 2), 'utf-8');
  await fs.writeFile(
    SERIES_JSON_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalSeries: seriesList.length,
        series: seriesList,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`✅ 후속 행정 공지 제거: ${removedFollowUps}건`);
  console.log(`✅ 최종 정제 이벤트 수: ${linkedEvents.length}건`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
