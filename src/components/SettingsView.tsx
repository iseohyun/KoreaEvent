import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Code2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AbbreviationSettings,
  applyAbbreviation,
  getDefaultAbbreviationSettings,
  RegexAbbreviationRule,
  WordAbbreviationRule,
} from '../shared/abbreviation';
import styles from './SettingsView.module.css';

interface SettingsViewProps {
  settings: AbbreviationSettings;
  onChangeSettings: (next: AbbreviationSettings) => void;
  onBack?: () => void;
  previousMenuLabel?: string;
}

type WordFilterTab = 'ALL' | 'ACTIVE' | 'CANDIDATE';

const DEFAULT_PREVIEW_SAMPLE =
  '010-8870-1075 (문의) 제1회유소년수영협회장배 전국수영대회 / [요강수정]제11회 서울특별시연맹회장배수영대회 / [개최요강수정] 제4회 은평구연맹회장배수영대회 / [다이빙 등록,비등록] 제45회 서울시장기 겸 제105회 전국체전 선발전 / [참가마감]제15회 영등포구수영연맹회장배 수영대회 / 2026 제16회 창원특례시장배 전국 마스터즈 수영대회 / 제51회 전남광주통합특별시(전남)학생종합체육대회 (수영경기)';

const PAGE_STEP = 120;

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onChangeSettings,
  onBack,
  previousMenuLabel,
}) => {
  const [sampleText, setSampleText] = useState<string>(DEFAULT_PREVIEW_SAMPLE);
  const [wordSearch, setWordSearch] = useState<string>('');
  const [wordFilterTab, setWordFilterTab] = useState<WordFilterTab>('ALL');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_STEP);

  // 새 단어 추가 입력 상태
  const [newWordFrom, setNewWordFrom] = useState<string>('');
  const [newWordTo, setNewWordTo] = useState<string>('');
  const [wordAddError, setWordAddError] = useState<string | null>(null);

  // 새 정규식 추가 입력 상태
  const [newRegexLabel, setNewRegexLabel] = useState<string>('');
  const [newRegexPattern, setNewRegexPattern] = useState<string>('');
  const [newRegexReplacement, setNewRegexReplacement] = useState<string>('');
  const [regexAddError, setRegexAddError] = useState<string | null>(null);

  // JSON 직접 편집창 상태
  const [showJsonEditor, setShowJsonEditor] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>('');
  const [jsonMsg, setJsonMsg] = useState<string | null>(null);

  const previewOutput = useMemo(() => {
    return applyAbbreviation(sampleText, {
      ...settings,
      enabled: true, // 미리보기에서는 항상 변환 결과를 확인할 수 있도록 표시
    });
  }, [sampleText, settings]);

  const activeRegexCount = settings.regexRules.filter((r) => r.enabled).length;
  const activeWordCount = settings.wordRules.filter((w) => w.enabled).length;
  const candidateWordCount = settings.wordRules.length - activeWordCount;

  const filteredWordRules = useMemo(() => {
    const kw = wordSearch.trim().toLowerCase();
    return settings.wordRules.filter((w) => {
      if (wordFilterTab === 'ACTIVE' && !w.enabled) return false;
      if (wordFilterTab === 'CANDIDATE' && w.enabled) return false;
      if (!kw) return true;
      return (
        w.from.toLowerCase().includes(kw) || w.to.toLowerCase().includes(kw)
      );
    });
  }, [settings.wordRules, wordSearch, wordFilterTab]);

  const visibleWordRules = useMemo(() => {
    return filteredWordRules.slice(0, visibleLimit);
  }, [filteredWordRules, visibleLimit]);

  const handleToggleMaster = () => {
    onChangeSettings({
      ...settings,
      enabled: !settings.enabled,
    });
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultAbbreviationSettings();
    onChangeSettings(defaults);
    if (showJsonEditor) {
      setJsonText(
        JSON.stringify(
          {
            regexRules: defaults.regexRules,
            wordRules: defaults.wordRules,
          },
          null,
          2
        )
      );
      setJsonMsg('기본 JSON 사전으로 복원되었습니다.');
    }
  };

  // 정규식 규칙 핸들러
  const handleUpdateRegexRule = (
    id: string,
    patch: Partial<RegexAbbreviationRule>
  ) => {
    onChangeSettings({
      ...settings,
      regexRules: settings.regexRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    });
  };

  const handleDeleteRegexRule = (id: string) => {
    onChangeSettings({
      ...settings,
      regexRules: settings.regexRules.filter((r) => r.id !== id),
    });
  };

  const handleAddRegexRule = () => {
    setRegexAddError(null);
    const pat = newRegexPattern.trim();
    if (!pat) {
      setRegexAddError('정규식 패턴을 입력해 주세요.');
      return;
    }
    try {
      new RegExp(pat, 'g');
    } catch {
      setRegexAddError('유효하지 않은 정규식 문법입니다.');
      return;
    }

    const newRule: RegexAbbreviationRule = {
      id: `regex-${Date.now()}`,
      label: newRegexLabel.trim() || '사용자 정의 정규식',
      example: `${pat} -> ${newRegexReplacement}`,
      pattern: pat,
      replacement: newRegexReplacement,
      enabled: true,
    };

    onChangeSettings({
      ...settings,
      regexRules: [...settings.regexRules, newRule],
    });
    setNewRegexLabel('');
    setNewRegexPattern('');
    setNewRegexReplacement('');
  };

  // 단어 규칙 핸들러
  const handleUpdateWordRule = (
    id: string,
    patch: Partial<WordAbbreviationRule>
  ) => {
    onChangeSettings({
      ...settings,
      wordRules: settings.wordRules.map((w) =>
        w.id === id ? { ...w, ...patch } : w
      ),
    });
  };

  const handleDeleteWordRule = (id: string) => {
    onChangeSettings({
      ...settings,
      wordRules: settings.wordRules.filter((w) => w.id !== id),
    });
  };

  const handleAddWordRule = () => {
    setWordAddError(null);
    const fromClean = newWordFrom.trim();
    const toClean = newWordTo.trim();

    if (!fromClean) {
      setWordAddError('변환할 원본 단어를 입력해 주세요.');
      return;
    }

    const existingIdx = settings.wordRules.findIndex(
      (w) => w.from === fromClean
    );
    if (existingIdx >= 0) {
      const nextList = [...settings.wordRules];
      nextList[existingIdx] = {
        ...nextList[existingIdx],
        to: toClean,
        enabled: true,
      };
      onChangeSettings({
        ...settings,
        wordRules: nextList,
      });
      setNewWordFrom('');
      setNewWordTo('');
      return;
    }

    const newWord: WordAbbreviationRule = {
      id: `word-${Date.now()}`,
      from: fromClean,
      to: toClean,
      count: 1,
      enabled: true,
    };

    onChangeSettings({
      ...settings,
      wordRules: [newWord, ...settings.wordRules],
    });
    setNewWordFrom('');
    setNewWordTo('');
  };

  const handleToggleJsonEditor = () => {
    if (!showJsonEditor) {
      setJsonText(
        JSON.stringify(
          {
            regexRules: settings.regexRules,
            wordRules: settings.wordRules,
          },
          null,
          2
        )
      );
      setJsonMsg(null);
    }
    setShowJsonEditor((prev) => !prev);
  };

  const handleApplyJsonText = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const nextRegex = Array.isArray(parsed.regexRules)
        ? parsed.regexRules
        : settings.regexRules;
      const nextWords = Array.isArray(parsed.wordRules)
        ? parsed.wordRules
        : settings.wordRules;

      onChangeSettings({
        ...settings,
        regexRules: nextRegex,
        wordRules: nextWords,
      });
      setJsonMsg('✅ JSON 설정이 즉시 저장 및 반영되었습니다.');
    } catch {
      setJsonMsg('⚠️ JSON 형식이 올바르지 않습니다. 문법을 확인해 주세요.');
    }
  };

  return (
    <div className={styles.page}>
      {/* 상단 돌아가기 & JSON/초기화 액션 */}
      <div className={styles.topNavRow}>
        {onBack ? (
          <button type="button" className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={16} />
            <span>
              {previousMenuLabel
                ? `${previousMenuLabel} 화면으로 돌아가기`
                : '이전 화면으로 돌아가기'}
            </span>
          </button>
        ) : (
          <div />
        )}

        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleToggleJsonEditor}
          >
            <Code2 size={15} />
            <span>{showJsonEditor ? 'JSON 편집기 닫기' : 'JSON 원본 보기 · 편집'}</span>
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleResetDefaults}
            title="기본 abbreviations.json 초기 상태로 복원"
          >
            <RotateCcw size={14} />
            <span>기본값 초기화</span>
          </button>
        </div>
      </div>

      {/* JSON 원본 직접 확인/편집 패널 */}
      {showJsonEditor && (
        <section className={styles.jsonEditorBox} aria-label="JSON 원본 편집기">
          <div className={styles.jsonEditorFooter}>
            <strong>
              📄 축약 사전 JSON (src/constants/abbreviations.json · 후보{' '}
              {settings.wordRules.length.toLocaleString()}개)
            </strong>
            <div className={styles.topActions}>
              <button
                type="button"
                className={styles.primaryAddBtn}
                onClick={handleApplyJsonText}
              >
                <Check size={14} />
                <span>JSON 변경사항 반영</span>
              </button>
            </div>
          </div>
          <textarea
            className={styles.jsonTextarea}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
          {jsonMsg && <span className={styles.jsonStatusMsg}>{jsonMsg}</span>}
        </section>
      )}

      {/* 1. 축약보기 전역 ON/OFF 및 실시간 변환 미리보기 */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleWrap}>
            <Sparkles size={19} color="#2563eb" />
            <h2 className={styles.cardTitle}>축약보기 설정 및 실시간 미리보기</h2>
            <span className={styles.countBadge}>
              정규식 {activeRegexCount}개 · 단어 {activeWordCount}개 활성 (전체 후보{' '}
              {settings.wordRules.length.toLocaleString()}개)
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            className={`${styles.masterToggleBtn} ${
              settings.enabled ? styles.masterToggleBtnOn : ''
            }`}
            onClick={handleToggleMaster}
          >
            <Check size={15} strokeWidth={3} />
            <span>
              축약보기 {settings.enabled ? '켜짐 (ON)' : '꺼짐 (OFF)'}
            </span>
          </button>
        </div>

        <p className={styles.cardDesc}>
          영문+한글 병기 시 한글만 표기, 불필요한 괄호 문구 제거, 연도(
          <code>2026년 → 2026</code>), 회차/차수(<code>제25회 → 25&apos;</code>,{' '}
          <code>제2차 → 2&apos;</code>), <code>~배 수영대회 → ~배</code> 정규식과 4글자
          이상 단어 축약 사전을 순서대로 적용합니다.
        </p>

        <div className={styles.previewBox}>
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>테스트 원문</span>
            <input
              type="text"
              className={styles.previewInput}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="변환을 테스트할 행사명을 입력해 보세요..."
            />
          </div>
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>축약 결과</span>
            <div className={styles.previewResult}>{previewOutput}</div>
          </div>
        </div>
      </section>

      {/* 2. 정규식(Regex) 축약 규칙 관리 */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleWrap}>
            <h2 className={styles.cardTitle}>정규식(Regex) 축약 규칙</h2>
            <span className={styles.countBadge}>
              {activeRegexCount} / {settings.regexRules.length}개 적용 중
            </span>
          </div>
        </div>

        <p className={styles.cardDesc}>
          위에서 아래 순서대로 정규식이 실행됩니다. 영문+한글 병기 한글화 → 괄호 제거 →
          연도(<code>2026년 → 2026</code>) → 회차/차수(<code>제25회 → 25&apos;</code>) →{' '}
          <code>~배 수영대회 → ~배</code> 순으로 적용됩니다.
        </p>

        {/* 새 정규식 추가 */}
        <div className={styles.addFormRow}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="규칙 설명 (예: 회차 축약)"
            value={newRegexLabel}
            onChange={(e) => setNewRegexLabel(e.target.value)}
          />
          <input
            type="text"
            className={`${styles.inputField} ${styles.inputMono}`}
            placeholder="정규식 패턴 (예: 제\s*(\d+)\s*[회차])"
            value={newRegexPattern}
            onChange={(e) => setNewRegexPattern(e.target.value)}
          />
          <span className={styles.arrowText}>→</span>
          <input
            type="text"
            className={`${styles.inputField} ${styles.inputMono}`}
            placeholder="치환값 (예: $1')"
            value={newRegexReplacement}
            onChange={(e) => setNewRegexReplacement(e.target.value)}
          />
          <button
            type="button"
            className={styles.primaryAddBtn}
            onClick={handleAddRegexRule}
          >
            <Plus size={14} />
            <span>정규식 추가</span>
          </button>
          {regexAddError && (
            <span className={styles.errorText}>{regexAddError}</span>
          )}
        </div>

        <div className={styles.rulesTableWrap}>
          <table className={styles.rulesTable}>
            <thead>
              <tr>
                <th style={{ width: '56px' }}>사용</th>
                <th>규칙 이름 / 예시</th>
                <th>정규식 패턴 (Pattern)</th>
                <th style={{ width: '36px' }} />
                <th>치환 형식 (Replacement)</th>
                <th style={{ width: '52px' }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {settings.regexRules.map((rule) => (
                <tr
                  key={rule.id}
                  className={!rule.enabled ? styles.rowDisabled : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        handleUpdateRegexRule(rule.id, {
                          enabled: e.target.checked,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className={styles.inputField}
                      style={{ width: '100%' }}
                      value={rule.label}
                      onChange={(e) =>
                        handleUpdateRegexRule(rule.id, {
                          label: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className={`${styles.inputField} ${styles.inputMono}`}
                      style={{ width: '100%' }}
                      value={rule.pattern}
                      onChange={(e) =>
                        handleUpdateRegexRule(rule.id, {
                          pattern: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className={styles.arrowText}>→</td>
                  <td>
                    <input
                      type="text"
                      className={`${styles.inputField} ${styles.inputMono}`}
                      style={{ width: '100%' }}
                      value={rule.replacement}
                      onChange={(e) =>
                        handleUpdateRegexRule(rule.id, {
                          replacement: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.iconDeleteBtn}
                      onClick={() => handleDeleteRegexRule(rule.id)}
                      title="규칙 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. 전체 이벤트에서 수집된 4글자 이상 단어 축약 사전 (JSON 관리) */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleWrap}>
            <h2 className={styles.cardTitle}>
              단어 축약 사전 (전체 이벤트 4글자 이상 후보 JSON)
            </h2>
            <span className={styles.countBadge}>
              적용 중 {activeWordCount}개 / 전체 후보{' '}
              {settings.wordRules.length.toLocaleString()}개
            </span>
          </div>
        </div>

        <p className={styles.cardDesc}>
          전체 검색·수집 이벤트에서 추출한 4글자 이상 단어 후보{' '}
          <strong>{settings.wordRules.length.toLocaleString()}개</strong>가 출현 빈도순으로
          수록되어 있습니다. 후보의 우측 입력칸에 축약어를 입력하면 자동으로 체크(활성화)되어
          즉시 반영됩니다.
        </p>

        {/* 새 단어 추가 및 검색 바 */}
        <div className={styles.wordToolbar}>
          <div className={styles.addFormRow} style={{ flex: 1 }}>
            <input
              type="text"
              className={styles.inputField}
              placeholder="원본 단어/구문 (예: 회장배 전국수영대회)"
              value={newWordFrom}
              onChange={(e) => setNewWordFrom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddWordRule();
              }}
            />
            <span className={styles.arrowText}>→</span>
            <input
              type="text"
              className={styles.inputField}
              placeholder="축약어 (예: 전국 수영연맹회장배)"
              value={newWordTo}
              onChange={(e) => setNewWordTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddWordRule();
              }}
            />
            <button
              type="button"
              className={styles.primaryAddBtn}
              onClick={handleAddWordRule}
            >
              <Plus size={14} />
              <span>단어 추가</span>
            </button>
            {wordAddError && (
              <span className={styles.errorText}>{wordAddError}</span>
            )}
          </div>

          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="2,891개 후보 단어 또는 축약어 검색..."
              value={wordSearch}
              onChange={(e) => {
                setWordSearch(e.target.value);
                setVisibleLimit(PAGE_STEP);
              }}
            />
          </div>
        </div>

        {/* 전체 후보 / 적용 중 / 미지정 후보 필터 탭 */}
        <div className={styles.filterTabsRow}>
          <div className={styles.filterTabGroup}>
            <button
              type="button"
              className={`${styles.filterTabBtn} ${
                wordFilterTab === 'ALL' ? styles.filterTabBtnActive : ''
              }`}
              onClick={() => {
                setWordFilterTab('ALL');
                setVisibleLimit(PAGE_STEP);
              }}
            >
              전체 후보 ({settings.wordRules.length.toLocaleString()})
            </button>
            <button
              type="button"
              className={`${styles.filterTabBtn} ${
                wordFilterTab === 'ACTIVE' ? styles.filterTabBtnActive : ''
              }`}
              onClick={() => {
                setWordFilterTab('ACTIVE');
                setVisibleLimit(PAGE_STEP);
              }}
            >
              적용 중 ({activeWordCount.toLocaleString()})
            </button>
            <button
              type="button"
              className={`${styles.filterTabBtn} ${
                wordFilterTab === 'CANDIDATE' ? styles.filterTabBtnActive : ''
              }`}
              onClick={() => {
                setWordFilterTab('CANDIDATE');
                setVisibleLimit(PAGE_STEP);
              }}
            >
              미지정 후보 ({candidateWordCount.toLocaleString()})
            </button>
          </div>

          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
            검색 결과 {filteredWordRules.length.toLocaleString()}개 중{' '}
            {visibleWordRules.length.toLocaleString()}개 표시 중
          </span>
        </div>

        {/* 단어 카드 그리드 */}
        <div className={styles.wordGrid}>
          {visibleWordRules.map((word) => {
            const charLen = word.from.trim().length;
            return (
              <div
                key={word.id}
                className={`${styles.wordItemCard} ${
                  !word.enabled ? styles.wordItemCardDisabled : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={word.enabled}
                  onChange={(e) =>
                    handleUpdateWordRule(word.id, {
                      enabled: e.target.checked,
                    })
                  }
                  title="이 단어 축약 규칙 켜기/끄기"
                />
                <input
                  type="text"
                  className={styles.wordInputFrom}
                  value={word.from}
                  onChange={(e) =>
                    handleUpdateWordRule(word.id, { from: e.target.value })
                  }
                  aria-label="원본 단어"
                />
                <span className={styles.arrowText}>→</span>
                <input
                  type="text"
                  className={styles.wordInputTo}
                  value={word.to}
                  placeholder="축약어 입력"
                  onChange={(e) => {
                    const nextTo = e.target.value;
                    handleUpdateWordRule(word.id, {
                      to: nextTo,
                      enabled: nextTo.trim().length > 0 ? true : word.enabled,
                    });
                  }}
                  aria-label="축약어"
                />
                {typeof word.count === 'number' && word.count > 0 && (
                  <span
                    className={styles.freqBadge}
                    title={`전체 이벤트 중 ${word.count}회 출현`}
                  >
                    {word.count}회
                  </span>
                )}
                <span
                  className={`${styles.lenBadge} ${
                    charLen >= 4 ? styles.lenBadge4Plus : ''
                  }`}
                  title="원본 단어 글자 수"
                >
                  {charLen}자
                </span>
                <button
                  type="button"
                  className={styles.iconDeleteBtn}
                  onClick={() => handleDeleteWordRule(word.id)}
                  title="단어 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {filteredWordRules.length > visibleLimit && (
          <div className={styles.loadMoreRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setVisibleLimit((prev) => prev + PAGE_STEP)}
            >
              후보 더 보기 (+{PAGE_STEP}개, 남은{' '}
              {(filteredWordRules.length - visibleLimit).toLocaleString()}개)
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
