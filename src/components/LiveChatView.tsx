import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Search,
  Bot,
  Volume2,
  VolumeX,
  Languages,
  Check,
  CheckCheck,
  RefreshCw,
  UserCheck,
  ShieldAlert,
  Smile,
  Paperclip,
  Mic,
  Reply,
  Pin,
  Copy,
  MoreVertical,
  PanelRight,
  Image as ImageIcon,
  FileText,
  X,
  Bold,
  Italic,
  Code,
  Play,
  Pause,
  Slash,
  Globe2,
  Package,
  Trash2,
  ZoomIn,
  ZoomOut,
  Download,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Archive,
  ArchiveRestore,
  Mail,
  ArrowUpDown,
  GripHorizontal,
  GripVertical,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import {
  Contact,
  ChatMessage,
  UserAccount,
  UserbotSession,
  ModeratorRoutingConfig,
  ModeratorRoutingMode,
} from '../types';
import { SupportedLanguage } from '../translations';
import { translateWithGoogle, detectLanguage } from '../services/translationService';
import { getLanguageByCode } from '../data/languages';
import { ChatLanguagePicker } from './ChatLanguagePicker';

interface LiveChatViewProps {
  contacts: Contact[];
  chats: Record<string, ChatMessage[]>;
  currentUser: UserAccount;
  allUsers: UserAccount[];
  userbotSessions: UserbotSession[];
  lang: SupportedLanguage;
  onSendMessage: (
    contactId: string,
    text: string,
    options?: {
      replyTo?: ChatMessage['replyTo'];
      attachment?: ChatMessage['attachment'];
      originalText?: string;
      translatedLang?: string;
    }
  ) => void;
  onSimulateCustomerReply: (contactId: string, text: string) => void;
  onAssignModerator: (contactId: string, moderatorId: string) => void;
  moderatorRouting?: ModeratorRoutingConfig;
  onUpdateModeratorRouting?: (updates: Partial<ModeratorRoutingConfig>) => void;
  onRouteContactsToModerator?: (moderatorId: string, scope: 'all' | 'unassigned' | string[]) => number | void;
  onDistributeRoundRobin?: (scope: 'all' | 'unassigned') => number | void;
  onReactMessage?: (contactId: string, messageId: string, emoji: string) => void;
  onTogglePinMessage?: (contactId: string, messageId: string) => void;
  onUpdateMessageStatus?: (contactId: string, messageId: string, status: ChatMessage['status']) => void;
  onMarkThreadRead?: (contactId: string) => void;
  onMarkIncomingRead?: (contactId: string) => void;
  onMarkIncomingUnread?: (contactId: string) => void;
  onToggleArchiveThread?: (contactId: string, archive: boolean) => void;
  onArchiveInactiveThreads?: (contactIds: string[]) => void;
  selectedContactId?: string;
  onSelectContact?: (id: string) => void;
  onLogout?: () => void;
}

const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    label: 'Recent',
    emojis: ['👍', '❤️', '🙏', '😊', '🔥', '🎉', '✅', '🚀', '💬', '📦', '✨', '🤝'],
  },
  {
    id: 'smileys',
    label: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎',
      '🥳', '😏', '😌', '😔', '😪', '😴', '🤔', '🫡', '🤗', '🤭', '🤫', '😬',
    ],
  },
  {
    id: 'gestures',
    label: 'Gestures & Hearts',
    emojis: [
      '👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🤚', '🖐️',
      '👏', '🙌', '🫶', '🤝', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜',
      '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
    ],
  },
  {
    id: 'commerce',
    label: 'Business & CRM',
    emojis: [
      '📦', '🚚', '🛒', '🛍️', '💳', '💵', '💰', '🧾', '📊', '📈', '📉', '💼',
      '📱', '💻', '☎️', '📧', '📩', '📨', '🔔', '🔕', '🔒', '🔓', '🔑', '🏷️',
      '⚡', '🔥', '🚀', '✅', '☑️', '❌', '⚠️', 'ℹ️', '🕒', '📅', '📌', '🔗',
    ],
  },
];

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '🎉', '🙏'];

const EMOJI_KEYWORDS: Record<string, string> = {
  '👍': 'thumbs up ok good yes like',
  '👎': 'thumbs down bad no',
  '❤️': 'heart love red',
  '🔥': 'fire hot lit',
  '🎉': 'party celebrate congrats',
  '🙏': 'pray thanks please',
  '😊': 'smile happy',
  '😀': 'grin smile happy',
  '😂': 'laugh funny lol',
  '😍': 'love heart eyes',
  '✅': 'check done verified yes',
  '❌': 'cross no cancel stop',
  '🚀': 'rocket launch fast',
  '📦': 'box order package delivery',
  '🚚': 'truck shipping delivery',
  '💳': 'card pay payment',
  '💰': 'money cash dollar',
  '📌': 'pin',
  '⚡': 'flash fast lightning',
};

const AVATAR_TONES = [
  'bg-sky-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-indigo-600 text-white',
  'bg-rose-600 text-white',
  'bg-teal-600 text-white',
];

function getAvatarTone(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // Ignore autoplay restrictions
  }
}

function TypingDots({ dotClass = 'bg-current' }: { dotClass?: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span
        className={`w-1.5 h-1.5 rounded-full telegram-typing-dot ${dotClass}`}
        style={{ animationDelay: '0ms' }}
      />
      <span
        className={`w-1.5 h-1.5 rounded-full telegram-typing-dot ${dotClass}`}
        style={{ animationDelay: '160ms' }}
      />
      <span
        className={`w-1.5 h-1.5 rounded-full telegram-typing-dot ${dotClass}`}
        style={{ animationDelay: '320ms' }}
      />
    </span>
  );
}

function ReadReceiptIndicator({
  status,
  compact = false,
  isSelectedRow = false,
}: {
  status: ChatMessage['status'];
  isBn?: boolean;
  compact?: boolean;
  isSelectedRow?: boolean;
}) {
  const isRead = status === 'read';
  const sizeClass = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const colorClass = isRead
    ? isSelectedRow
      ? 'text-white'
      : 'text-[#3390EC] dark:text-sky-300'
    : isSelectedRow
      ? 'text-white/80'
      : 'text-neutral-500 dark:text-sky-100/75';
  const label = isRead ? 'Read' : 'Sent';

  return (
    <span
      data-status={status}
      aria-label={label}
      title={label}
      className={`inline-flex items-center transition-colors duration-200 ${colorClass}`}
    >
      {isRead ? <CheckCheck className={sizeClass} /> : <Check className={sizeClass} />}
    </span>
  );
}

function renderHighlightedMatch(text: string, query: string, isSelectedRow = false) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        className={`rounded-sm px-0.5 font-semibold ${
          isSelectedRow
            ? 'bg-white/25 text-white'
            : 'bg-[#3390EC]/15 text-[#1b6ec2] dark:bg-sky-400/25 dark:text-sky-200'
        }`}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function formatMessageTime(ts: string): string {
  const trimmed = (ts || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\b(\d{1,2}:\d{2})(?::\d{2})?\b/);
  if (match) return match[1];
  return trimmed.slice(0, 5);
}

function renderFormattedText(text: string) {
  // Parse **bold**, __italic__, `code`, and URLs safely without dangerouslySetInnerHTML
  const tokens = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|https?:\/\/[^\s]+)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
      return (
        <em key={idx} className="italic">
          {part.slice(2, -2)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-sky-400/70 hover:opacity-80 break-all"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const LiveChatView: React.FC<LiveChatViewProps> = ({
  contacts,
  chats,
  currentUser,
  allUsers,
  userbotSessions,
  onSendMessage,
  onSimulateCustomerReply,
  onAssignModerator,
  moderatorRouting,
  onUpdateModeratorRouting,
  onRouteContactsToModerator,
  onDistributeRoundRobin,
  onReactMessage,
  onTogglePinMessage,
  onUpdateMessageStatus,
  onMarkThreadRead,
  onMarkIncomingRead,
  onMarkIncomingUnread,
  onToggleArchiveThread,
  onArchiveInactiveThreads,
  selectedContactId: initialContactId,
  onSelectContact,
  onLogout,
}) => {
  const isModerator = currentUser.role === 'moderator';
  const isViewer = currentUser.role === 'viewer';
  const dedicatedModerators = allUsers.filter((u) => u.role === 'moderator');
  const moderators = allUsers.filter((u) => u.role === 'moderator' || u.role === 'admin');
  const [routingTargetModId, setRoutingTargetModId] = useState<string>(
    moderatorRouting?.defaultModeratorId || dedicatedModerators[0]?.id || moderators[0]?.id || ''
  );
  const [routingBannerToast, setRoutingBannerToast] = useState<string | null>(null);
  const [routingBarScale, setRoutingBarScale] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('telepulse_routing_bar_scale'));
      return saved >= 75 && saved <= 130 ? saved : 100;
    } catch {
      return 100;
    }
  });
  const [routingBarExtraPad, setRoutingBarExtraPad] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('telepulse_routing_bar_pad'));
      return saved >= 4 && saved <= 40 ? saved : 8;
    } catch {
      return 8;
    }
  });
  const [inboxPaneWidth, setInboxPaneWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('telepulse_inbox_pane_width'));
      return saved >= 260 && saved <= 560 ? saved : 360;
    } catch {
      return 360;
    }
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState<'routing' | 'inbox' | null>(null);
  const chatShellRef = useRef<HTMLDivElement>(null);

  const roleScopedContacts = isModerator
    ? contacts.filter((c) => c.assignedModeratorId === currentUser.id)
    : contacts;

  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'unassigned' | 'assigned' | 'opted_out'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [unreadFirst, setUnreadFirst] = useState(true);
  const [localArchivedMap, setLocalArchivedMap] = useState<Record<string, boolean>>({});
  const [manualUnreadMap, setManualUnreadMap] = useState<Record<string, boolean>>({});
  const [activeContactId, setActiveContactId] = useState<string>(
    initialContactId && roleScopedContacts.some((c) => c.id === initialContactId)
      ? initialContactId
      : roleScopedContacts[0]?.id || ''
  );
  const [chatSearch, setChatSearch] = useState('');
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatQuery, setInChatQuery] = useState('');
  const [chatInputText, setChatInputText] = useState('');
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);
  const [isUserbotTyping, setIsUserbotTyping] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Telegram Popovers & Drawers
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState('recent');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [emojiPanelTab, setEmojiPanelTab] = useState<'emoji' | 'templates'>('emoji');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [formatBarOpen, setFormatBarOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Reply, Attachment, Voice Recording & Copy feedback
  const [replyingTo, setReplyingTo] = useState<ChatMessage['replyTo'] | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<ChatMessage['attachment'] | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
    size?: string;
    senderName?: string;
    timestamp?: string;
    caption?: string;
    messageId?: string;
  } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewLoadError, setPreviewLoadError] = useState(false);

  // Google Translate state (supports Bengali, English, and all 249 languages)
  const [messageTranslations, setMessageTranslations] = useState<
    Record<string, { text: string; targetLang: string; loading?: boolean }>
  >({});
  const [preferredChatTranslateLang, setPreferredChatTranslateLang] = useState<string>(() => {
    try {
      return localStorage.getItem('telepulse_chat_translate_lang') || 'bn';
    } catch {
      return 'bn';
    }
  });
  const [chatBodyTranslateLang, setChatBodyTranslateLang] = useState<string | null>(null);
  const [headerTranslatePickerOpen, setHeaderTranslatePickerOpen] = useState(false);
  const [openBubbleLangPickerId, setOpenBubbleLangPickerId] = useState<string | null>(null);
  const [composerLangPickerOpen, setComposerLangPickerOpen] = useState(false);
  const [sendLangPickerOpen, setSendLangPickerOpen] = useState(false);
  const [isSendingTranslated, setIsSendingTranslated] = useState(false);
  const [perChatSendLang, setPerChatSendLang] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('telepulse_per_chat_send_lang');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [replyTranslating, setReplyTranslating] = useState(false);
  const [translatedReplyPreview, setTranslatedReplyPreview] = useState<{
    text: string;
    targetLang: string;
  } | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const userbotTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isContactArchived = (c: Contact) =>
    onToggleArchiveThread ? Boolean(c.isArchived) : localArchivedMap[c.id] ?? Boolean(c.isArchived);

  const getUnreadCount = (contactId: string) => {
    const msgs = chats[contactId] || [];
    const incomingUnread = msgs.filter((m) => m.sender === 'contact' && m.status !== 'read').length;
    if (incomingUnread > 0) return incomingUnread;
    return manualUnreadMap[contactId] ? 1 : 0;
  };

  const isThreadInactive = (c: Contact) =>
    !isContactArchived(c) &&
    (c.telegramStatus === 'inactive' ||
      c.telegramStatus === 'unknown' ||
      c.stage === 'churned' ||
      c.optInStatus === 'opted_out' ||
      c.optInStatus === 'dnc_suppressed' ||
      (chats[c.id]?.length ?? 0) === 0);

  const archivedContacts = roleScopedContacts.filter(isContactArchived);
  const activeWorkspaceContacts = roleScopedContacts.filter((c) => !isContactArchived(c));
  const inactiveActiveIds = activeWorkspaceContacts.filter(isThreadInactive).map((c) => c.id);
  const totalUnreadThreadsCount = activeWorkspaceContacts.filter((c) => getUnreadCount(c.id) > 0).length;

  useEffect(() => {
    if (initialContactId && roleScopedContacts.some((c) => c.id === initialContactId)) {
      setActiveContactId(initialContactId);
      const target = roleScopedContacts.find((c) => c.id === initialContactId);
      if (target && isContactArchived(target)) {
        setShowArchived(true);
      }
    } else if (!roleScopedContacts.some((c) => c.id === activeContactId)) {
      setActiveContactId(activeWorkspaceContacts[0]?.id || roleScopedContacts[0]?.id || '');
    }
  }, [initialContactId, currentUser.id, currentUser.role, contacts.length]);

  const handleToggleArchive = (contactId: string, archive: boolean) => {
    if (onToggleArchiveThread) {
      onToggleArchiveThread(contactId, archive);
    } else {
      setLocalArchivedMap((prev) => ({ ...prev, [contactId]: archive }));
    }
    if (activeContactId === contactId) {
      const remaining = (showArchived ? archivedContacts : activeWorkspaceContacts).filter(
        (c) => c.id !== contactId
      );
      const nextId = remaining[0]?.id || '';
      setActiveContactId(nextId);
      if (nextId) onSelectContact?.(nextId);
    }
  };

  const handleBatchArchiveInactive = () => {
    if (inactiveActiveIds.length === 0) return;
    if (onArchiveInactiveThreads) {
      onArchiveInactiveThreads(inactiveActiveIds);
    } else {
      setLocalArchivedMap((prev) => {
        const next = { ...prev };
        inactiveActiveIds.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
    }
    if (inactiveActiveIds.includes(activeContactId)) {
      const remaining = activeWorkspaceContacts.filter((c) => !inactiveActiveIds.includes(c.id));
      const nextId = remaining[0]?.id || '';
      setActiveContactId(nextId);
      if (nextId) onSelectContact?.(nextId);
    }
  };

  const handleMarkContactRead = (contactId: string) => {
    setManualUnreadMap((prev) => {
      if (!prev[contactId]) return prev;
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
    onMarkIncomingRead?.(contactId);
  };

  const handleMarkContactUnread = (contactId: string) => {
    const msgs = chats[contactId] || [];
    if (msgs.some((m) => m.sender === 'contact')) {
      onMarkIncomingUnread?.(contactId);
    } else {
      setManualUnreadMap((prev) => ({ ...prev, [contactId]: true }));
    }
  };

  const scopedViewContacts = showArchived ? archivedContacts : activeWorkspaceContacts;
  const activeContact =
    scopedViewContacts.find((c) => c.id === activeContactId) || scopedViewContacts[0];
  const activeSendLang = activeContact ? perChatSendLang[activeContact.id] || '' : '';
  const currentMessages = activeContact ? chats[activeContact.id] || [] : [];
  const pinnedMessage = currentMessages.find((m) => m.isPinned);

  const handleSetChatSendLang = (contactId: string, langCode: string | null) => {
    setPerChatSendLang((prev) => {
      const next = { ...prev };
      if (!langCode) {
        delete next[contactId];
      } else {
        next[contactId] = langCode;
      }
      try {
        localStorage.setItem('telepulse_per_chat_send_lang', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const threadPhotos = currentMessages
    .filter((m) => (m.attachment?.type === 'photo' && (m.attachment.url || m.mediaUrl)) || Boolean(m.mediaUrl))
    .map((m) => ({
      messageId: m.id,
      url: m.attachment?.url || m.mediaUrl || '',
      name: m.attachment?.name || 'Telegram Photo',
      size: m.attachment?.size,
      senderName: m.sender === 'agent' ? m.senderName : activeContact?.name || m.senderName,
      timestamp: m.timestamp,
      caption: m.text,
    }));

  const currentPreviewIndex = previewImage?.messageId
    ? threadPhotos.findIndex((p) => p.messageId === previewImage.messageId)
    : -1;

  const openImagePreview = (item: {
    url: string;
    name: string;
    size?: string;
    senderName?: string;
    timestamp?: string;
    caption?: string;
    messageId?: string;
  }) => {
    setPreviewImage(item);
    setPreviewZoom(1);
    setPreviewLoadError(false);
  };

  const navigatePreviewPhoto = (direction: -1 | 1) => {
    if (threadPhotos.length <= 1 || currentPreviewIndex < 0) return;
    const nextIndex = (currentPreviewIndex + direction + threadPhotos.length) % threadPhotos.length;
    openImagePreview(threadPhotos[nextIndex]);
  };

  const isOptedOut =
    activeContact?.optInStatus === 'opted_out' || activeContact?.optInStatus === 'dnc_suppressed';

  const initiatingSession = activeContact?.initialSessionId
    ? userbotSessions.find((u) => u.id === activeContact.initialSessionId)
    : userbotSessions[0];

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [currentMessages.length, isCustomerTyping, isUserbotTyping, activeContact?.id]);

  useEffect(() => {
    setPreviewImage(null);
    setChatBodyTranslateLang(null);
    setOpenBubbleLangPickerId(null);
    setHeaderTranslatePickerOpen(false);
    setComposerLangPickerOpen(false);
    setSendLangPickerOpen(false);
    setTranslatedReplyPreview(null);
    setIsRecordingVoice(false);
    setVoiceSeconds(0);
    setReplyingTo(null);
    setPendingAttachment(null);
    setInChatSearchOpen(false);
    setInChatQuery('');
    setEmojiOpen(false);
    setAttachMenuOpen(false);
    setMoreMenuOpen(false);
  }, [activeContact?.id]);

  useEffect(() => {
    const onEscapePopovers = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setEmojiOpen(false);
      setAttachMenuOpen(false);
      setMoreMenuOpen(false);
      setHeaderTranslatePickerOpen(false);
      setComposerLangPickerOpen(false);
      setSendLangPickerOpen(false);
      setOpenBubbleLangPickerId(null);
    };
    document.addEventListener('keydown', onEscapePopovers);
    return () => document.removeEventListener('keydown', onEscapePopovers);
  }, []);

  useEffect(() => {
    if (!previewImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      } else if (e.key === 'ArrowLeft') {
        if (threadPhotos.length > 1 && currentPreviewIndex >= 0) {
          const prevIdx = (currentPreviewIndex - 1 + threadPhotos.length) % threadPhotos.length;
          openImagePreview(threadPhotos[prevIdx]);
        }
      } else if (e.key === 'ArrowRight') {
        if (threadPhotos.length > 1 && currentPreviewIndex >= 0) {
          const nextIdx = (currentPreviewIndex + 1) % threadPhotos.length;
          openImagePreview(threadPhotos[nextIdx]);
        }
      } else if (e.key === '+' || e.key === '=') {
        setPreviewZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
      } else if (e.key === '-') {
        setPreviewZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewImage, currentPreviewIndex, threadPhotos.length]);

  useEffect(() => {
    try {
      localStorage.setItem('telepulse_routing_bar_scale', String(routingBarScale));
    } catch {}
  }, [routingBarScale]);

  useEffect(() => {
    try {
      localStorage.setItem('telepulse_routing_bar_pad', String(routingBarExtraPad));
    } catch {}
  }, [routingBarExtraPad]);

  useEffect(() => {
    try {
      localStorage.setItem('telepulse_inbox_pane_width', String(inboxPaneWidth));
    } catch {}
  }, [inboxPaneWidth]);

  const startRoutingBarResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const initialPad = routingBarExtraPad;
    const initialScale = routingBarScale;
    setIsDraggingSplit('routing');

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      const nextPad = Math.max(4, Math.min(36, Math.round(initialPad + dy * 0.35)));
      const nextScale = Math.max(85, Math.min(120, Math.round(initialScale + dy * 0.25)));
      setRoutingBarExtraPad(nextPad);
      setRoutingBarScale(nextScale);
    };

    const onUp = () => {
      setIsDraggingSplit(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startInboxWidthResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const initialWidth = inboxPaneWidth;
    setIsDraggingSplit('inbox');

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const maxAllowed = chatShellRef.current
        ? Math.min(580, Math.round(chatShellRef.current.clientWidth * 0.55))
        : 540;
      const nextWidth = Math.max(260, Math.min(maxAllowed, Math.round(initialWidth + dx)));
      setInboxPaneWidth(nextWidth);
    };

    const onUp = () => {
      setIsDraggingSplit(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    return () => {
      if (userbotTypingTimerRef.current) clearTimeout(userbotTypingTimerRef.current);
      if (customerTypingTimerRef.current) clearTimeout(customerTypingTimerRef.current);
    };
  }, []);

  // Voice recording timer
  useEffect(() => {
    if (!isRecordingVoice) return;
    const timer = setInterval(() => setVoiceSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecordingVoice]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, [chatInputText]);

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setChatInputText((prev) => prev + snippet);
      return;
    }
    const start = el.selectionStart ?? chatInputText.length;
    const end = el.selectionEnd ?? chatInputText.length;
    const next = chatInputText.slice(0, start) + snippet + chatInputText.slice(end);
    setChatInputText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const applyFormat = (wrapper: '**' | '__' | '`') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = chatInputText.slice(start, end) || 'text';
    const next = chatInputText.slice(0, start) + wrapper + selected + wrapper + chatInputText.slice(end);
    setChatInputText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + wrapper.length, start + wrapper.length + selected.length);
    });
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;

    if (type === 'photo') {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingAttachment({
          type: 'photo',
          name: file.name,
          size: sizeStr,
          url: typeof reader.result === 'string' ? reader.result : undefined,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setPendingAttachment({
        type: 'document',
        name: file.name,
        size: sizeStr,
      });
    }
    setAttachMenuOpen(false);
    e.target.value = '';
  };

  const handleSendVoiceNote = () => {
    if (!activeContact || isOptedOut) return;
    const duration = Math.max(1, voiceSeconds);
    setIsRecordingVoice(false);
    setVoiceSeconds(0);
    onSendMessage(activeContact.id, '', {
      replyTo: replyingTo || undefined,
      attachment: {
        type: 'voice',
        name: `Voice message (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')})`,
        durationSec: duration,
      },
    });
    setReplyingTo(null);
  };

  const handleTranslateMessage = async (
    msgId: string,
    text: string,
    explicitTargetLang?: string
  ) => {
    const existing = messageTranslations[msgId];
    let targetLang = explicitTargetLang;

    if (!targetLang) {
      if (existing && !existing.loading) {
        targetLang = existing.targetLang === 'en' ? 'bn' : 'en';
      } else {
        const detected = detectLanguage(text);
        if (preferredChatTranslateLang && preferredChatTranslateLang !== detected) {
          targetLang = preferredChatTranslateLang;
        } else {
          targetLang = detected === 'bn' ? 'en' : 'bn';
        }
      }
    }

    if (explicitTargetLang) {
      setPreferredChatTranslateLang(explicitTargetLang);
      try {
        localStorage.setItem('telepulse_chat_translate_lang', explicitTargetLang);
      } catch {}
    }

    setMessageTranslations((prev) => ({
      ...prev,
      [msgId]: { text: '', targetLang, loading: true },
    }));
    const res = await translateWithGoogle(text, targetLang);
    setMessageTranslations((prev) => ({
      ...prev,
      [msgId]: { text: res.translatedText, targetLang: res.targetLang || targetLang, loading: false },
    }));
  };

  const handleHideMessageTranslation = (msgId: string) => {
    setMessageTranslations((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });
  };

  const handleTranslateAllChatMessages = async (targetLang: string) => {
    setChatBodyTranslateLang(targetLang);
    setPreferredChatTranslateLang(targetLang);
    try {
      localStorage.setItem('telepulse_chat_translate_lang', targetLang);
    } catch {}

    const textMsgs = currentMessages.filter((m) => Boolean(m.text && m.text.trim()));
    if (textMsgs.length === 0) return;

    setMessageTranslations((prev) => {
      const next = { ...prev };
      for (const m of textMsgs) {
        next[m.id] = { text: '', targetLang, loading: true };
      }
      return next;
    });

    await Promise.all(
      textMsgs.map(async (m) => {
        const res = await translateWithGoogle(m.text, targetLang);
        setMessageTranslations((prev) => ({
          ...prev,
          [m.id]: { text: res.translatedText, targetLang, loading: false },
        }));
      })
    );
  };

  const handleClearAllChatTranslations = () => {
    setChatBodyTranslateLang(null);
    setMessageTranslations((prev) => {
      const next = { ...prev };
      for (const m of currentMessages) {
        delete next[m.id];
      }
      return next;
    });
  };

  const handleTranslateReplyBeforeSend = async (targetLang: string) => {
    if (!chatInputText.trim()) return;
    setReplyTranslating(true);
    try {
      const res = await translateWithGoogle(chatInputText, targetLang);
      setTranslatedReplyPreview({ text: res.translatedText, targetLang });
    } finally {
      setReplyTranslating(false);
    }
  };

  const triggerSend = async () => {
    if (!activeContact || isOptedOut || isSendingTranslated) return;
    if (!chatInputText.trim() && !pendingAttachment) return;

    if (userbotTypingTimerRef.current) clearTimeout(userbotTypingTimerRef.current);
    setIsUserbotTyping(false);

    const typedText = chatInputText.trim();
    const targetContactId = activeContact.id;
    const sendLangForChat = perChatSendLang[targetContactId] || '';
    const replySnapshot = replyingTo || undefined;
    const attachmentSnapshot = pendingAttachment || undefined;

    let finalTextToSend = typedText;
    let originalTextMeta: string | undefined;
    let translatedLangMeta: string | undefined;

    if (typedText && sendLangForChat) {
      setIsSendingTranslated(true);
      try {
        const res = await translateWithGoogle(typedText, sendLangForChat);
        if (res.translatedText && res.translatedText.trim()) {
          finalTextToSend = res.translatedText.trim();
          translatedLangMeta = sendLangForChat;
          if (finalTextToSend !== typedText) {
            originalTextMeta = typedText;
          }
        }
      } finally {
        setIsSendingTranslated(false);
      }
    }

    onSendMessage(targetContactId, finalTextToSend, {
      replyTo: replySnapshot,
      attachment: attachmentSnapshot,
      originalText: originalTextMeta,
      translatedLang: translatedLangMeta,
    });
    setChatInputText('');
    setReplyingTo(null);
    setPendingAttachment(null);
    setTranslatedReplyPreview(null);
    setEmojiOpen(false);
    setSlashMenuOpen(false);
    setSendLangPickerOpen(false);

    if (autoReplyEnabled) {
      setTimeout(() => {
        setIsCustomerTyping(true);
        setTimeout(() => {
          setIsCustomerTyping(false);
          const reply = `Thanks ${currentUser.name}, received your message via ${initiatingSession?.label || 'Userbot'}!`;
          onSimulateCustomerReply(targetContactId, reply);
          if (soundEnabled) playChime();
        }, 1400);
      }, 450);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    } else if (e.key === 'Escape') {
      setEmojiOpen(false);
      setAttachMenuOpen(false);
      setSlashMenuOpen(false);
      setReplyingTo(null);
    }
  };

  const handleInputChange = (val: string) => {
    setChatInputText(val);
    if (userbotTypingTimerRef.current) clearTimeout(userbotTypingTimerRef.current);
    if (val.trim().length > 0) {
      setIsUserbotTyping(true);
      userbotTypingTimerRef.current = setTimeout(() => {
        setIsUserbotTyping(false);
      }, 1800);
    } else {
      setIsUserbotTyping(false);
    }

    if (val === '/') {
      setSlashMenuOpen(true);
    } else if (!val.startsWith('/')) {
      setSlashMenuOpen(false);
    }
  };

  const normalizedSearch = chatSearch.trim().toLowerCase();

  const matchingChatContacts = scopedViewContacts.filter((c) => {
    if (!showArchived) {
      if (inboxFilter === 'unread' && getUnreadCount(c.id) === 0) return false;
      if (!isModerator && !isViewer) {
        if (inboxFilter === 'unassigned' && c.assignedModeratorId) return false;
        if (inboxFilter === 'assigned' && !c.assignedModeratorId) return false;
        if (inboxFilter === 'opted_out' && c.optInStatus !== 'opted_out' && c.optInStatus !== 'dnc_suppressed')
          return false;
      }
    }
    if (!normalizedSearch) return true;

    const contactMatches =
      c.name.toLowerCase().includes(normalizedSearch) ||
      c.phoneNumber.toLowerCase().includes(normalizedSearch) ||
      (c.company && c.company.toLowerCase().includes(normalizedSearch)) ||
      (c.telegramUsername && c.telegramUsername.toLowerCase().includes(normalizedSearch));

    if (contactMatches) return true;

    const recentMessages = chats[c.id] || [];
    return recentMessages.some(
      (m) =>
        m.text.toLowerCase().includes(normalizedSearch) ||
        (m.attachment?.name && m.attachment.name.toLowerCase().includes(normalizedSearch))
    );
  });

  const filteredChatContacts = unreadFirst
    ? [...matchingChatContacts].sort((a, b) => {
        const unreadA = getUnreadCount(a.id);
        const unreadB = getUnreadCount(b.id);
        if (unreadA > 0 && unreadB === 0) return -1;
        if (unreadB > 0 && unreadA === 0) return 1;
        if (unreadA !== unreadB) return unreadB - unreadA;
        return 0;
      })
    : matchingChatContacts;

  const visibleMessages = inChatQuery.trim()
    ? currentMessages.filter((m) => m.text.toLowerCase().includes(inChatQuery.toLowerCase()))
    : currentMessages;

  const cannedReplies = [
    {
      cmd: '/welcome',
      label: 'Greeting & Support',
      text: 'Hello! Thanks for reaching out. Let me check your order status right away.',
    },
    {
      cmd: '/confirmed',
      label: 'Order Confirmed',
      text: 'Your order has been confirmed and is now queued for priority dispatch.',
    },
    {
      cmd: '/tracking',
      label: 'Tracking Link',
      text: `Order ${activeContact?.customFields?.Order_Number || '#ORD-101'} has been handed over to our courier partner.`,
    },
    {
      cmd: '/optout',
      label: 'Opt-Out Notice',
      text: 'Reply STOP or /unsubscribe anytime if you prefer not to receive updates.',
    },
  ];

  const activeEmojiList = emojiSearch.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((em, idx, arr) => {
        if (arr.indexOf(em) !== idx) return false;
        const kw = EMOJI_KEYWORDS[em] || '';
        const q = emojiSearch.toLowerCase();
        return kw.includes(q) || em.includes(q);
      })
    : EMOJI_CATEGORIES.find((c) => c.id === emojiCategory)?.emojis || EMOJI_CATEGORIES[0].emojis;

  const activeRoutingTargetId =
    moderators.find((m) => m.id === routingTargetModId)?.id ||
    dedicatedModerators[0]?.id ||
    moderators[0]?.id ||
    '';
  const unassignedTotalCount = contacts.filter((c) => !c.assignedModeratorId).length;

  return (
    <div className="h-full flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Hidden native file inputs for real Telegram photo & document upload */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChosen(e, 'photo')}
      />
      <input
        ref={docInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFileChosen(e, 'document')}
      />

      {/* Moderator Routing Control Bar (Admin/Editor) OR Instant Reply Queue Banner (Moderator) — Hidden for Viewer */}
      {!isViewer && (isModerator ? (
        <div
          style={{
            paddingTop: `${routingBarExtraPad}px`,
            paddingBottom: `${routingBarExtraPad}px`,
            zoom: routingBarScale / 100,
          }}
          className="shrink-0 relative px-4 border-b border-purple-200 dark:border-purple-900/60 bg-purple-50/70 dark:bg-purple-950/30 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="font-semibold text-neutral-900 dark:text-white">
              Routed to {currentUser.name} · Instant Reply Enabled
            </span>
            <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
              ({activeWorkspaceContacts.length} active · {totalUnreadThreadsCount} unread)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeContact && (
              <button
                type="button"
                onClick={() => textareaRef.current?.focus()}
                className="px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-colors"
              >
                Jump to Reply Composer
              </button>
            )}
          </div>
          <div
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={startRoutingBarResize}
            onDoubleClick={() => {
              setRoutingBarScale(100);
              setRoutingBarExtraPad(8);
            }}
            title="Drag vertically to scale/resize this panel · Double-click to reset"
            className={`absolute inset-x-0 -bottom-1 h-2 cursor-row-resize flex items-center justify-center group z-20 ${
              isDraggingSplit === 'routing' ? 'bg-sky-500/20' : 'hover:bg-sky-500/15'
            }`}
          >
            <span className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-sky-500 transition-colors" />
          </div>
        </div>
      ) : (
        onRouteContactsToModerator && (
          <div
            style={{
              paddingTop: `${routingBarExtraPad}px`,
              paddingBottom: `${routingBarExtraPad}px`,
              zoom: routingBarScale / 100,
            }}
            className="shrink-0 relative px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#17212B] flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-purple-500" />
                Moderator Routing:
              </span>
              <select
                value={activeRoutingTargetId}
                onChange={(e) => {
                  setRoutingTargetModId(e.target.value);
                  onUpdateModeratorRouting?.({ defaultModeratorId: e.target.value });
                }}
                className="px-2.5 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#242F3D] text-neutral-900 dark:text-neutral-100 font-medium"
              >
                {moderators.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>

              {moderatorRouting && onUpdateModeratorRouting && (
                <>
                  <select
                    value={moderatorRouting.mode}
                    onChange={(e) => onUpdateModeratorRouting({ mode: e.target.value as ModeratorRoutingMode })}
                    className="px-2.5 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#242F3D] text-neutral-700 dark:text-neutral-200"
                  >
                    <option value="specific_moderator">Auto-Route: Specific Moderator</option>
                    <option value="round_robin">Auto-Route: Round-Robin</option>
                    <option value="manual">Manual Routing</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onUpdateModeratorRouting({ enabled: !moderatorRouting.enabled })}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                      moderatorRouting.enabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    {moderatorRouting.enabled ? 'Auto-Route ON' : 'Auto-Route OFF'}
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {routingBannerToast && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mr-1">
                  {routingBannerToast}
                </span>
              )}
              <button
                type="button"
                disabled={!activeRoutingTargetId || unassignedTotalCount === 0}
                onClick={() => {
                  const modName = moderators.find((m) => m.id === activeRoutingTargetId)?.name || 'Moderator';
                  onRouteContactsToModerator(activeRoutingTargetId, 'unassigned');
                  setRoutingBannerToast(`Routed ${unassignedTotalCount} unassigned to ${modName}`);
                  setTimeout(() => setRoutingBannerToast(null), 3500);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 disabled:opacity-40 transition-colors"
              >
                Route Unassigned ({unassignedTotalCount})
              </button>

              <button
                type="button"
                disabled={!activeRoutingTargetId || contacts.length === 0}
                onClick={() => {
                  const modName = moderators.find((m) => m.id === activeRoutingTargetId)?.name || 'Moderator';
                  onRouteContactsToModerator(activeRoutingTargetId, 'all');
                  setRoutingBannerToast(`Routed all ${contacts.length} chats to ${modName}`);
                  setTimeout(() => setRoutingBannerToast(null), 3500);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors"
              >
                Route All Contacts ({contacts.length})
              </button>

              {onDistributeRoundRobin && (
                <button
                  type="button"
                  disabled={dedicatedModerators.length === 0}
                  onClick={() => {
                    onDistributeRoundRobin('all');
                    setRoutingBannerToast('Distributed evenly across moderators');
                    setTimeout(() => setRoutingBannerToast(null), 3500);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#242F3D] disabled:opacity-40 transition-colors"
                >
                  Round-Robin
                </button>
              )}

              {/* Compact Routing Bar Scale Controls */}
              <div className="hidden sm:flex items-center gap-0.5 ml-1 pl-1.5 border-l border-neutral-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setRoutingBarScale((s) => Math.max(85, s - 5))}
                  title="Decrease panel scale"
                  className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#242F3D] dark:text-neutral-300"
                >
                  -
                </button>
                <span className="text-[10px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 px-1">
                  {routingBarScale}%
                </span>
                <button
                  type="button"
                  onClick={() => setRoutingBarScale((s) => Math.min(120, s + 5))}
                  title="Increase panel scale"
                  className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#242F3D] dark:text-neutral-300"
                >
                  +
                </button>
              </div>
            </div>

            {/* Drag Handle on Bottom Edge of Moderator Routing Area */}
            <div
              role="separator"
              aria-orientation="horizontal"
              onPointerDown={startRoutingBarResize}
              onDoubleClick={() => {
                setRoutingBarScale(100);
                setRoutingBarExtraPad(8);
              }}
              title="Drag vertically to resize/scale routing panel · Double-click to reset"
              className={`absolute inset-x-0 -bottom-1 h-2.5 cursor-row-resize flex items-center justify-center group z-20 ${
                isDraggingSplit === 'routing' ? 'bg-sky-500/20' : 'hover:bg-sky-500/15'
              }`}
            >
              <span className="inline-flex items-center justify-center px-2 rounded-full bg-white dark:bg-[#17212B] border border-neutral-200 dark:border-neutral-700 shadow-xs opacity-60 group-hover:opacity-100 group-hover:border-sky-500 transition-all">
                <GripHorizontal className="w-3 h-2.5 text-neutral-400 group-hover:text-sky-500" />
              </span>
            </div>
          </div>
        )
      ))}

      {/* Telegram Shell */}
      <div
        ref={chatShellRef}
        className="flex flex-col lg:flex-row flex-1 min-h-0 bg-white dark:bg-[#17212B] overflow-y-auto lg:overflow-hidden"
      >
        {/* LEFT COLUMN: Telegram Chats List */}
        <div
          style={{ ['--inbox-width' as string]: `${inboxPaneWidth}px` }}
          className="w-full lg:w-[var(--inbox-width)] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-[#0E1621] flex flex-col min-h-[340px] lg:min-h-0 lg:h-full bg-white dark:bg-[#17212B]"
        >
          {/* Telegram Top Search & Filter */}
          <div className="p-3 border-b border-neutral-100 dark:border-[#0E1621] space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 block truncate">
                  {showArchived
                    ? `Archived Chats (${archivedContacts.length})`
                    : isModerator
                    ? `Assigned Chats (${activeWorkspaceContacts.length})`
                    : `Telegram Inbox (${activeWorkspaceContacts.length})`}
                </span>
                {!isViewer && (
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {userbotSessions.filter((u) => u.healthStatus === 'active').length} Userbots Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  aria-pressed={showArchived}
                  title={showArchived ? 'Return to active chats' : 'View archived conversations'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    showArchived
                      ? 'bg-[#3390EC] text-white shadow-sm'
                      : 'bg-neutral-100 dark:bg-[#242F3D] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-[#2B394A]'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archived</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                      showArchived
                        ? 'bg-white/25 text-white'
                        : 'bg-neutral-200/80 dark:bg-[#0E1621] text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {archivedContacts.length}
                  </span>
                </button>

                {isViewer && onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    title="Sign Out"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Logout</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                aria-label="Search contacts or recent messages"
                placeholder="Search name or recent messages..."
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && chatSearch) {
                    setChatSearch('');
                  }
                }}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-full bg-neutral-100 dark:bg-[#242F3D] text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#3390EC]"
              />
              {chatSearch && (
                <button
                  type="button"
                  onClick={() => setChatSearch('')}
                  aria-label="Clear search"
                  title="Clear search (Esc)"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Efficiency Controls: Unread-First Priority & Batch Archive Inactive */}
            <div className="flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={() => setUnreadFirst((v) => !v)}
                aria-pressed={unreadFirst}
                title="Show conversations with unread messages first"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                  unreadFirst
                    ? 'bg-[#3390EC]/12 border-[#3390EC]/35 text-[#1b6ec2] dark:text-sky-300'
                    : 'bg-neutral-50 dark:bg-[#0E1621] border-neutral-200 dark:border-[#242F3D] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                }`}
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Unread First</span>
                {totalUnreadThreadsCount > 0 && !showArchived && (
                  <span className="px-1.5 rounded-full text-[10px] tabular-nums bg-[#3390EC] text-white">
                    {totalUnreadThreadsCount}
                  </span>
                )}
              </button>

              {!isViewer && !showArchived && inactiveActiveIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchArchiveInactive}
                  title="Archive all inactive chat threads to keep workspace clean"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-neutral-200 dark:border-[#242F3D] bg-neutral-50 dark:bg-[#0E1621] text-neutral-600 dark:text-neutral-300 hover:border-amber-400/60 hover:text-amber-600 dark:hover:text-amber-300 transition-colors whitespace-nowrap"
                >
                  <Archive className="w-3 h-3" />
                  <span>Archive Inactive ({inactiveActiveIds.length})</span>
                </button>
              )}

              {showArchived && (
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[#3390EC] hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors whitespace-nowrap"
                >
                  <ArchiveRestore className="w-3 h-3" />
                  <span>Back to Inbox</span>
                </button>
              )}
            </div>

            {!showArchived && (
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-[#0E1621] text-[10px] font-semibold overflow-x-auto">
                {(isModerator || isViewer
                  ? [
                      { id: 'all', label: 'All' },
                      {
                        id: 'unread',
                        label: `Unread (${totalUnreadThreadsCount})`,
                      },
                    ]
                  : [
                      { id: 'all', label: 'All' },
                      {
                        id: 'unread',
                        label: `Unread${totalUnreadThreadsCount > 0 ? ` (${totalUnreadThreadsCount})` : ''}`,
                      },
                      { id: 'unassigned', label: 'Unassigned' },
                      { id: 'assigned', label: 'Assigned' },
                      { id: 'opted_out', label: 'Opt-Out' },
                    ]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInboxFilter(tab.id as typeof inboxFilter)}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-colors whitespace-nowrap ${
                      inboxFilter === tab.id
                        ? 'bg-white dark:bg-[#242F3D] text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conversation Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100/80 dark:divide-[#0E1621]/70">
            {filteredChatContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400 space-y-2">
                <div>
                  {normalizedSearch
                    ? `No contacts or recent messages matching "${chatSearch.trim()}".`
                    : showArchived
                    ? 'No archived conversations.'
                    : inboxFilter === 'unread'
                    ? 'All caught up! No unread conversations.'
                    : isModerator
                    ? 'No conversations assigned to you yet.'
                    : 'No matching Telegram conversations.'}
                </div>
                {normalizedSearch && (
                  <button
                    type="button"
                    onClick={() => setChatSearch('')}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium text-[#3390EC] hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear search</span>
                  </button>
                )}
              </div>
            ) : (
              filteredChatContacts.map((contact) => {
                const msgs = chats[contact.id] || [];
                const lastMsg = msgs[msgs.length - 1];
                const unreadCount = getUnreadCount(contact.id);
                const inactive = isThreadInactive(contact);
                const archived = isContactArchived(contact);
                const matchedMsg = normalizedSearch
                  ? [...msgs]
                      .reverse()
                      .find(
                        (m) =>
                          m.text.toLowerCase().includes(normalizedSearch) ||
                          (m.attachment?.name && m.attachment.name.toLowerCase().includes(normalizedSearch))
                      )
                  : undefined;
                const previewMsg = matchedMsg || lastMsg;
                const isSelected = contact.id === activeContact?.id;
                const assignedMod = allUsers.find((u) => u.id === contact.assignedModeratorId);
                const optedOut =
                  contact.optInStatus === 'opted_out' || contact.optInStatus === 'dnc_suppressed';

                return (
                  <div
                    key={contact.id}
                    className={`group relative flex items-center transition-colors ${
                      isSelected
                        ? 'bg-[#3390EC] text-white dark:bg-[#2B5278]'
                        : 'hover:bg-neutral-50 dark:hover:bg-[#202B36]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveContactId(contact.id);
                        onSelectContact?.(contact.id);
                        handleMarkContactRead(contact.id);
                        setReplyingTo(null);
                        setPendingAttachment(null);
                        setTimeout(() => textareaRef.current?.focus(), 30);
                      }}
                      className="flex-1 min-w-0 text-left pl-3 pr-2 py-2.5 flex items-center gap-3"
                    >
                      <div
                        className={`w-11 h-11 rounded-full font-semibold flex items-center justify-center text-sm flex-shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : getAvatarTone(contact.id)
                        }`}
                      >
                        {contact.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[13px] truncate ${
                              unreadCount > 0 ? 'font-bold' : 'font-semibold'
                            } ${isSelected ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'}`}
                          >
                            {renderHighlightedMatch(contact.name, chatSearch, isSelected)}
                          </span>
                          <span
                            className={`text-[10px] tabular-nums flex items-center gap-0.5 flex-shrink-0 ${
                              isSelected ? 'text-white/85' : 'text-neutral-400'
                            }`}
                          >
                            {previewMsg?.sender === 'agent' && (
                              <ReadReceiptIndicator
                                status={previewMsg.status}
                                compact
                                isSelectedRow={isSelected}
                              />
                            )}
                            {previewMsg ? formatMessageTime(previewMsg.timestamp) : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <div
                            className={`text-xs truncate min-w-0 ${
                              unreadCount > 0 && !isSelected
                                ? 'font-semibold text-neutral-800 dark:text-neutral-200'
                                : isSelected
                                ? 'text-white/90'
                                : 'text-neutral-500 dark:text-neutral-400'
                            }`}
                          >
                            {contact.id === activeContact?.id && isCustomerTyping ? (
                              <span
                                className={`inline-flex items-center gap-1.5 font-medium ${
                                  isSelected ? 'text-white' : 'text-[#3390EC]'
                                }`}
                              >
                                <TypingDots dotClass="bg-current" />
                                <span>typing...</span>
                              </span>
                            ) : contact.id === activeContact?.id && (isUserbotTyping || replyTranslating) ? (
                              <span
                                className={`inline-flex items-center gap-1.5 font-medium ${
                                  isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                <TypingDots dotClass="bg-current" />
                                <span>Userbot typing...</span>
                              </span>
                            ) : previewMsg ? (
                              <>
                                {previewMsg.sender === 'agent' ? 'You: ' : ''}
                                {previewMsg.attachment
                                  ? renderHighlightedMatch(`📎 ${previewMsg.attachment.name}`, chatSearch, isSelected)
                                  : renderHighlightedMatch(previewMsg.text, chatSearch, isSelected)}
                              </>
                            ) : (
                              contact.phoneNumber
                            )}
                          </div>

                          {unreadCount > 0 && (
                            <span
                              aria-label={`${unreadCount} unread messages`}
                              className={`min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold tabular-nums inline-flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'bg-white text-[#3390EC]'
                                  : 'bg-[#3390EC] text-white'
                              }`}
                            >
                              {unreadCount}
                            </span>
                          )}
                        </div>

                        <div
                          className={`text-[10px] mt-0.5 truncate flex items-center gap-1.5 ${
                            isSelected
                              ? 'text-white/80'
                              : optedOut
                              ? 'text-red-500'
                              : 'text-neutral-400'
                          }`}
                        >
                          <span className="truncate">
                            {optedOut
                              ? 'Opted Out (Blocked)'
                              : assignedMod
                              ? `Mod: ${assignedMod.name.split(' ')[0]}`
                              : 'Unassigned'}
                            {contact.telegramUsername ? ` · @${contact.telegramUsername}` : ''}
                          </span>
                          {perChatSendLang[contact.id] && (
                            <span
                              data-no-translate="true"
                              title={`Outgoing send language: ${getLanguageByCode(perChatSendLang[contact.id]).name}`}
                              className={`px-1 rounded text-[9px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#3390EC]/15 text-[#3390EC] dark:text-sky-300'
                              }`}
                            >
                              → {perChatSendLang[contact.id].toUpperCase()}
                            </span>
                          )}
                          {inactive && !archived && (
                            <span
                              className={`px-1 rounded text-[9px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-neutral-200/80 dark:bg-[#242F3D] text-neutral-600 dark:text-neutral-400'
                              }`}
                            >
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleArchive(contact.id, !archived);
                      }}
                      title={archived ? 'Restore from archive' : 'Archive thread'}
                      aria-label={archived ? `Unarchive ${contact.name}` : `Archive ${contact.name}`}
                      className={`mr-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0 ${
                        isSelected
                          ? 'text-white/85 hover:text-white hover:bg-white/15'
                          : 'text-neutral-400 hover:text-[#3390EC] hover:bg-neutral-200/70 dark:hover:bg-[#2B394A]'
                      }`}
                    >
                      {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Drag Resizer Divider between Inbox List and Chat Canvas */}
        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startInboxWidthResize}
          onDoubleClick={() => setInboxPaneWidth(360)}
          title="Drag horizontally to resize Inbox panel width · Double-click to reset"
          className={`hidden lg:flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center border-r border-neutral-200 dark:border-[#0E1621] transition-colors group ${
            isDraggingSplit === 'inbox'
              ? 'bg-sky-500/25'
              : 'bg-neutral-50 dark:bg-[#131C26] hover:bg-sky-500/15'
          }`}
        >
          <GripVertical className="w-3 h-4 text-neutral-400 group-hover:text-sky-500 transition-colors" />
        </div>

        {/* RIGHT COLUMN: Telegram Chat Canvas + Optional Contact Info Drawer */}
        <div className="flex-1 flex min-h-[460px] lg:min-h-0 lg:h-full min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 bg-[#E6EBEE] dark:bg-[#0E1621] relative">
            {activeContact ? (
              <>
                {/* Telegram Chat Header */}
                <div className="px-4 py-2.5 bg-white dark:bg-[#17212B] border-b border-neutral-200 dark:border-[#0E1621] flex items-center justify-between gap-2 shrink-0 z-20">
                  <button
                    type="button"
                    onClick={() => setProfileOpen((v) => !v)}
                    className="flex items-center gap-3 min-w-0 text-left hover:opacity-90"
                  >
                    <div
                      className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs flex-shrink-0 ${getAvatarTone(
                        activeContact.id
                      )}`}
                    >
                      {activeContact.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-neutral-900 dark:text-white truncate">
                        {activeContact.name}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {isCustomerTyping ? (
                          <span className="inline-flex items-center gap-1.5 text-[#3390EC] font-medium">
                            <TypingDots dotClass="bg-[#3390EC]" />
                            <span>typing...</span>
                          </span>
                        ) : isUserbotTyping || replyTranslating ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <TypingDots dotClass="bg-emerald-500" />
                            <span>{initiatingSession?.label || 'Userbot'} is typing...</span>
                          </span>
                        ) : (
                          <span>
                            {initiatingSession?.label || 'Userbot #1'} ·{' '}
                            <span className="font-mono">{activeContact.phoneNumber}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Right Header Toolbar */}
                  <div className="flex items-center gap-1.5 relative">
                    {!isModerator && !isViewer && (
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-neutral-400 hidden sm:block" />
                        <select
                          value={activeContact.assignedModeratorId || ''}
                          onChange={(e) => onAssignModerator(activeContact.id, e.target.value)}
                          title="Assign or route this thread to a moderator"
                          className="text-xs px-2 py-1 rounded-lg border border-neutral-200 dark:border-[#242F3D] bg-neutral-50 dark:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                        >
                          <option value="">Unassigned</option>
                          {moderators.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setHeaderTranslatePickerOpen((v) => !v)}
                        className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          chatBodyTranslateLang || headerTranslatePickerOpen
                            ? 'bg-sky-500/15 text-[#3390EC]'
                            : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                        }`}
                        title="Translate entire chat conversation into any language"
                      >
                        <Languages className="w-4 h-4" />
                        <span className="hidden md:inline">
                          {chatBodyTranslateLang
                            ? getLanguageByCode(chatBodyTranslateLang).name
                            : 'Translate Chat'}
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-75" />
                      </button>

                      {headerTranslatePickerOpen && (
                        <ChatLanguagePicker
                          activeCode={chatBodyTranslateLang || undefined}
                          align="right"
                          title="Translate Chat Messages To"
                          showOriginalOption={Boolean(chatBodyTranslateLang)}
                          onSelectOriginal={handleClearAllChatTranslations}
                          onSelect={(code) => handleTranslateAllChatMessages(code)}
                          onClose={() => setHeaderTranslatePickerOpen(false)}
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setInChatSearchOpen((v) => !v);
                        setInChatQuery('');
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        inChatSearchOpen
                          ? 'bg-sky-500/15 text-[#3390EC]'
                          : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                      }`}
                      title="Search in conversation"
                    >
                      <Search className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleToggleArchive(activeContact.id, !isContactArchived(activeContact))
                      }
                      className={`p-2 rounded-lg transition-colors ${
                        isContactArchived(activeContact)
                          ? 'bg-[#3390EC]/15 text-[#3390EC]'
                          : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                      }`}
                      title={
                        isContactArchived(activeContact) ? 'Restore from archive' : 'Archive chat'
                      }
                    >
                      {isContactArchived(activeContact) ? (
                        <ArchiveRestore className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setProfileOpen((v) => !v)}
                      className={`p-2 rounded-lg transition-colors ${
                        profileOpen
                          ? 'bg-sky-500/15 text-[#3390EC]'
                          : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                      }`}
                      title="Contact Info & CRM Details"
                    >
                      <PanelRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setMoreMenuOpen((v) => !v)}
                      className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#242F3D]"
                      title="Chat options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Telegram More Options Dropdown */}
                    {moreMenuOpen && (
                      <div className="absolute right-0 top-11 w-56 bg-white dark:bg-[#17212B] border border-neutral-200 dark:border-[#0E1621] rounded-xl shadow-xl py-1.5 z-30 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSoundEnabled((v) => !v);
                            setMoreMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                        >
                          <span className="flex items-center gap-2">
                            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                            Notification Sound
                          </span>
                          <span className="text-[10px] text-neutral-400">{soundEnabled ? 'ON' : 'OFF'}</span>
                        </button>

                        {!isViewer && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setAutoReplyEnabled((v) => !v);
                                setMoreMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                            >
                              <span className="flex items-center gap-2">
                                <Bot className="w-3.5 h-3.5" />
                                Auto-Reply Test Mode
                              </span>
                              <span className="text-[10px] text-neutral-400">{autoReplyEnabled ? 'ON' : 'OFF'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (customerTypingTimerRef.current) clearTimeout(customerTypingTimerRef.current);
                                setIsCustomerTyping((prev) => {
                                  const next = !prev;
                                  if (next) {
                                    customerTypingTimerRef.current = setTimeout(() => setIsCustomerTyping(false), 3500);
                                  }
                                  return next;
                                });
                                setMoreMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                            >
                              <span>Customer Typing Preview</span>
                              <span className="text-[10px] text-[#3390EC]">{isCustomerTyping ? 'Active' : 'Trigger'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (userbotTypingTimerRef.current) clearTimeout(userbotTypingTimerRef.current);
                                setIsUserbotTyping((prev) => {
                                  const next = !prev;
                                  if (next) {
                                    userbotTypingTimerRef.current = setTimeout(() => setIsUserbotTyping(false), 3500);
                                  }
                                  return next;
                                });
                                setMoreMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                            >
                              <span>Userbot Typing Preview</span>
                              <span className="text-[10px] text-emerald-500">{isUserbotTyping ? 'Active' : 'Trigger'}</span>
                            </button>
                          </>
                        )}

                        {onMarkThreadRead &&
                          currentMessages.some((m) => m.sender === 'agent' && m.status !== 'read') && (
                            <button
                              type="button"
                              onClick={() => {
                                onMarkThreadRead(activeContact.id);
                                setMoreMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-[#3390EC] dark:text-sky-300"
                            >
                              <span>Mark Messages as Read</span>
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() => {
                            if (getUnreadCount(activeContact.id) > 0) {
                              handleMarkContactRead(activeContact.id);
                            } else {
                              handleMarkContactUnread(activeContact.id);
                            }
                            setMoreMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                        >
                          <span className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-[#3390EC]" />
                            {getUnreadCount(activeContact.id) > 0
                              ? 'Mark Conversation Read'
                              : 'Mark as Unread'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleToggleArchive(activeContact.id, !isContactArchived(activeContact));
                            setMoreMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                        >
                          {isContactArchived(activeContact) ? (
                            <>
                              <ArchiveRestore className="w-3.5 h-3.5 text-[#3390EC]" />
                              <span>Restore from Archive</span>
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5 text-amber-500" />
                              <span>Archive Conversation</span>
                            </>
                          )}
                        </button>

                        {!isViewer && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onSimulateCustomerReply(
                                  activeContact.id,
                                  'Hello, could you please share an update on my request?'
                                );
                                if (soundEnabled) playChime();
                                setMoreMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-[#3390EC]"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Simulate Inbound Customer Message</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onSimulateCustomerReply(activeContact.id, 'STOP');
                                setMoreMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Test Customer &quot;STOP&quot; Opt-Out</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Archived Thread Banner */}
                {isContactArchived(activeContact) && (
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 z-10">
                    <div className="flex items-center gap-2">
                      <Archive className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>This conversation is archived.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(activeContact.id, false)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-200/70 dark:bg-amber-900/60 hover:bg-amber-300/70 text-[11px] font-semibold transition-colors"
                    >
                      <ArchiveRestore className="w-3 h-3" />
                      <span>Unarchive</span>
                    </button>
                  </div>
                )}

                {/* In-Chat Search Strip */}
                {inChatSearchOpen && (
                  <div className="px-4 py-2 bg-white dark:bg-[#17212B] border-b border-neutral-200 dark:border-[#0E1621] flex items-center gap-2 z-10">
                    <Search className="w-3.5 h-3.5 text-neutral-400" />
                    <input
                      type="text"
                      autoFocus
                      value={inChatQuery}
                      onChange={(e) => setInChatQuery(e.target.value)}
                      placeholder="Search messages in this chat..."
                      className="flex-1 text-xs bg-transparent text-neutral-900 dark:text-white focus:outline-none"
                    />
                    {inChatQuery && (
                      <span className="text-[11px] text-neutral-400 tabular-nums">
                        {visibleMessages.length} matches
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setInChatSearchOpen(false);
                        setInChatQuery('');
                      }}
                      className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Telegram Pinned Message Strip */}
                {pinnedMessage && (
                  <div className="px-4 py-1.5 bg-white/95 dark:bg-[#17212B]/95 border-b border-neutral-200 dark:border-[#0E1621] flex items-center justify-between gap-2 text-xs z-10">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pin className="w-3.5 h-3.5 text-[#3390EC] flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-[#3390EC]">Pinned Message</div>
                        <div className="text-[11px] text-neutral-600 dark:text-neutral-300 truncate">
                          {pinnedMessage.text || pinnedMessage.attachment?.name}
                        </div>
                      </div>
                    </div>
                    {onTogglePinMessage && (
                      <button
                        type="button"
                        onClick={() => onTogglePinMessage(activeContact.id, pinnedMessage.id)}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        title="Unpin"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Opted-Out Compliance Banner */}
                {isOptedOut && (
                  <div className="bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900/60 px-4 py-2 text-xs text-red-700 dark:text-red-300 flex items-center gap-2 z-10">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {`Contact opted out (${activeContact.optOutReason || 'STOP'}). Outbound replies are blocked.`}
                    </span>
                  </div>
                )}

                {/* Telegram Wallpaper Messages Stream */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-2.5"
                  style={{
                    backgroundImage:
                      'radial-gradient(rgba(51, 144, 236, 0.08) 1px, transparent 1px), radial-gradient(rgba(51, 144, 236, 0.05) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                    backgroundPosition: '0 0, 14px 14px',
                  }}
                >
                  {/* Date Divider Pill */}
                  <div className="flex justify-center pb-2">
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-medium bg-black/20 dark:bg-white/10 text-white backdrop-blur-sm">
                      Today
                    </span>
                  </div>

                  {visibleMessages.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400 text-xs">
                      <div className="px-4 py-2 rounded-xl bg-white/80 dark:bg-[#17212B]/80 backdrop-blur-sm">
                        {inChatQuery
                          ? 'No messages match your search.'
                          : 'No messages here yet. Send a message or sticker below.'}
                      </div>
                    </div>
                  ) : (
                    visibleMessages.map((msg, msgIdx) => {
                      const isAgent = msg.sender === 'agent';
                      const isBot = msg.sender === 'bot';
                      const trans = messageTranslations[msg.id];
                      const reactions = msg.reactions ? Object.entries(msg.reactions) : [];

                      return (
                        <div
                          key={msg.id}
                          className={`group flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                        >
                          {/* Quick Hover Action Bar (Telegram style) */}
                          <div
                            className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded-full bg-white/95 dark:bg-[#17212B] border border-neutral-200 dark:border-[#242F3D] shadow-sm text-[11px] ${
                              isAgent ? 'flex-row-reverse' : 'flex-row'
                            }`}
                          >
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => onReactMessage?.(activeContact.id, msg.id, emoji)}
                                className="hover:scale-125 transition-transform px-1"
                                title={`React ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                            <span className="w-px h-3 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
                            <button
                              type="button"
                              onClick={() =>
                                setReplyingTo({
                                  id: msg.id,
                                  senderName: isAgent ? msg.senderName : activeContact.name,
                                  text: msg.text || msg.attachment?.name || 'Attachment',
                                })
                              }
                              className="p-1 text-neutral-500 hover:text-[#3390EC]"
                              title="Reply"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onTogglePinMessage?.(activeContact.id, msg.id)}
                              className={`p-1 ${
                                msg.isPinned ? 'text-[#3390EC]' : 'text-neutral-500 hover:text-[#3390EC]'
                              }`}
                              title={msg.isPinned ? 'Unpin' : 'Pin message'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(msg.text || '');
                                setCopiedMsgId(msg.id);
                                setTimeout(() => setCopiedMsgId(null), 1200);
                              }}
                              className="p-1 text-neutral-500 hover:text-[#3390EC]"
                              title="Copy text"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {msg.text && (
                              <button
                                type="button"
                                onClick={() => setOpenBubbleLangPickerId(msg.id)}
                                className="p-1 text-neutral-500 hover:text-[#3390EC]"
                                title="Translate to any language"
                              >
                                <Languages className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Telegram Message Bubble */}
                          <div
                            className={`relative max-w-[85%] sm:max-w-[72%] rounded-2xl px-3.5 py-2 shadow-sm ${
                              isAgent
                                ? 'bg-[#EEFFDE] dark:bg-[#2B5278] text-neutral-900 dark:text-white rounded-br-sm'
                                : isBot
                                ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 border border-amber-200 dark:border-amber-800'
                                : 'bg-white dark:bg-[#182533] text-neutral-900 dark:text-neutral-100 rounded-bl-sm'
                            }`}
                          >
                            {/* Sender label for Bot or Agent session transparency */}
                            {!isAgent && isBot && (
                              <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
                                TelePulse Compliance Bot
                              </div>
                            )}

                            {/* Quoted Reply Preview */}
                            {msg.replyTo && (
                              <div className="mb-1.5 pl-2.5 py-1 pr-2 rounded bg-black/5 dark:bg-white/10 border-l-2 border-[#3390EC] text-[11px]">
                                <div className="font-semibold text-[#3390EC] dark:text-sky-300 truncate">
                                  {msg.replyTo.senderName}
                                </div>
                                <div className="text-neutral-600 dark:text-neutral-300 truncate">
                                  {msg.replyTo.text}
                                </div>
                              </div>
                            )}

                            {/* Attachment Preview (Photo / Document / Voice Note) */}
                            {msg.attachment && (
                              <div className="mb-1.5">
                                {msg.attachment.type === 'photo' && (
                                  <div className="rounded-xl overflow-hidden bg-black/5 dark:bg-black/20">
                                    {msg.attachment.url || msg.mediaUrl ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openImagePreview({
                                            url: msg.attachment!.url || msg.mediaUrl || '',
                                            name: msg.attachment!.name,
                                            size: msg.attachment!.size,
                                            senderName: isAgent ? msg.senderName : activeContact.name,
                                            timestamp: msg.timestamp,
                                            caption: msg.text,
                                            messageId: msg.id,
                                          })
                                        }
                                        aria-label={`View ${msg.attachment.name} in full size`}
                                        title="Click to view full image"
                                        className="group relative block w-full overflow-hidden rounded-xl cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390EC]"
                                      >
                                        <img
                                          src={msg.attachment.url || msg.mediaUrl}
                                          alt={msg.attachment.name}
                                          referrerPolicy="no-referrer"
                                          className="max-h-60 w-full object-cover rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
                                        />
                                        <span className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                          <span className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center shadow-md">
                                            <ZoomIn className="w-4 h-4" />
                                          </span>
                                        </span>
                                      </button>
                                    ) : (
                                      <div className="p-4 flex items-center gap-2 text-xs">
                                        <ImageIcon className="w-4 h-4 text-[#3390EC]" />
                                        <span>{msg.attachment.name}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {msg.attachment.type === 'document' && (
                                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/10">
                                    <div className="w-9 h-9 rounded-lg bg-[#3390EC] text-white flex items-center justify-center flex-shrink-0">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">{msg.attachment.name}</div>
                                      <div className="text-[10px] opacity-70">{msg.attachment.size || 'Document'}</div>
                                    </div>
                                  </div>
                                )}

                                {msg.attachment.type === 'voice' && (
                                  <div className="flex items-center gap-2.5 py-1 min-w-[200px]">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPlayingVoiceId((cur) => (cur === msg.id ? null : msg.id))
                                      }
                                      className="w-8 h-8 rounded-full bg-[#3390EC] text-white flex items-center justify-center flex-shrink-0"
                                    >
                                      {playingVoiceId === msg.id ? (
                                        <Pause className="w-3.5 h-3.5" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 ml-0.5" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      <div className="flex items-end gap-0.5 h-4">
                                        {[35, 70, 50, 90, 60, 80, 40, 85, 55, 75, 45, 65, 95, 50, 70, 40].map(
                                          (h, idx) => (
                                            <span
                                              key={idx}
                                              className={`w-1 rounded-full ${
                                                playingVoiceId === msg.id
                                                  ? 'bg-[#3390EC]'
                                                  : 'bg-neutral-400/70 dark:bg-white/40'
                                              }`}
                                              style={{ height: `${Math.round((h / 100) * 16)}px` }}
                                            />
                                          )
                                        )}
                                      </div>
                                      <div className="text-[10px] opacity-75 mt-0.5 tabular-nums">
                                        0:{String(msg.attachment.durationSec || 4).padStart(2, '0')} · Voice Note
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {!msg.attachment && msg.mediaUrl && (
                              <div className="mb-1.5 rounded-xl overflow-hidden bg-black/5 dark:bg-black/20">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openImagePreview({
                                      url: msg.mediaUrl!,
                                      name: 'Telegram Photo',
                                      senderName: isAgent ? msg.senderName : activeContact.name,
                                      timestamp: msg.timestamp,
                                      caption: msg.text,
                                      messageId: msg.id,
                                    })
                                  }
                                  aria-label="View image in full size"
                                  title="Click to view full image"
                                  className="group relative block w-full overflow-hidden rounded-xl cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390EC]"
                                >
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Telegram attachment"
                                    referrerPolicy="no-referrer"
                                    className="max-h-60 w-full object-cover rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
                                  />
                                  <span className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center shadow-md">
                                      <ZoomIn className="w-4 h-4" />
                                    </span>
                                  </span>
                                </button>
                              </div>
                            )}

                            {/* Message Text + Inline Telegram Timestamp & Read Receipts */}
                            <div
                              dir={
                                msg.translatedLang && getLanguageByCode(msg.translatedLang).rtl
                                  ? 'rtl'
                                  : undefined
                              }
                              className="text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                            >
                              {msg.text && renderFormattedText(msg.text)}
                              <span className="inline-flex items-center gap-1 float-right ml-3 mt-1.5 text-[10px] tabular-nums select-none">
                                {msg.isPinned && <Pin className="w-2.5 h-2.5 opacity-65" />}
                                <span className="opacity-65">{formatMessageTime(msg.timestamp)}</span>
                                {isAgent &&
                                  (onUpdateMessageStatus ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateMessageStatus(
                                          activeContact.id,
                                          msg.id,
                                          msg.status === 'read' ? 'sent' : 'read'
                                        )
                                      }
                                      title={
                                        msg.status === 'read'
                                          ? 'Read — click to mark as sent'
                                          : 'Sent — click to mark as read'
                                      }
                                      className="inline-flex items-center rounded hover:bg-black/10 dark:hover:bg-white/10 p-0.5 -mr-0.5 transition-colors"
                                    >
                                      <ReadReceiptIndicator status={msg.status} />
                                    </button>
                                  ) : (
                                    <ReadReceiptIndicator status={msg.status} />
                                  ))}
                              </span>
                            </div>

                            {msg.originalText && msg.translatedLang && (
                              <div
                                data-no-translate="true"
                                className="mt-1 pt-1 border-t border-black/10 dark:border-white/10 text-[10px] opacity-80 leading-snug"
                              >
                                <span className="font-semibold">
                                  Sent in {getLanguageByCode(msg.translatedLang).name}
                                </span>
                                <span className="mx-1">·</span>
                                <span className="opacity-85">Original: {msg.originalText}</span>
                              </div>
                            )}

                            {/* Google Translation Overlay (Bengali, English & all 249 languages) */}
                            {trans?.loading && (
                              <div
                                data-no-translate="true"
                                className="mt-2 pt-1.5 border-t border-black/10 dark:border-white/10 flex items-center gap-1.5 text-[11px] opacity-80"
                              >
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>
                                  Translating to {getLanguageByCode(trans.targetLang).name}...
                                </span>
                              </div>
                            )}

                            {trans && !trans.loading && trans.text && (
                              <div
                                data-no-translate="true"
                                dir={getLanguageByCode(trans.targetLang).rtl ? 'rtl' : 'ltr'}
                                className="mt-2 pt-1.5 border-t border-black/10 dark:border-white/10 text-[12px]"
                              >
                                <div className="flex items-center justify-between gap-2 text-[10px] opacity-80 mb-0.5">
                                  <span className="font-semibold">
                                    {getLanguageByCode(trans.targetLang).name} Translation
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleHideMessageTranslation(msg.id)}
                                    className="hover:underline text-[10px] opacity-85"
                                  >
                                    Hide
                                  </button>
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap break-words">
                                  {trans.text}
                                </p>
                              </div>
                            )}

                            {/* Direct Chat-Body Message Translator Bar (Inside Bubble) */}
                            {msg.text && msg.text.trim() && (
                              <div
                                data-no-translate="true"
                                className={`mt-1.5 pt-1 border-t flex items-center justify-between gap-2 text-[10px] ${
                                  isAgent
                                    ? 'border-black/10 dark:border-white/15 text-neutral-700 dark:text-sky-100/85'
                                    : isBot
                                    ? 'border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-200'
                                    : 'border-neutral-200/70 dark:border-white/10 text-neutral-500 dark:text-neutral-300'
                                }`}
                              >
                                <div className="flex items-center gap-1 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTranslateMessage(
                                        msg.id,
                                        msg.text,
                                        trans && !trans.loading
                                          ? trans.targetLang === 'en'
                                            ? 'bn'
                                            : 'en'
                                          : preferredChatTranslateLang
                                      )
                                    }
                                    title="Quick translate message"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 font-medium transition-colors"
                                  >
                                    <Languages className="w-3 h-3 text-[#3390EC] dark:text-sky-300" />
                                    <span>
                                      {trans && !trans.loading
                                        ? trans.targetLang === 'en'
                                          ? 'To Bengali'
                                          : 'To English'
                                        : `Translate (${getLanguageByCode(preferredChatTranslateLang).name})`}
                                    </span>
                                  </button>
                                </div>

                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenBubbleLangPickerId((cur) =>
                                        cur === msg.id ? null : msg.id
                                      )
                                    }
                                    title="Choose any language (Bengali, English & 249 languages)"
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 font-medium transition-colors"
                                  >
                                    <span>
                                      {trans && !trans.loading
                                        ? getLanguageByCode(trans.targetLang).name
                                        : 'Language'}
                                    </span>
                                    <ChevronDown className="w-3 h-3" />
                                  </button>

                                  {openBubbleLangPickerId === msg.id && (
                                    <ChatLanguagePicker
                                      activeCode={trans?.targetLang}
                                      align={isAgent ? 'right' : 'left'}
                                      openUpward={msgIdx >= Math.max(1, visibleMessages.length - 2)}
                                      title="Translate Message To"
                                      showOriginalOption={Boolean(trans)}
                                      onSelectOriginal={() => handleHideMessageTranslation(msg.id)}
                                      onSelect={(code) =>
                                        handleTranslateMessage(msg.id, msg.text, code)
                                      }
                                      onClose={() => setOpenBubbleLangPickerId(null)}
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Selected Emoji Reactions Row */}
                          {reactions.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 px-1">
                              {reactions.map(([emoji, count]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => onReactMessage?.(activeContact.id, msg.id, emoji)}
                                  className="px-2 py-0.5 rounded-full text-[11px] bg-white/90 dark:bg-[#17212B] border border-neutral-200 dark:border-[#242F3D] shadow-sm flex items-center gap-1"
                                >
                                  <span>{emoji}</span>
                                  <span className="text-[10px] font-semibold tabular-nums text-[#3390EC]">
                                    {count}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {isCustomerTyping && (
                    <div className="flex items-start" role="status" aria-live="polite">
                      <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white dark:bg-[#182533] text-xs text-neutral-600 dark:text-neutral-300 shadow-sm inline-flex items-center gap-2">
                        <TypingDots dotClass="bg-[#3390EC]" />
                        <span className="text-[11px] font-medium">{activeContact.name} is typing</span>
                      </div>
                    </div>
                  )}

                  {(isUserbotTyping || replyTranslating) && (
                    <div className="flex items-end justify-end" role="status" aria-live="polite">
                      <div className="px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-[#EEFFDE]/95 dark:bg-[#2B5278]/95 text-xs text-neutral-700 dark:text-sky-100 shadow-sm inline-flex items-center gap-2">
                        <span className="text-[11px] font-medium">
                          {initiatingSession?.label || 'Userbot'} typing
                        </span>
                        <TypingDots dotClass="bg-emerald-600 dark:bg-sky-300" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* COMPOSER DOCK (Real Telegram Style) */}
                <div className="shrink-0 bg-white dark:bg-[#17212B] border-t border-neutral-200 dark:border-[#0E1621] relative z-20">
                  {/* Per-Chat Outgoing Send Language Selector Bar */}
                  <div
                    data-no-translate="true"
                    className="px-3 py-1.5 border-b border-neutral-100 dark:border-[#0E1621] bg-neutral-50/80 dark:bg-[#141E27] flex flex-wrap items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="flex items-center gap-2 relative min-w-0">
                      <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400 font-medium shrink-0">
                        <Globe2 className="w-3.5 h-3.5 text-[#3390EC]" />
                        <span className="hidden sm:inline">Send Language:</span>
                      </span>

                      <button
                        type="button"
                        disabled={isOptedOut}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setSendLangPickerOpen((v) => !v)}
                        title={`Select outgoing send language for ${activeContact.name}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-semibold border transition-colors disabled:opacity-40 ${
                          activeSendLang
                            ? 'bg-[#3390EC]/15 border-[#3390EC]/40 text-[#1b6ec2] dark:text-sky-300'
                            : 'bg-white dark:bg-[#1E2C3A] border-neutral-200 dark:border-[#2B394A] text-neutral-700 dark:text-neutral-200 hover:border-[#3390EC]/50'
                        }`}
                      >
                        <span className="truncate max-w-[160px]">
                          {activeSendLang
                            ? `${getLanguageByCode(activeSendLang).name} (Auto-Translate)`
                            : 'Original (As Typed)'}
                        </span>
                        <ChevronDown className="w-3 h-3 shrink-0 opacity-75" />
                      </button>

                      {activeSendLang && (
                        <button
                          type="button"
                          onClick={() => handleSetChatSendLang(activeContact.id, null)}
                          title="Reset this chat back to Original (As Typed)"
                          className="p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {sendLangPickerOpen && (
                        <ChatLanguagePicker
                          activeCode={activeSendLang || undefined}
                          align="left"
                          openUpward={true}
                          title={`Send Language for ${activeContact.name}`}
                          showOriginalOption={true}
                          onSelectOriginal={() => handleSetChatSendLang(activeContact.id, null)}
                          onSelect={(code) => handleSetChatSendLang(activeContact.id, code)}
                          onClose={() => setSendLangPickerOpen(false)}
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isOptedOut}
                        onClick={() => handleSetChatSendLang(activeContact.id, null)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                          !activeSendLang
                            ? 'border-[#3390EC] bg-[#3390EC]/15 text-[#3390EC] font-semibold'
                            : 'border-neutral-200 dark:border-[#2B394A] bg-white dark:bg-[#1E2C3A] text-neutral-600 dark:text-neutral-300 hover:border-[#3390EC]/40'
                        }`}
                      >
                        Original
                      </button>
                      <button
                        type="button"
                        disabled={isOptedOut}
                        onClick={() => handleSetChatSendLang(activeContact.id, 'bn')}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                          activeSendLang === 'bn'
                            ? 'border-[#3390EC] bg-[#3390EC]/15 text-[#3390EC] font-semibold'
                            : 'border-neutral-200 dark:border-[#2B394A] bg-white dark:bg-[#1E2C3A] text-neutral-600 dark:text-neutral-300 hover:border-[#3390EC]/40'
                        }`}
                      >
                        Bengali
                      </button>
                      <button
                        type="button"
                        disabled={isOptedOut}
                        onClick={() => handleSetChatSendLang(activeContact.id, 'en')}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                          activeSendLang === 'en'
                            ? 'border-[#3390EC] bg-[#3390EC]/15 text-[#3390EC] font-semibold'
                            : 'border-neutral-200 dark:border-[#2B394A] bg-white dark:bg-[#1E2C3A] text-neutral-600 dark:text-neutral-300 hover:border-[#3390EC]/40'
                        }`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        disabled={isOptedOut}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setSendLangPickerOpen((v) => !v)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium border border-neutral-200 dark:border-[#2B394A] bg-white dark:bg-[#1E2C3A] text-neutral-600 dark:text-neutral-300 hover:border-[#3390EC]/40"
                      >
                        +249
                      </button>
                    </div>
                  </div>

                  {/* Reply Preview Strip */}
                  {replyingTo && (
                    <div className="px-4 py-2 border-b border-neutral-100 dark:border-[#0E1621] flex items-center justify-between gap-3 bg-neutral-50/70 dark:bg-[#1E2C3A]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Reply className="w-4 h-4 text-[#3390EC] flex-shrink-0" />
                        <div className="min-w-0 pl-2 border-l-2 border-[#3390EC]">
                          <div className="text-[11px] font-semibold text-[#3390EC] truncate">
                            Reply to {replyingTo.senderName}
                          </div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                            {replyingTo.text}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Attachment Preview Strip */}
                  {pendingAttachment && (
                    <div className="px-4 py-2 border-b border-neutral-100 dark:border-[#0E1621] flex items-center justify-between gap-3 bg-sky-50/60 dark:bg-[#1E2C3A]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {pendingAttachment.type === 'photo' && pendingAttachment.url ? (
                          <button
                            type="button"
                            onClick={() =>
                              openImagePreview({
                                url: pendingAttachment.url!,
                                name: pendingAttachment.name,
                                size: pendingAttachment.size,
                                senderName: currentUser.name,
                                caption: chatInputText || undefined,
                              })
                            }
                            title="Preview image"
                            className="relative group rounded-lg overflow-hidden cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390EC]"
                          >
                            <img
                              src={pendingAttachment.url}
                              alt={pendingAttachment.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                              <ZoomIn className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </button>
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-[#3390EC] text-white flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                            {pendingAttachment.name}
                          </div>
                          <div className="text-[10px] text-neutral-500">{pendingAttachment.size}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingAttachment(null)}
                        className="text-neutral-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Translated Reply Preview Strip */}
                  {translatedReplyPreview && (
                    <div
                      data-no-translate="true"
                      className="px-4 py-2 border-b border-neutral-100 dark:border-[#0E1621] flex items-center justify-between gap-3 bg-emerald-50/70 dark:bg-[#1B2B2B]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <Languages className="w-3 h-3" />
                          <span>
                            {getLanguageByCode(translatedReplyPreview.targetLang).name} Draft Preview
                          </span>
                        </div>
                        <div
                          dir={
                            getLanguageByCode(translatedReplyPreview.targetLang).rtl ? 'rtl' : 'ltr'
                          }
                          className="text-xs text-neutral-800 dark:text-neutral-100 mt-0.5 whitespace-pre-wrap break-words"
                        >
                          {translatedReplyPreview.text}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setChatInputText(translatedReplyPreview.text);
                            setTranslatedReplyPreview(null);
                            textareaRef.current?.focus();
                          }}
                          className="text-[11px] px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => setTranslatedReplyPreview(null)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
                          title="Dismiss preview"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Formatting & Google Translate Mini Bar */}
                  {formatBarOpen && (
                    <div className="px-4 py-1.5 border-b border-neutral-100 dark:border-[#0E1621] flex flex-wrap items-center justify-between gap-2 bg-neutral-50 dark:bg-[#1E2C3A] text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => applyFormat('**')}
                          className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-[#242F3D] text-neutral-700 dark:text-neutral-200"
                          title="Bold (**text**)"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFormat('__')}
                          className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-[#242F3D] text-neutral-700 dark:text-neutral-200"
                          title="Italic (__text__)"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFormat('`')}
                          className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-[#242F3D] text-neutral-700 dark:text-neutral-200"
                          title="Monospace (`code`)"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 relative">
                        <Languages className="w-3.5 h-3.5 text-[#3390EC]" />
                        <button
                          type="button"
                          onClick={() => handleTranslateReplyBeforeSend('en')}
                          disabled={!chatInputText.trim() || replyTranslating || isOptedOut}
                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-white dark:bg-[#242F3D] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 disabled:opacity-40"
                        >
                          {replyTranslating ? '...' : '→ EN'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTranslateReplyBeforeSend('bn')}
                          disabled={!chatInputText.trim() || replyTranslating || isOptedOut}
                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-white dark:bg-[#242F3D] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 disabled:opacity-40"
                        >
                          {replyTranslating ? '...' : '→ BN'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposerLangPickerOpen((v) => !v)}
                          disabled={!chatInputText.trim() || replyTranslating || isOptedOut}
                          className="inline-flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 rounded bg-white dark:bg-[#242F3D] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 disabled:opacity-40"
                        >
                          <span>Any</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {composerLangPickerOpen && (
                          <div className="absolute bottom-full right-0 mb-2 z-40">
                            <ChatLanguagePicker
                              activeCode={translatedReplyPreview?.targetLang}
                              align="right"
                              title="Translate Reply To"
                              onSelect={(code) => handleTranslateReplyBeforeSend(code)}
                              onClose={() => setComposerLangPickerOpen(false)}
                            />
                          </div>
                        )}
                        {translatedReplyPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setChatInputText(translatedReplyPreview.text);
                              setTranslatedReplyPreview(null);
                            }}
                            className="text-[11px] px-2 py-0.5 rounded bg-emerald-600 text-white font-semibold"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Telegram Emoji & Stickers Popover */}
                  {emojiOpen && (
                    <div className="absolute bottom-16 left-3 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#17212B] border border-neutral-200 dark:border-[#0E1621] rounded-2xl shadow-2xl overflow-hidden z-30">
                      <div className="p-2 border-b border-neutral-100 dark:border-[#0E1621] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => setEmojiPanelTab('emoji')}
                            className={`px-2.5 py-1 rounded-lg ${
                              emojiPanelTab === 'emoji'
                                ? 'bg-[#3390EC] text-white'
                                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                            }`}
                          >
                            Emoji
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmojiPanelTab('templates')}
                            className={`px-2.5 py-1 rounded-lg ${
                              emojiPanelTab === 'templates'
                                ? 'bg-[#3390EC] text-white'
                                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                            }`}
                          >
                            Quick Replies
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEmojiOpen(false)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {emojiPanelTab === 'emoji' ? (
                        <>
                          <div className="px-2.5 pt-2">
                            <input
                              type="text"
                              value={emojiSearch}
                              onChange={(e) => setEmojiSearch(e.target.value)}
                              placeholder="Filter emojis..."
                              className="w-full px-2.5 py-1 text-xs rounded-lg bg-neutral-100 dark:bg-[#242F3D] text-neutral-900 dark:text-white focus:outline-none"
                            />
                          </div>
                          {!emojiSearch && (
                            <div className="flex items-center gap-1 px-2.5 pt-2 overflow-x-auto text-[11px]">
                              {EMOJI_CATEGORIES.map((cat) => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => setEmojiCategory(cat.id)}
                                  className={`px-2 py-0.5 rounded whitespace-nowrap ${
                                    emojiCategory === cat.id
                                      ? 'bg-sky-500/15 text-[#3390EC] font-semibold'
                                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                  }`}
                                >
                                  {cat.label}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="p-2.5 grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
                            {activeEmojiList.map((emoji, idx) => (
                              <button
                                key={`${emoji}-${idx}`}
                                type="button"
                                onClick={() => insertAtCursor(emoji)}
                                className="h-8 w-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#242F3D] flex items-center justify-center text-lg transition-transform hover:scale-110"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="p-2 max-h-60 overflow-y-auto divide-y divide-neutral-100 dark:divide-[#0E1621]">
                          {cannedReplies.map((item) => (
                            <button
                              key={item.cmd}
                              type="button"
                              onClick={() => {
                                setChatInputText(item.text);
                                setEmojiOpen(false);
                                textareaRef.current?.focus();
                              }}
                              className="w-full text-left p-2 hover:bg-neutral-50 dark:hover:bg-[#242F3D] rounded-lg"
                            >
                              <div className="text-[11px] font-semibold text-[#3390EC]">
                                {item.cmd} · {item.label}
                              </div>
                              <div className="text-[11px] text-neutral-600 dark:text-neutral-300 line-clamp-2 mt-0.5">
                                {item.text}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Telegram Attachment Popover */}
                  {attachMenuOpen && (
                    <div className="absolute bottom-16 right-12 w-56 bg-white dark:bg-[#17212B] border border-neutral-200 dark:border-[#0E1621] rounded-xl shadow-xl py-1.5 z-30 text-xs">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                      >
                        <ImageIcon className="w-4 h-4 text-sky-500" />
                        <span>Photo or Image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => docInputRef.current?.click()}
                        className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                      >
                        <FileText className="w-4 h-4 text-emerald-500" />
                        <span>Document / File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const order = activeContact.customFields?.Order_Number || 'ORD-9042';
                          const tier = activeContact.customFields?.Customer_Tier || 'Priority';
                          setChatInputText(
                            `📦 **Order Summary**\nCustomer: ${activeContact.name}\nOrder ID: \`${order}\`\nTier: ${tier}`
                          );
                          setAttachMenuOpen(false);
                          textareaRef.current?.focus();
                        }}
                        className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-neutral-100 dark:hover:bg-[#242F3D] text-neutral-800 dark:text-neutral-100"
                      >
                        <Package className="w-4 h-4 text-amber-500" />
                        <span>Insert Order Card</span>
                      </button>
                    </div>
                  )}

                  {/* Slash Commands Popover */}
                  {slashMenuOpen && (
                    <div className="absolute bottom-16 left-4 right-4 max-w-md bg-white dark:bg-[#17212B] border border-neutral-200 dark:border-[#0E1621] rounded-xl shadow-xl py-1.5 z-30 text-xs">
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase text-neutral-400">
                        Telegram Quick Commands
                      </div>
                      {cannedReplies.map((item) => (
                        <button
                          key={item.cmd}
                          type="button"
                          onClick={() => {
                            setChatInputText(item.text);
                            setSlashMenuOpen(false);
                            textareaRef.current?.focus();
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-[#242F3D] flex items-center justify-between gap-2"
                        >
                          <span className="font-mono text-[#3390EC] font-semibold">{item.cmd}</span>
                          <span className="text-neutral-500 dark:text-neutral-300 truncate">{item.text}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input Row */}
                  {isRecordingVoice ? (
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecordingVoice(false);
                          setVoiceSeconds(0);
                        }}
                        className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Discard recording"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2 text-xs font-medium text-neutral-800 dark:text-neutral-100 tabular-nums">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span>
                          Recording voice note... {Math.floor(voiceSeconds / 60)}:
                          {String(voiceSeconds % 60).padStart(2, '0')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendVoiceNote}
                        className="w-9 h-9 rounded-full bg-[#3390EC] hover:bg-sky-500 text-white flex items-center justify-center shadow-sm"
                        title="Send voice note"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="px-2.5 py-2 flex items-end gap-1.5">
                      <button
                        type="button"
                        disabled={isOptedOut}
                        onClick={() => {
                          setEmojiOpen((v) => !v);
                          setAttachMenuOpen(false);
                        }}
                        className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
                          emojiOpen
                            ? 'text-[#3390EC] bg-sky-500/10'
                            : 'text-neutral-500 hover:text-[#3390EC] hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                        }`}
                        title="Emoji & Quick Replies"
                      >
                        <Smile className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        disabled={isOptedOut}
                        onClick={() => setSlashMenuOpen((v) => !v)}
                        className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
                          slashMenuOpen
                            ? 'text-[#3390EC] bg-sky-500/10'
                            : 'text-neutral-500 hover:text-[#3390EC] hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                        }`}
                        title="Slash Quick Commands (/)"
                      >
                        <Slash className="w-4 h-4" />
                      </button>

                      <textarea
                        ref={textareaRef}
                        rows={1}
                        disabled={isOptedOut}
                        value={chatInputText}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          isOptedOut
                            ? 'Outbound replies disabled (Contact Opted Out)'
                            : activeSendLang
                            ? `Write reply for ${activeContact.name} (auto-sends in ${getLanguageByCode(activeSendLang).name})...`
                            : 'Write an immediate reply... (Enter = Send, Shift+Enter = New Line)'
                        }
                        className="flex-1 max-h-32 py-2 px-2 text-[13px] bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 resize-none focus:outline-none disabled:opacity-50"
                      />

                      <button
                        type="button"
                        disabled={isOptedOut}
                        onClick={() => setFormatBarOpen((v) => !v)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${
                          formatBarOpen
                            ? 'text-[#3390EC] bg-sky-500/10'
                            : 'text-neutral-500 hover:text-[#3390EC] hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                        }`}
                        title="Formatting & Google Translate"
                      >
                        Aa
                      </button>

                      <button
                        type="button"
                        disabled={isOptedOut}
                        onClick={() => {
                          setAttachMenuOpen((v) => !v);
                          setEmojiOpen(false);
                        }}
                        className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
                          attachMenuOpen
                            ? 'text-[#3390EC] bg-sky-500/10'
                            : 'text-neutral-500 hover:text-[#3390EC] hover:bg-neutral-100 dark:hover:bg-[#242F3D]'
                        }`}
                        title="Attach Photo, File or Order Card"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>

                      {chatInputText.trim() || pendingAttachment ? (
                        <button
                          type="button"
                          disabled={isOptedOut || isSendingTranslated}
                          onClick={triggerSend}
                          className="w-9 h-9 rounded-full bg-[#3390EC] hover:bg-sky-500 text-white flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 disabled:opacity-60"
                          title={
                            activeSendLang
                              ? `Translate to ${getLanguageByCode(activeSendLang).name} & Send (Enter)`
                              : 'Send (Enter)'
                          }
                        >
                          {isSendingTranslated ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isOptedOut}
                          onClick={() => {
                            setVoiceSeconds(0);
                            setIsRecordingVoice(true);
                          }}
                          className="w-9 h-9 rounded-full text-neutral-500 hover:text-[#3390EC] hover:bg-neutral-100 dark:hover:bg-[#242F3D] flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                          title="Record Voice Note"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400 text-xs p-6 text-center gap-2">
                {showArchived ? (
                  <>
                    <Archive className="w-8 h-8 mb-1 stroke-1 text-neutral-400" />
                    <p>
                      No archived conversations yet. Archive inactive threads to keep your inbox organized.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowArchived(false)}
                      className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3390EC] text-white text-xs font-medium hover:bg-sky-500 transition-colors"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      <span>Return to Active Inbox</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Globe2 className="w-8 h-8 mb-1 stroke-1" />
                    <p>
                      {isModerator
                        ? 'No assigned conversations yet. Ask an Admin to route threads to you.'
                        : 'Select a Telegram conversation to start chatting.'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* TELEGRAM RIGHT CONTACT PROFILE DRAWER */}
          {profileOpen && activeContact && (
            <div className="hidden md:flex w-72 border-l border-neutral-200 dark:border-[#0E1621] bg-white dark:bg-[#17212B] flex-col h-full min-h-0 overflow-y-auto">
              <div className="p-4 border-b border-neutral-100 dark:border-[#0E1621] flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 dark:text-white">User Info</span>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 flex flex-col items-center text-center border-b border-neutral-100 dark:border-[#0E1621]">
                <div
                  className={`w-16 h-16 rounded-full font-bold flex items-center justify-center text-xl mb-3 ${getAvatarTone(
                    activeContact.id
                  )}`}
                >
                  {activeContact.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-sm font-bold text-neutral-900 dark:text-white">
                  {activeContact.name}
                </div>
                <div className="text-xs text-neutral-500 font-mono mt-0.5">{activeContact.phoneNumber}</div>
                {activeContact.telegramUsername && (
                  <div className="text-xs text-[#3390EC] font-mono mt-0.5">
                    @{activeContact.telegramUsername}
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Userbot Thread</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {initiatingSession?.label || 'Userbot #1'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Consent Status</div>
                  <div
                    className={`font-semibold mt-0.5 ${
                      isOptedOut ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {activeContact.optInStatus}
                  </div>
                </div>
                {activeContact.company && (
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase">Company</div>
                    <div className="text-neutral-800 dark:text-neutral-200 mt-0.5">
                      {activeContact.company}
                    </div>
                  </div>
                )}
                {activeContact.customFields && Object.keys(activeContact.customFields).length > 0 && (
                  <div className="pt-2 border-t border-neutral-100 dark:border-[#0E1621] space-y-2">
                    <div className="text-[10px] text-neutral-400 uppercase">Custom CSV Fields</div>
                    {Object.entries(activeContact.customFields).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-neutral-500">{k}</span>
                        <span className="font-mono text-neutral-900 dark:text-neutral-100">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TELEGRAM FULL-SIZE IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.name || 'Image Preview'}
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col justify-between select-none"
        >
          {/* Top Modal Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 bg-gradient-to-b from-black/80 to-transparent text-white"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {previewImage.senderName || previewImage.name}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/70 truncate">
                <span className="truncate max-w-[220px] sm:max-w-xs">{previewImage.name}</span>
                {previewImage.size && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{previewImage.size}</span>
                  </>
                )}
                {previewImage.timestamp && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{previewImage.timestamp.slice(0, 5)}</span>
                  </>
                )}
                {currentPreviewIndex >= 0 && threadPhotos.length > 1 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums text-sky-300">
                      {currentPreviewIndex + 1} / {threadPhotos.length}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                disabled={previewZoom <= 0.5}
                className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 disabled:opacity-35 transition-colors"
                title="Zoom out (-)"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setPreviewZoom(1)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium tabular-nums text-white/85 hover:text-white hover:bg-white/10 transition-colors"
                title="Reset zoom (100%)"
              >
                {Math.round(previewZoom * 100)}%
              </button>

              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                disabled={previewZoom >= 3}
                className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 disabled:opacity-35 transition-colors"
                title="Zoom in (+)"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {previewZoom !== 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewZoom(1)}
                  className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors"
                  title="Reset zoom"
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <a
                href={previewImage.url}
                download={previewImage.name || 'telegram-image'}
                className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors"
                title="Download image"
                aria-label="Download"
              >
                <Download className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/15 transition-colors ml-1"
                title="Close (Esc)"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Image Stage */}
          <div className="relative flex-1 flex items-center justify-center px-4 sm:px-14 py-2 overflow-auto">
            {currentPreviewIndex >= 0 && threadPhotos.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePreviewPhoto(-1);
                }}
                className="absolute left-3 sm:left-5 z-10 w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390EC]"
                title="Previous image (←)"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center max-w-full max-h-full"
            >
              {previewLoadError ? (
                <div className="flex flex-col items-center justify-center gap-3 px-8 py-10 rounded-2xl bg-neutral-900 border border-white/10 text-white/80">
                  <ImageIcon className="w-10 h-10 text-[#3390EC]" />
                  <div className="text-sm font-medium">{previewImage.name}</div>
                  <div className="text-xs text-white/55">
                    Unable to load full-size image.
                  </div>
                </div>
              ) : (
                <img
                  src={previewImage.url}
                  alt={previewImage.name}
                  referrerPolicy="no-referrer"
                  onError={() => setPreviewLoadError(true)}
                  onClick={() => setPreviewZoom((z) => (z === 1 ? 1.75 : 1))}
                  style={{ transform: `scale(${previewZoom})` }}
                  className={`max-w-[90vw] max-h-[76vh] object-contain rounded-lg shadow-2xl transition-transform duration-200 ${
                    previewZoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
                  }`}
                />
              )}
            </div>

            {currentPreviewIndex >= 0 && threadPhotos.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePreviewPhoto(1);
                }}
                className="absolute right-3 sm:right-5 z-10 w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390EC]"
                title="Next image (→)"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Bottom Caption & Thread Photo Strip */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="px-4 sm:px-6 py-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex flex-col items-center gap-2.5"
          >
            {previewImage.caption && (
              <p className="max-w-2xl text-center text-[13px] leading-relaxed text-white/95 line-clamp-3">
                {previewImage.caption}
              </p>
            )}

            {currentPreviewIndex >= 0 && threadPhotos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
                {threadPhotos.map((photo, idx) => (
                  <button
                    key={photo.messageId}
                    type="button"
                    onClick={() => openImagePreview(photo)}
                    className={`w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 transition-transform ${
                      idx === currentPreviewIndex
                        ? 'ring-2 ring-[#3390EC] scale-105 opacity-100'
                        : 'opacity-55 hover:opacity-90'
                    }`}
                    title={photo.name}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
