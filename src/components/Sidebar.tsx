import React from 'react';
import {
  LayoutDashboard,
  Send,
  PhoneCall,
  Users,
  MessageSquare,
  Globe,
  HardDrive,
  ShieldCheck,
  FileText,
  Radio,
  Lock,
  LogOut,
  Layers,
} from 'lucide-react';
import { UserAccount } from '../types';
import { translations, SupportedLanguage } from '../translations';

export type TabId =
  | 'dashboard'
  | 'campaigns'
  | 'api_hub'
  | 'phone_filter'
  | 'contacts'
  | 'live_chat'
  | 'wordpress'
  | 'cloud_storage'
  | 'team_rbac'
  | 'audit_logs';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  lang: SupportedLanguage;
  currentUser: UserAccount;
  unreadChatCount?: number;
  activeCampaignCount?: number;
  onLogout?: () => void;
  width?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  lang,
  currentUser,
  unreadChatCount = 2,
  activeCampaignCount = 1,
  onLogout,
  width,
}) => {
  const t = translations.en;

  const allNavItems: { id: TabId; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'campaigns', label: t.campaigns, icon: Send, badge: activeCampaignCount },
    {
      id: 'api_hub',
      label: 'Messaging & API Hub',
      icon: Layers,
    },
    { id: 'phone_filter', label: t.phoneFilter, icon: PhoneCall },
    {
      id: 'contacts',
      label: t.contactManagement,
      icon: Users,
    },
    {
      id: 'live_chat',
      label: currentUser.role === 'moderator' ? 'Moderator Inbox' : 'Customer Live Chat',
      icon: MessageSquare,
      badge: unreadChatCount,
    },
    { id: 'wordpress', label: t.wordpress, icon: Globe },
    { id: 'cloud_storage', label: t.cloudStorage, icon: HardDrive },
    { id: 'team_rbac', label: t.teamRbac, icon: ShieldCheck },
    { id: 'audit_logs', label: 'Activity & Audit Logs', icon: FileText },
  ];

  // Strict RBAC Navigation Rules:
  // 1. Admin: Full Access (all 10 modules + Admin provisioning)
  // 2. Editor: Everything except Executive Dashboard (team_rbac for non-admins, live_chat, campaigns, api_hub, phone_filter, contacts, wordpress, cloud_storage, audit_logs)
  // 3. Moderator: Live customer chats & instant replies, bulk campaigns, phone filtering & Telegram verification
  // 4. Viewer: Live customer chat only (full-screen mode)
  const navItems = allNavItems.filter((item) => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'editor') return item.id !== 'dashboard';
    if (currentUser.role === 'moderator') {
      return (
        item.id === 'live_chat' ||
        item.id === 'campaigns' ||
        item.id === 'phone_filter'
      );
    }
    if (currentUser.role === 'viewer') {
      return item.id === 'live_chat';
    }
    return false;
  });

  const roleTitle =
    currentUser.role === 'admin'
      ? 'Admin Console'
      : currentUser.role === 'moderator'
      ? 'Moderator Inbox'
      : currentUser.role === 'editor'
      ? 'Editor Console'
      : 'Viewer Console';

  return (
    <aside
      style={width ? { width: `${width}px` } : undefined}
      className={`${width ? '' : 'w-64 '}flex-shrink-0 min-h-0 overflow-y-auto border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col justify-between select-none transition-[width] duration-75`}
    >
      <div className="py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
          {roleTitle}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-sky-500' : 'text-neutral-400 dark:text-neutral-500'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && Number(item.badge) > 0 && (
                <span
                  className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-sky-500 text-white'
                      : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Gateway & Security Status Card */}
      <div className="p-3 m-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-xs">
        <div className="flex items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium mb-1">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-500" />
            <span>Port {currentUser.assignedPort} Relay</span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">MTProto</span>
        </div>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-2">
          Multi-session MTProto Userbot gateway with thread-continuous Moderator routing.
        </p>
        <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200 dark:border-neutral-800/80 text-[10px] text-neutral-400">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-sky-500" />
            TLS 1.3 / AES-256
          </span>
          <span className="font-mono">v4.18.2</span>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-neutral-200/70 dark:bg-neutral-800/80 hover:bg-red-50 dark:hover:bg-red-950/40 text-neutral-700 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
};
