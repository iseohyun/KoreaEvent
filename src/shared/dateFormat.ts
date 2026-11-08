/**
 * 날짜 표기 공용 유틸 (YYYYMMDD → YYYY.MM.DD)
 * - 여러 컴포넌트에 복사되어 있던 formatDate 를 한 곳으로 모음
 */

/** YYYYMMDD → YYYY.MM.DD (8자리 미만이면 원문 그대로) */
export function formatYmd(ymd: string): string {
  if (!ymd || ymd.length < 8) return ymd;
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

/** 시작일 ~ 종료일 (같은 날이면 하루만 표기) */
export function formatYmdRange(start: string, end: string): string {
  if (!end || end === start) return formatYmd(start);
  return `${formatYmd(start)} ~ ${formatYmd(end)}`;
}
