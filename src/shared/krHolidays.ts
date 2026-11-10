/**
 * 대한민국 법정공휴일 · 대체공휴일 · 임시공휴일 · 선거일 계산 모듈
 * - 양력 고정 공휴일 (신정, 삼일절, 어린이날, 현충일, 제헌절, 광복절, 개천절, 한글날, 성탄절)
 * - 음력 공휴일 (설날 연휴 3일, 부처님오신날, 추석 연휴 3일) — Intl.DateTimeFormat('en-u-ca-chinese') 기반
 * - 공휴일에 관한 법률 제3조에 따른 대체공휴일 자동 산출
 * - 역대 및 예정 공직선거일·임시공휴일 반영
 */

type SubstituteRuleType = 'NONE' | 'SUN_ONLY' | 'SAT_SUN';

interface HolidayEntry {
  name: string;
  subType: SubstituteRuleType;
}

const lunarFormatter = new Intl.DateTimeFormat('en-u-ca-chinese', {
  month: 'numeric',
  day: 'numeric',
});

const yearHolidayCache = new Map<number, Map<string, string[]>>();

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(dt: Date): string {
  return `${dt.getFullYear()}${pad2(dt.getMonth() + 1)}${pad2(dt.getDate())}`;
}

function fromYmd(ymd: string): Date {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6)) - 1;
  const d = Number(ymd.slice(6, 8));
  return new Date(y, m, d);
}

/**
 * 연도별 임시공휴일 및 공직선거일 (법정 공휴일)
 */
const SPECIAL_PUBLIC_HOLIDAYS: Record<string, string> = {
  '20200415': '제21대 국회의원선거',
  '20200817': '임시공휴일',
  '20220309': '제20대 대통령선거',
  '20220601': '제8회 지방선거',
  '20231002': '임시공휴일',
  '20240410': '제22대 국회의원선거',
  '20241001': '국군의날(임시공휴일)',
  '20250127': '임시공휴일',
  '20250603': '제21대 대통령선거',
  '20260603': '제9회 지방선거',
  '20280412': '제23대 국회의원선거',
  '20300605': '제10회 지방선거',
  '20300508': '제22대 대통령선거',
};

/**
 * 특정 연도(year)의 대한민국 공휴일 맵(YYYYMMDD -> 공휴일 명칭 배열) 반환
 */
export function getKoreanHolidaysForYear(year: number): Map<string, string[]> {
  const cached = yearHolidayCache.get(year);
  if (cached) return cached;

  const map = new Map<string, HolidayEntry[]>();

  const add = (
    ymd: string,
    name: string,
    subType: SubstituteRuleType = 'NONE'
  ) => {
    const arr = map.get(ymd) || [];
    if (!arr.some((x) => x.name === name)) {
      arr.push({ name, subType });
    }
    map.set(ymd, arr);
  };

  // 1. 양력 고정 공휴일
  add(`${year}0101`, '신정', 'NONE');
  add(`${year}0301`, '삼일절', year >= 2022 ? 'SAT_SUN' : 'NONE');
  add(`${year}0505`, '어린이날', 'SAT_SUN');
  add(`${year}0606`, '현충일', 'NONE');
  if (year >= 2026) {
    add(`${year}0717`, '제헌절', 'SAT_SUN');
  }
  add(`${year}0815`, '광복절', year >= 2021 ? 'SAT_SUN' : 'NONE');
  add(`${year}1003`, '개천절', year >= 2021 ? 'SAT_SUN' : 'NONE');
  add(`${year}1009`, '한글날', year >= 2021 ? 'SAT_SUN' : 'NONE');
  add(`${year}1225`, '성탄절', year >= 2023 ? 'SAT_SUN' : 'NONE');

  // 2. 음력 공휴일 (설날 연휴, 부처님오신날, 추석 연휴)
  // 설날 연휴 전날(섣달그믐)이 1월 1일인 경우도 포함하기 위해 1월 1일 ~ 12월 31일 순회
  const cur = new Date(year, 0, 1);
  while (cur.getFullYear() === year) {
    const lunarStr = lunarFormatter.format(cur); // 예: "1/1", "4/8", "8/15", 윤달은 "4bis/8"
    if (lunarStr === '1/1') {
      const prev = new Date(cur);
      prev.setDate(prev.getDate() - 1);
      const next = new Date(cur);
      next.setDate(next.getDate() + 1);

      if (prev.getFullYear() === year) {
        add(toYmd(prev), '설날 연휴', 'SUN_ONLY');
      }
      add(toYmd(cur), '설날', 'SUN_ONLY');
      if (next.getFullYear() === year) {
        add(toYmd(next), '설날 연휴', 'SUN_ONLY');
      }
    } else if (lunarStr === '4/8') {
      add(toYmd(cur), '부처님오신날', year >= 2023 ? 'SAT_SUN' : 'NONE');
    } else if (lunarStr === '8/15') {
      const prev = new Date(cur);
      prev.setDate(prev.getDate() - 1);
      const next = new Date(cur);
      next.setDate(next.getDate() + 1);

      add(toYmd(prev), '추석 연휴', 'SUN_ONLY');
      add(toYmd(cur), '추석', 'SUN_ONLY');
      add(toYmd(next), '추석 연휴', 'SUN_ONLY');
    }
    cur.setDate(cur.getDate() + 1);
  }

  // 3. 선거일 및 임시공휴일
  Object.entries(SPECIAL_PUBLIC_HOLIDAYS).forEach(([ymd, label]) => {
    if (ymd.startsWith(String(year))) {
      add(ymd, label, 'NONE');
    }
  });

  // 4. 대체공휴일 계산 (날짜 오름차순)
  const sortedYmds = Array.from(map.keys()).sort();
  for (const ymd of sortedYmds) {
    const items = map.get(ymd) || [];
    const dt = fromYmd(ymd);
    const dow = dt.getDay();
    const eligible = items.filter((it) => it.subType !== 'NONE');
    if (eligible.length === 0) continue;

    let subNeeded = 0;
    if (dow === 0) {
      // 일요일과 겹친 경우: 대체공휴일 대상 공휴일 수만큼 부여
      subNeeded = eligible.length;
    } else if (dow === 6) {
      // 토요일과 겹친 경우: 토·일 대체공휴일 대상(SAT_SUN) 수 또는 중복 공휴일 수
      const satSunCount = eligible.filter((it) => it.subType === 'SAT_SUN').length;
      const overlapExtra = items.length > 1 ? items.length - 1 : 0;
      subNeeded = Math.max(satSunCount, Math.min(eligible.length, overlapExtra));
    } else {
      // 평일에 2개 이상의 공휴일이 겹친 경우 (예: 어린이날+부처님오신날, 추석+개천절)
      if (items.length > 1) {
        subNeeded = Math.min(eligible.length, items.length - 1);
      }
    }

    for (let s = 0; s < subNeeded; s += 1) {
      const cand = new Date(dt);
      cand.setDate(cand.getDate() + 1);
      // 그 다음 첫 번째 비공휴일(토·일요일 및 다른 공휴일이 아닌 날) 탐색
      while (
        cand.getDay() === 0 ||
        cand.getDay() === 6 ||
        map.has(toYmd(cand))
      ) {
        cand.setDate(cand.getDate() + 1);
      }
      add(toYmd(cand), '대체공휴일', 'NONE');
    }
  }

  const result = new Map<string, string[]>();
  Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([ymd, entries]) => {
      result.set(
        ymd,
        entries.map((e) => e.name)
      );
    });

  yearHolidayCache.set(year, result);
  return result;
}
