import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Globe2,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  POPULAR_LANGUAGE_CODES,
  WEBSITE_LANGUAGES,
  WebsiteLanguage,
  getLanguageByCode,
  resolveDetectedLanguage,
} from '../data/languages';

interface LanguageSelectorProps {
  selectedCode: string;
  onSelectLanguage: (code: string) => void;
  isTranslating?: boolean;
  variant?: 'header' | 'dark';
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedCode,
  onSelectLanguage,
  isTranslating = false,
  variant = 'header',
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeLang = useMemo(() => getLanguageByCode(selectedCode), [selectedCode]);
  const detectedLang = useMemo(() => resolveDetectedLanguage(), []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 40);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const filteredLanguages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WEBSITE_LANGUAGES;
    return WEBSITE_LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        (lang.nativeName && lang.nativeName.toLowerCase().includes(q)) ||
        lang.code.toLowerCase().includes(q)
    );
  }, [query]);

  const popularLanguages = useMemo(
    () =>
      POPULAR_LANGUAGE_CODES.map((code) => WEBSITE_LANGUAGES.find((l) => l.code === code)).filter(
        (l): l is WebsiteLanguage => Boolean(l)
      ),
    []
  );

  const handleChoose = (code: string) => {
    onSelectLanguage(code);
    setOpen(false);
    setQuery('');
  };

  const buttonLabel =
    selectedCode === 'auto'
      ? `Auto (${detectedLang.code.toUpperCase()})`
      : compact
      ? activeLang.code.toUpperCase()
      : activeLang.name;

  const isDarkVariant = variant === 'dark';

  return (
    <div ref={containerRef} className="relative" data-no-translate="true" translate="no">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Website Language: ${activeLang.name} — Click to translate into 249+ languages`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
          isDarkVariant
            ? 'border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200'
            : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
        }`}
      >
        {isTranslating ? (
          <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0" />
        ) : (
          <Globe2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
        )}
        <span className="max-w-[120px] truncate">{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose website language"
          className="fixed inset-x-3 top-16 sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[540px] md:w-[660px] max-h-[82vh] flex flex-col rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 shadow-2xl z-[100] overflow-hidden"
        >
          {/* Modal / Popover Header */}
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 bg-neutral-50/90 dark:bg-neutral-900/90">
            <div className="flex items-center gap-2 min-w-0">
              <Globe2 className="w-4 h-4 text-sky-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                  Translate Website ({WEBSITE_LANGUAGES.length - 1} Languages)
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  Active:{' '}
                  <span className="font-medium text-sky-600 dark:text-sky-400">
                    {selectedCode === 'auto'
                      ? `Detect language (${detectedLang.name})`
                      : activeLang.name}
                  </span>
                  {isTranslating ? ' · Translating...' : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedCode !== 'en' && (
                <button
                  type="button"
                  onClick={() => handleChoose('en')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>English</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close language selector"
                className="p-1 rounded-md text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2.5 bg-white dark:bg-neutral-950">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any language (e.g., Bengali, Spanish, Arabic, Japanese, Zulu)..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Select Bar when search is empty */}
            {!query.trim() && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {popularLanguages.map((lang) => {
                  const isActive = selectedCode === lang.code;
                  return (
                    <button
                      key={`quick_${lang.code}`}
                      type="button"
                      onClick={() => handleChoose(lang.code)}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors ${
                        isActive
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {lang.isAuto && <Sparkles className="w-3 h-3 text-sky-500" />}
                      <span>{lang.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* All Languages Grid */}
          <div className="overflow-y-auto p-3 flex-1">
            {filteredLanguages.length === 0 ? (
              <div className="py-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No matching language found for "{query}".
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
                {filteredLanguages.map((lang) => {
                  const isSelected = selectedCode === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleChoose(lang.code)}
                      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {lang.isAuto ? (
                          <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : isSelected ? (
                          <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate">{lang.name}</div>
                          {lang.nativeName && lang.nativeName !== lang.name && (
                            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                              {lang.nativeName}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase shrink-0">
                        {lang.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
