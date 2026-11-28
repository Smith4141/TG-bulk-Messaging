import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../types';

interface NotificationBellProps {
  variant: 'header' | 'dark';
  notifications: AppNotification[];
  readIds: string[];
  dismissedIds: string[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onRestoreDismissed: () => void;
  onSelectNotification: (notif: AppNotification) => void;
  desktopEnabled: boolean;
  onToggleDesktopAlerts: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  approval: 'Approval',
  chat: 'Live Chat',
  campaign: 'Campaign',
  session: 'Session',
  compliance: 'Compliance',
  webhook: 'Webhook',
  system: 'System',
};

const SEVERITY_DOT: Record<AppNotification['severity'], string> = {
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  variant,
  notifications,
  readIds,
  dismissedIds,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onDismissAll,
  onRestoreDismissed,
  onSelectNotification,
  desktopEnabled,
  onToggleDesktopAlerts,
  soundEnabled,
  onToggleSound,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const dismissedSet = useMemo(() => new Set(dismissedIds), [dismissedIds]);

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => !dismissedSet.has(n.id)),
    [notifications, dismissedSet]
  );

  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !readSet.has(n.id)).length,
    [visibleNotifications, readSet]
  );

  const displayedNotifications = useMemo(
    () =>
      filter === 'unread'
        ? visibleNotifications.filter((n) => !readSet.has(n.id))
        : visibleNotifications,
    [visibleNotifications, filter, readSet]
  );

  const buttonClasses =
    variant === 'dark'
      ? 'relative p-2 rounded-lg border border-slate-700/80 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors'
      : 'relative p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors';

  const formatTime = (iso: string) => {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return iso;
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className={buttonClasses}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl z-50 overflow-hidden text-left">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
                Notifications
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                {unreadCount} unread · {visibleNotifications.length} active
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleSound}
                title={soundEnabled ? 'Mute sound alerts' : 'Enable sound alerts'}
                className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-sky-500" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onToggleDesktopAlerts}
                title={desktopEnabled ? 'Desktop alerts active' : 'Enable desktop alerts'}
                className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {desktopEnabled ? (
                  <Bell className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <BellOff className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-2 bg-neutral-50 dark:bg-neutral-950/60">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2 py-1 rounded text-[11px] font-medium ${
                  filter === 'all'
                    ? 'bg-sky-600 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2 py-1 rounded text-[11px] font-medium ${
                  filter === 'unread'
                    ? 'bg-sky-600 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Read all</span>
                </button>
              )}
              {visibleNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={onDismissAll}
                  className="inline-flex items-center gap-1 text-neutral-500 hover:text-rose-500"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
              {dismissedIds.length > 0 && (
                <button
                  type="button"
                  onClick={onRestoreDismissed}
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restore</span>
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {displayedNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No {filter === 'unread' ? 'unread ' : ''}notifications right now.
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const isRead = readSet.has(notif.id);
                return (
                  <div
                    key={notif.id}
                    className={`px-3.5 py-2.5 flex items-start gap-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                      isRead ? 'opacity-75' : 'bg-sky-50/40 dark:bg-sky-950/15'
                    }`}
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[notif.severity]}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onMarkRead(notif.id);
                        onSelectNotification(notif);
                        setOpen(false);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          {CATEGORY_LABELS[notif.category]}
                        </span>
                        <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
                          {formatTime(notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-300 line-clamp-2">
                        {notif.message}
                      </p>
                    </button>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!isRead && (
                        <button
                          type="button"
                          onClick={() => onMarkRead(notif.id)}
                          title="Mark as read"
                          className="p-1 rounded text-neutral-400 hover:text-sky-600 dark:hover:text-sky-400"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDismiss(notif.id)}
                        title="Dismiss"
                        className="p-1 rounded text-neutral-400 hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
