import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Languages, Search, X } from 'lucide-react';
import { WEBSITE_LANGUAGES } from '../data/languages';

const CHAT_QUICK_LANGS = ['bn', 'en', 'hi', 'ar', 'es', 'fr', 'ru', 'zh-CN', 'ja', 'de'];

interface ChatLanguagePickerProps {
  activeCode?: string;
  onSelect: (langCode: string) => void;
  onClose: () => void;
  align?: 'left' | 'right';
  openUpward?: boolean;
  title?: string;
  showOriginalOption?: boolean;
  onSelectOriginal?: () => void;
}

export const ChatLanguagePicker: React.FC<ChatLanguagePickerProps> = ({
  activeCode,
  onSelect,
  onClose,
  align = 'left',
  openUpward = false,
  title = 'Translate to Language',
  showOriginalOption = false,
  onSelectOriginal,
}) => {
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectableLanguages = useMemo(
    () => WEBSITE_LANGUAGES.filter((l) => !l.isAuto),
    []
  );

  const quickLanguages = useMemo(
    () =>
      CHAT_QUICK_LANGS.map((code) => selectableLanguages.find((l) => l.code === code)).filter(
        (l): l is NonNullable<typeof l> => Boolean(l)
      ),
    [selectableLanguages]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectableLanguages;
    return selectableLanguages.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.nativeName && l.nativeName.toLowerCase().includes(q)) ||
        l.code.toLowerCase().includes(q)
    );
  }, [query, selectableLanguages]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      data-no-translate="true"
      translate="no"
      className={`absolute ${
        openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
      } ${
        align === 'right' ? 'right-0' : 'left-0'
      } w-72 sm:w-80 rounded-xl border border-neutral-200 dark:border-[#2B394A] bg-white dark:bg-[#17212B] text-neutral-900 dark:text-neutral-100 shadow-2xl z-40 overflow-hidden`}
    >
      <div className="px-3 py-2 border-b border-neutral-100 dark:border-[#0E1621] flex items-center justify-between gap-2 bg-neutral-50/80 dark:bg-[#1E2C3A]">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <Languages className="w-3.5 h-3.5 text-[#3390EC]" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {showOriginalOption && onSelectOriginal && (
            <button
              type="button"
              onClick={() => {
                onSelectOriginal();
                onClose();
              }}
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-200/80 dark:bg-[#242F3D] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-[#2B394A]"
            >
              Original
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-2 border-b border-neutral-100 dark:border-[#0E1621] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Bengali, English, Arabic, Spanish..."
            className="w-full pl-8 pr-6 py-1.5 text-[11px] rounded-lg border border-neutral-200 dark:border-[#2B394A] bg-neutral-50 dark:bg-[#0E1621] text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#3390EC]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {!query.trim() && (
          <div className="flex flex-wrap gap-1">
            {quickLanguages.map((lang) => (
              <button
                key={`q_${lang.code}`}
                type="button"
                onClick={() => {
                  onSelect(lang.code);
                  onClose();
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                  activeCode === lang.code
                    ? 'border-[#3390EC] bg-[#3390EC]/15 text-[#3390EC] font-semibold'
                    : 'border-neutral-200 dark:border-[#2B394A] bg-neutral-50 dark:bg-[#0E1621] text-neutral-700 dark:text-neutral-300 hover:border-[#3390EC]/50'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-neutral-400">
            No language matching "{query}".
          </div>
        ) : (
          filtered.map((lang) => {
            const isSelected = activeCode === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onSelect(lang.code);
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] transition-colors ${
                  isSelected
                    ? 'bg-[#3390EC]/15 text-[#3390EC] font-semibold'
                    : 'hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-700 dark:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isSelected ? (
                    <Check className="w-3 h-3 text-[#3390EC] shrink-0" />
                  ) : (
                    <span className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{lang.name}</span>
                  {lang.nativeName && lang.nativeName !== lang.name && (
                    <span className="text-[10px] text-neutral-400 truncate">
                      ({lang.nativeName})
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-mono uppercase text-neutral-400 shrink-0">
                  {lang.code}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
