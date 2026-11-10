import defaultAbbrJson from '../constants/abbreviations.json';

export interface RegexAbbreviationRule {
  id: string;
  label: string;
  example: string;
  pattern: string;
  replacement: string;
  enabled: boolean;
}

export interface WordAbbreviationRule {
  id: string;
  from: string;
  to: string;
  count?: number;
  enabled: boolean;
}

export interface AbbreviationSettings {
  enabled: boolean;
  regexRules: RegexAbbreviationRule[];
  wordRules: WordAbbreviationRule[];
}

const STORAGE_KEY = 'korea_event_abbreviation_settings_v3';

export function getDefaultAbbreviationSettings(): AbbreviationSettings {
  return {
    enabled: true,
    regexRules: (defaultAbbrJson.regexRules || []).map((r) => ({ ...r })),
    wordRules: (defaultAbbrJson.wordRules || []).map((w) => ({ ...w })),
  };
}

export function loadAbbreviationSettings(): AbbreviationSettings {
  const defaults = getDefaultAbbreviationSettings();
  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<AbbreviationSettings>;
    const enabled =
      typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled;

    const regexRules = Array.isArray(parsed.regexRules)
      ? parsed.regexRules.filter(
          (r): r is RegexAbbreviationRule =>
            Boolean(r && typeof r.pattern === 'string' && typeof r.replacement === 'string')
        )
      : defaults.regexRules;

    const wordRules = Array.isArray(parsed.wordRules)
      ? parsed.wordRules.filter(
          (w): w is WordAbbreviationRule =>
            Boolean(w && typeof w.from === 'string' && typeof w.to === 'string')
        )
      : defaults.wordRules;

    return {
      enabled,
      regexRules,
      wordRules,
    };
  } catch (err) {
    console.warn('Failed to load abbreviation settings from localStorage:', err);
    return defaults;
  }
}

export function saveAbbreviationSettings(settings: AbbreviationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save abbreviation settings to localStorage:', err);
  }
}

/**
 * 축약보기 변환 함수
 * 1) 활성화된 정규식 규칙 적용 (영문+한글 병기 한글화, 괄호 제거, 2026년 -> 2026, 제25회/제2차 -> 25'/2', ~배 수영대회 -> ~배 등)
 * 2) 활성화된 단어 축약 사전 적용 (글자수 내림차순으로 긴 단어부터 치환)
 */
export function applyAbbreviation(
  text: string | undefined | null,
  settings: AbbreviationSettings
): string {
  if (!text) return '';
  if (!settings.enabled) return text;

  let result = text;

  for (const rule of settings.regexRules) {
    if (!rule.enabled || !rule.pattern) continue;
    try {
      const re = new RegExp(rule.pattern, 'g');
      result = result.replace(re, rule.replacement);
    } catch (err) {
      console.warn(`Invalid regex pattern in abbreviation rule (${rule.id}):`, err);
    }
  }

  const activeWords = settings.wordRules
    .filter((w) => w.enabled && w.from.trim().length > 0)
    .sort((a, b) => b.from.length - a.from.length);

  for (const word of activeWords) {
    if (result.includes(word.from)) {
      result = result.split(word.from).join(word.to);
    }
  }

  return result.replace(/\s{2,}/g, ' ').trim();
}
