import { getLanguageByCode, resolveDetectedLanguage } from '../data/languages';
import { translations, landingPageTranslations } from '../translations';

const CACHE_STORAGE_KEY = 'telepulse_site_i18n_v1';
const MAX_CACHED_PER_LANG = 1200;

interface TextEntry {
  source: string;
  lastWritten: string | null;
}

const originalTextMap = new WeakMap<Text, TextEntry>();
const originalAttrMap = new WeakMap<Element, Map<string, TextEntry>>();
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'] as const;

// In-memory translation cache: langCode -> Map<sourceEnglishText, translatedText>
const memoryCache = new Map<string, Map<string, string>>();
let seededStaticDictionaries = false;

function getLangCache(langCode: string): Map<string, string> {
  let map = memoryCache.get(langCode);
  if (!map) {
    map = new Map<string, string>();
    try {
      const raw = localStorage.getItem(`${CACHE_STORAGE_KEY}_${langCode}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim()) {
            map.set(k, v);
          }
        }
      }
    } catch {}
    memoryCache.set(langCode, map);
  }
  return map;
}

function persistLangCache(langCode: string): void {
  const map = memoryCache.get(langCode);
  if (!map) return;
  try {
    const entries = Array.from(map.entries()).slice(-MAX_CACHED_PER_LANG);
    localStorage.setItem(`${CACHE_STORAGE_KEY}_${langCode}`, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

function ensureStaticSeed(): void {
  if (seededStaticDictionaries) return;
  seededStaticDictionaries = true;

  // Seed Bengali & Chinese instant phrases from existing translation tables
  const bnCache = getLangCache('bn');
  const zhCnCache = getLangCache('zh-CN');
  const zhTwCache = getLangCache('zh-TW');

  const enUi = translations.en as unknown as Record<string, string>;
  const bnUi = translations.bn as unknown as Record<string, string>;
  const zhUi = translations.zh as unknown as Record<string, string>;
  for (const key of Object.keys(enUi)) {
    const src = enUi[key];
    if (src && bnUi[key] && !bnCache.has(src)) bnCache.set(src, bnUi[key]);
    if (src && zhUi[key] && !zhCnCache.has(src)) zhCnCache.set(src, zhUi[key]);
    if (src && zhUi[key] && !zhTwCache.has(src)) zhTwCache.set(src, zhUi[key]);
  }

  const enLp = landingPageTranslations.en as unknown as Record<string, string>;
  const bnLp = landingPageTranslations.bn as unknown as Record<string, string>;
  const zhLp = landingPageTranslations.zh as unknown as Record<string, string>;
  for (const key of Object.keys(enLp)) {
    const src = enLp[key];
    if (src && bnLp[key] && !bnCache.has(src)) bnCache.set(src, bnLp[key]);
    if (src && zhLp[key] && !zhCnCache.has(src)) zhCnCache.set(src, zhLp[key]);
    if (src && zhLp[key] && !zhTwCache.has(src)) zhTwCache.set(src, zhLp[key]);
  }
}

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (el.closest('[data-no-translate="true"], [translate="no"], .notranslate')) return true;
  const tag = el.tagName;
  if (
    tag === 'SCRIPT' ||
    tag === 'STYLE' ||
    tag === 'NOSCRIPT' ||
    tag === 'CODE' ||
    tag === 'PRE' ||
    tag === 'SVG' ||
    tag === 'TEXTAREA'
  ) {
    return true;
  }
  return false;
}

function isTranslatableText(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 2) return false;
  // Skip pure numbers, symbols, punctuation, timestamps, currency, URLs, emails, @handles, phone numbers
  if (/^[\d\s.,:%+\-*/()[\]{}|•·→←⇄&/\\#$@!?_~`'"=<>]+$/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed)) return false;
  if (/^@[a-zA-Z0-9_]{2,}$/.test(trimmed)) return false;
  if (/^\+?\d[\d\s\-()]{5,}$/.test(trimmed)) return false;
  // Skip technical identifiers like usr_admin, c_01, EN
  if (/^[a-z0-9_.-]+_[a-z0-9_.-]+$/i.test(trimmed)) return false;
  // Must contain at least one letter
  if (!/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u0980-\u09FF\u4E00-\u9FFF]/.test(trimmed)) {
    return false;
  }
  return true;
}

function preserveEdgeWhitespace(original: string, translatedCore: string): string {
  const leading = original.match(/^\s*/)?.[0] || '';
  const trailing = original.match(/\s*$/)?.[0] || '';
  return `${leading}${translatedCore}${trailing}`;
}

async function fetchGoogleBatchDirect(texts: string[], targetLang: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (texts.length === 0) return result;

  // Group into safe batches of up to 8 short strings joined by newline when none contain newlines
  const batches: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const t of texts) {
    const clean = t.replace(/\r?\n+/g, ' ').trim();
    if (!clean) continue;
    if (current.length >= 8 || currentLen + clean.length > 750) {
      if (current.length) batches.push(current);
      current = [t];
      currentLen = clean.length;
    } else {
      current.push(t);
      currentLen += clean.length + 2;
    }
  }
  if (current.length) batches.push(current);

  const translateSingle = async (text: string): Promise<void> => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&q=${encodeURIComponent(text)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((seg: unknown) => (Array.isArray(seg) ? seg[0] || '' : '')).join('').trim();
        if (translated) {
          result.set(text, translated);
        }
      }
    } catch {}
  };

  // Process up to 4 batches concurrently
  const CONCURRENCY = 4;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (batch) => {
        if (batch.length === 1) {
          await translateSingle(batch[0]);
          return;
        }
        const cleaned = batch.map((s) => s.replace(/\r?\n+/g, ' ').trim());
        const joined = cleaned.join('\n');
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(
            targetLang
          )}&dt=t&q=${encodeURIComponent(joined)}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (Array.isArray(data) && Array.isArray(data[0])) {
            const full = data[0].map((seg: unknown) => (Array.isArray(seg) ? seg[0] || '' : '')).join('');
            const lines = full.split('\n').map((l: string) => l.trim());
            if (lines.length === batch.length) {
              batch.forEach((orig, idx) => {
                if (lines[idx]) result.set(orig, lines[idx]);
              });
              return;
            }
          }
          // Line count mismatch: translate individually
          await Promise.all(batch.map((orig) => translateSingle(orig)));
        } catch {
          // Will fall back to backend proxy if direct client request failed
        }
      })
    );
  }

  return result;
}

async function fetchBackendBatch(texts: string[], targetLang: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (texts.length === 0) return result;

  const CHUNK_SIZE = 20;
  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('/api/translate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang, sourceLang: 'en', texts: chunk }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.translations && typeof data.translations === 'object') {
        for (const [k, v] of Object.entries(data.translations)) {
          if (typeof v === 'string' && v.trim()) {
            result.set(k, v.trim());
          }
        }
      }
    } catch {}
  }

  return result;
}

let activeTargetCode = 'en';
let activeObserver: MutationObserver | null = null;
let flushTimer: number | null = null;
let statusCallback: ((status: { translating: boolean; resolvedCode: string }) => void) | null = null;
let translationRunId = 0;
let isApplyingDomWrites = false;

function captureAndCollect(): {
  textTargets: Array<{ node: Text; core: string; raw: string }>;
  attrTargets: Array<{ el: Element; attr: string; core: string; raw: string }>;
} {
  const textTargets: Array<{ node: Text; core: string; raw: string }> = [];
  const attrTargets: Array<{ el: Element; attr: string; core: string; raw: string }> = [];

  const root = document.getElementById('root') || document.body;
  if (!root) return { textTargets, attrTargets };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode() as Text | null;
  while (current) {
    const val = current.nodeValue || '';
    let entry = originalTextMap.get(current);
    if (!entry) {
      entry = { source: val, lastWritten: null };
      originalTextMap.set(current, entry);
    } else if (entry.lastWritten !== null && val !== entry.lastWritten) {
      // React updated the text content dynamically
      entry.source = val;
      entry.lastWritten = null;
    } else if (entry.lastWritten === null) {
      entry.source = val;
    }

    const core = entry.source.trim();
    if (isTranslatableText(core)) {
      textTargets.push({ node: current, core, raw: entry.source });
    }
    current = walker.nextNode() as Text | null;
  }

  const elements = root.querySelectorAll('input[placeholder], textarea[placeholder], [title], [aria-label]');
  elements.forEach((el) => {
    if (shouldSkipElement(el)) return;
    let attrMap = originalAttrMap.get(el);
    if (!attrMap) {
      attrMap = new Map<string, TextEntry>();
      originalAttrMap.set(el, attrMap);
    }
    for (const attr of TRANSLATABLE_ATTRS) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      let entry = attrMap.get(attr);
      if (!entry) {
        entry = { source: val, lastWritten: null };
        attrMap.set(attr, entry);
      } else if (entry.lastWritten !== null && val !== entry.lastWritten) {
        entry.source = val;
        entry.lastWritten = null;
      } else if (entry.lastWritten === null) {
        entry.source = val;
      }
      const core = entry.source.trim();
      if (isTranslatableText(core)) {
        attrTargets.push({ el, attr, core, raw: entry.source });
      }
    }
  });

  return { textTargets, attrTargets };
}

export function restoreOriginalEnglish(): void {
  const root = document.getElementById('root') || document.body;
  if (!root) return;

  isApplyingDomWrites = true;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode() as Text | null;
    while (current) {
      const entry = originalTextMap.get(current);
      if (entry && entry.lastWritten !== null && current.nodeValue === entry.lastWritten) {
        current.nodeValue = entry.source;
        entry.lastWritten = null;
      }
      current = walker.nextNode() as Text | null;
    }

    const elements = root.querySelectorAll('input[placeholder], textarea[placeholder], [title], [aria-label]');
    elements.forEach((el) => {
      const attrMap = originalAttrMap.get(el);
      if (!attrMap) return;
      for (const attr of TRANSLATABLE_ATTRS) {
        const entry = attrMap.get(attr);
        if (entry && entry.lastWritten !== null && el.getAttribute(attr) === entry.lastWritten) {
          el.setAttribute(attr, entry.source);
          entry.lastWritten = null;
        }
      }
    });
  } finally {
    isApplyingDomWrites = false;
  }

  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
}

async function translateCurrentDom(targetCode: string, runId: number): Promise<void> {
  if (targetCode === 'en') {
    restoreOriginalEnglish();
    statusCallback?.({ translating: false, resolvedCode: 'en' });
    return;
  }

  ensureStaticSeed();
  const cache = getLangCache(targetCode);
  const { textTargets, attrTargets } = captureAndCollect();

  // Apply already-cached translations immediately
  const missingSet = new Set<string>();
  isApplyingDomWrites = true;
  try {
    for (const item of textTargets) {
      const cached = cache.get(item.core);
      if (cached) {
        const formatted = preserveEdgeWhitespace(item.raw, cached);
        if (item.node.nodeValue !== formatted) {
          item.node.nodeValue = formatted;
        }
        const entry = originalTextMap.get(item.node);
        if (entry) entry.lastWritten = formatted;
      } else {
        missingSet.add(item.core);
      }
    }

    for (const item of attrTargets) {
      const cached = cache.get(item.core);
      if (cached) {
        if (item.el.getAttribute(item.attr) !== cached) {
          item.el.setAttribute(item.attr, cached);
        }
        const attrEntry = originalAttrMap.get(item.el)?.get(item.attr);
        if (attrEntry) attrEntry.lastWritten = cached;
      } else {
        missingSet.add(item.core);
      }
    }
  } finally {
    isApplyingDomWrites = false;
  }

  const missingList = Array.from(missingSet);
  if (missingList.length === 0) {
    statusCallback?.({ translating: false, resolvedCode: targetCode });
    return;
  }

  statusCallback?.({ translating: true, resolvedCode: targetCode });

  // 1. Client-first Google Translate batch
  const directResults = await fetchGoogleBatchDirect(missingList, targetCode);
  if (runId !== translationRunId) return;

  for (const [k, v] of directResults.entries()) {
    cache.set(k, v);
  }

  // 2. Fallback to backend /api/translate-batch for any strings Google direct missed
  const stillMissing = missingList.filter((s) => !cache.has(s));
  if (stillMissing.length > 0) {
    const backendResults = await fetchBackendBatch(stillMissing, targetCode);
    if (runId !== translationRunId) return;
    for (const [k, v] of backendResults.entries()) {
      cache.set(k, v);
    }
  }

  persistLangCache(targetCode);

  if (runId !== translationRunId) return;

  // Apply freshly fetched translations to DOM
  const latest = captureAndCollect();
  isApplyingDomWrites = true;
  try {
    for (const item of latest.textTargets) {
      const translated = cache.get(item.core);
      if (translated) {
        const formatted = preserveEdgeWhitespace(item.raw, translated);
        if (item.node.nodeValue !== formatted) {
          item.node.nodeValue = formatted;
        }
        const entry = originalTextMap.get(item.node);
        if (entry) entry.lastWritten = formatted;
      }
    }
    for (const item of latest.attrTargets) {
      const translated = cache.get(item.core);
      if (translated) {
        if (item.el.getAttribute(item.attr) !== translated) {
          item.el.setAttribute(item.attr, translated);
        }
        const attrEntry = originalAttrMap.get(item.el)?.get(item.attr);
        if (attrEntry) attrEntry.lastWritten = translated;
      }
    }
  } finally {
    isApplyingDomWrites = false;
  }

  statusCallback?.({ translating: false, resolvedCode: targetCode });
}

function scheduleDomTranslation(): void {
  if (activeTargetCode === 'en') return;
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
  }
  const currentRun = translationRunId;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    if (activeTargetCode !== 'en') {
      translateCurrentDom(activeTargetCode, currentRun).catch(() => {
        statusCallback?.({ translating: false, resolvedCode: activeTargetCode });
      });
    }
  }, 80);
}

function ensureObserver(): void {
  if (activeObserver) return;
  const root = document.getElementById('root') || document.body;
  if (!root) return;

  activeObserver = new MutationObserver((mutations) => {
    if (isApplyingDomWrites || activeTargetCode === 'en') return;
    let needsScan = false;
    for (const m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        needsScan = true;
        break;
      }
      if (m.type === 'characterData') {
        const t = m.target as Text;
        const entry = originalTextMap.get(t);
        if (!entry || (entry.lastWritten !== null && t.nodeValue !== entry.lastWritten)) {
          needsScan = true;
          break;
        }
      }
    }
    if (needsScan) {
      scheduleDomTranslation();
    }
  });

  activeObserver.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

export function stopSiteTranslator(): void {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
}

export function applySiteLanguage(
  requestedCode: string,
  onStatusChange?: (status: { translating: boolean; resolvedCode: string }) => void
): string {
  statusCallback = onStatusChange || null;
  const resolvedLang =
    requestedCode === 'auto' ? resolveDetectedLanguage() : getLanguageByCode(requestedCode);
  const resolvedCode = resolvedLang.code;

  translationRunId += 1;
  const runId = translationRunId;
  activeTargetCode = resolvedCode;

  if (resolvedCode === 'en') {
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    restoreOriginalEnglish();
    statusCallback?.({ translating: false, resolvedCode: 'en' });
    return 'en';
  }

  document.documentElement.lang = resolvedCode;
  document.documentElement.dir = resolvedLang.rtl ? 'rtl' : 'ltr';

  ensureObserver();
  translateCurrentDom(resolvedCode, runId).catch(() => {
    statusCallback?.({ translating: false, resolvedCode });
  });

  return resolvedCode;
}
