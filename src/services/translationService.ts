/**
 * Multi-language Google Translate integration service for TelePulse Enterprise CRM.
 * Translates chat messages into Bengali, English, and all 249 supported languages
 * with client-side Google Translate API, server-side MyMemory proxy fallback, and dictionary fallback.
 */

const BN_TO_EN_DICTIONARY: Record<string, string> = {
  'ধন্যবাদ': 'Thank you',
  'অনেক ধন্যবাদ': 'Thank you very much',
  'হ্যালো': 'Hello',
  'হাই': 'Hi',
  'আসসালামু আলাইকুম': 'Peace be upon you (Assalamu Alaikum)',
  'নমস্কার': 'Greetings (Namaskar)',
  'কেমন আছেন?': 'How are you?',
  'কেমন আছেন': 'How are you',
  'আমি ভালো আছি': 'I am fine',
  'আমাদের ক্যাম্পেইন কবে শুরু হবে?': 'When will our campaign start?',
  'ক্যাম্পেইন শুরু হয়েছে': 'The campaign has started',
  'এসএমএস ডেলিভারি রিপোর্ট দেখতে চাই': 'I want to see the SMS delivery report',
  'কত টাকা লাগবে?': 'How much will it cost?',
  'মূল্য তালিকা দিন': 'Please provide the pricing quotation',
  'আমাদের ১০০,০০০ এসএমএস পাঠাতে হবে': 'We need to send 100,000 SMS messages',
  'টেলিগ্রাম চ্যানেল লিঙ্ক কি?': 'What is the Telegram channel link?',
  'আমরা পেমেন্ট সম্পন্ন করেছি': 'We have completed the payment',
  'ইনভয়েস পাঠাবেন প্লিজ': 'Please send the invoice',
  'ওয়ার্ডপ্রেস প্লাগইন সেটআপ সাহায্য লাগবে': 'Need help with WordPress plugin setup',
  'কল ব্যাক করুন': 'Please call back',
  'দেরি হওয়ার জন্য দুঃখিত': 'Sorry for the delay',
  'আমাদের পোর্ট ২০০ গেটওয়ে সচল আছে': 'Our Port 200 gateway is active',
  'আমরা খুব শীঘ্রই আপনার সাথে যোগাযোগ করব': 'We will contact you very shortly',
  'সব বার্তা সফলভাবে পৌঁছেছে': 'All messages were delivered successfully',
  'অর্ডার নিশ্চিত করা হয়েছে': 'Order has been confirmed',
  'দয়া করে একটু অপেক্ষা করুন': 'Please wait a moment',
};

const EN_TO_BN_DICTIONARY: Record<string, string> = {
  'thank you': 'ধন্যবাদ',
  'thank you very much': 'আপনাকে অনেক ধন্যবাদ',
  'hello': 'হ্যালো',
  'hi': 'হাই',
  'how are you?': 'আপনি কেমন আছেন?',
  'how are you': 'আপনি কেমন আছেন?',
  'i am fine': 'আমি ভালো আছি',
  'when will our campaign start?': 'আমাদের ক্যাম্পেইন কবে শুরু হবে?',
  'the campaign has started': 'ক্যাম্পেইন শুরু হয়েছে',
  'i want to see the sms delivery report': 'আমি এসএমএস ডেলিভারি রিপোর্ট দেখতে চাই',
  'how much will it cost?': 'কত খরচ পড়বে?',
  'please provide the pricing quotation': 'অনুগ্রহ করে মূল্য তালিকা দিন',
  'we need to send 100,000 sms messages': 'আমাদের ১০০,০০০ এসএমএস বার্তা পাঠাতে হবে',
  'what is the telegram channel link?': 'টেলিগ্রাম চ্যানেল লিঙ্ক কী?',
  'we have completed the payment': 'আমরা পেমেন্ট সম্পন্ন করেছি',
  'please send the invoice': 'অনুগ্রহ করে ইনভয়েস পাঠান',
  'need help with wordpress plugin setup': 'ওয়ার্ডপ্রেস প্লাগইন সেটআপে সহায়তা দরকার',
  'please call back': 'দয়া করে কল ব্যাক করুন',
  'sorry for the delay': 'দেরির জন্য দুঃখিত',
  'our port 200 gateway is active': 'আমাদের পোর্ট ২০০ গেটওয়ে সক্রিয় আছে',
  'we will contact you very shortly': 'আমরা খুব দ্রুত আপনার সাথে যোগাযোগ করব',
  'all messages were delivered successfully': 'সব মেসেজ সফলভাবে পৌঁছেছে',
  'order has been confirmed': 'অর্ডারটি নিশ্চিত করা হয়েছে',
  'please wait a moment': 'অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন',
};

const WORD_MAP_EN_BN: Record<string, string> = {
  hello: 'হ্যালো',
  hi: 'হাই',
  thanks: 'ধন্যবাদ',
  thank: 'ধন্যবাদ',
  you: 'আপনাকে',
  we: 'আমরা',
  our: 'আমাদের',
  team: 'টিম',
  support: 'সাপোর্ট',
  sms: 'এসএমএস',
  telegram: 'টেলিগ্রাম',
  campaign: 'ক্যাম্পেইন',
  message: 'মেসেজ',
  messages: 'মেসেজগুলো',
  delivery: 'ডেলিভারি',
  price: 'মূল্য',
  cost: 'খরচ',
  quote: 'কোটেশন',
  report: 'রিপোর্ট',
  invoice: 'চালান/ইনভয়েস',
  contact: 'যোগাযোগ',
  lead: 'লিড',
  leads: 'লিডস',
  gateway: 'গেটওয়ে',
  active: 'সক্রিয়',
  sent: 'প্রেরিত',
  success: 'সফল',
  failed: 'ব্যর্থ',
  demo: 'ডেমো',
  meeting: 'মিটিং',
  call: 'কল',
  yes: 'হ্যাঁ',
  no: 'না',
  ok: 'ঠিক আছে',
  tomorrow: 'আগামীকাল',
  today: 'আজ',
  soon: 'শীঘ্রই',
  rate: 'হার',
  help: 'সাহায্য',
  welcome: 'স্বাগতম',
  please: 'দয়া করে',
};

const WORD_MAP_BN_EN: Record<string, string> = {
  হ্যালো: 'Hello',
  হাই: 'Hi',
  ধন্যবাদ: 'Thank you',
  আপনাকে: 'you',
  আমরা: 'we',
  আমাদের: 'our',
  টিম: 'team',
  সাপোর্ট: 'support',
  এসএমএস: 'SMS',
  টেলিগ্রাম: 'Telegram',
  ক্যাম্পেইন: 'campaign',
  মেসেজ: 'message',
  ডেলিভারি: 'delivery',
  মূল্য: 'price',
  খরচ: 'cost',
  রিপোর্ট: 'report',
  ইনভয়েস: 'invoice',
  যোগাযোগ: 'contact',
  সক্রিয়: 'active',
  সফল: 'successful',
  ব্যর্থ: 'failed',
  ডেমো: 'demo',
  কল: 'call',
  হ্যাঁ: 'yes',
  না: 'no',
  শীঘ্রই: 'soon',
  সাহায্য: 'help',
  স্বাগতম: 'welcome',
};

const chatTranslationCache = new Map<string, GoogleTranslateResult>();

/**
 * Detect primary script/language of a chat message
 */
export function detectLanguage(text: string): string {
  if (!text) return 'en';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
  return 'en';
}

export interface GoogleTranslateResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  isFallback?: boolean;
}

/**
 * Translates chat text into any target language code (bn, en, es, ar, hi, etc.)
 * using instant cache -> direct Google Translate -> server /api/translate-batch fallback -> offline dictionary.
 */
export async function translateWithGoogle(
  text: string,
  targetLang: string = 'en',
  sourceLang: string = 'auto'
): Promise<GoogleTranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { translatedText: '', sourceLang: 'en', targetLang };
  }

  const detectedSource = sourceLang === 'auto' ? detectLanguage(trimmed) : sourceLang;
  const resolvedTarget = targetLang === 'auto' ? (detectedSource === 'bn' ? 'en' : 'bn') : targetLang;

  const cacheKey = `${resolvedTarget}::${trimmed}`;
  const cached = chatTranslationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Exact BN <-> EN dictionary instant match
  const lower = trimmed.toLowerCase();
  if (resolvedTarget === 'en' && BN_TO_EN_DICTIONARY[trimmed]) {
    const res = { translatedText: BN_TO_EN_DICTIONARY[trimmed], sourceLang: 'bn', targetLang: 'en' };
    chatTranslationCache.set(cacheKey, res);
    return res;
  }
  if (resolvedTarget === 'bn' && EN_TO_BN_DICTIONARY[lower]) {
    const res = { translatedText: EN_TO_BN_DICTIONARY[lower], sourceLang: 'en', targetLang: 'bn' };
    chatTranslationCache.set(cacheKey, res);
    return res;
  }

  // 1. Direct Client Google Translate API (supports all 249 languages)
  try {
    const sl = sourceLang === 'auto' ? 'auto' : detectedSource;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sl
    )}&tl=${encodeURIComponent(resolvedTarget)}&dt=t&q=${encodeURIComponent(trimmed)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const fullTranslation = data[0]
          .map((item: unknown) => (Array.isArray(item) ? item[0] || '' : ''))
          .join('')
          .trim();
        if (fullTranslation) {
          const result: GoogleTranslateResult = {
            translatedText: fullTranslation,
            sourceLang: (typeof data[2] === 'string' && data[2]) || detectedSource,
            targetLang: resolvedTarget,
          };
          chatTranslationCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch {
    // Fall through to backend proxy
  }

  // 2. Backend /api/translate-batch fallback (MyMemory + server cache)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch('/api/translate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetLang: resolvedTarget,
        sourceLang: 'auto',
        texts: [trimmed],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const translated = data?.translations?.[trimmed];
      if (typeof translated === 'string' && translated.trim()) {
        const result: GoogleTranslateResult = {
          translatedText: translated.trim(),
          sourceLang: detectedSource,
          targetLang: resolvedTarget,
        };
        chatTranslationCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Fall through to offline fallback
  }

  // 3. Offline BN <-> EN token fallback
  if (resolvedTarget === 'bn') {
    const words = trimmed.split(/(\s+|[,.?!;:])/);
    const translatedWords = words.map((w) => {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      return WORD_MAP_EN_BN[clean] || w;
    });
    return {
      translatedText: translatedWords.join(''),
      sourceLang: detectedSource,
      targetLang: 'bn',
      isFallback: true,
    };
  }

  if (resolvedTarget === 'en') {
    const words = trimmed.split(/(\s+|[,.?!;:|])/);
    const translatedWords = words.map((w) => {
      const clean = w.trim();
      return WORD_MAP_BN_EN[clean] || w;
    });
    return {
      translatedText: translatedWords.join(''),
      sourceLang: detectedSource,
      targetLang: 'en',
      isFallback: true,
    };
  }

  return {
    translatedText: trimmed,
    sourceLang: detectedSource,
    targetLang: resolvedTarget,
    isFallback: true,
  };
}
