import React from 'react';
import {
  Send,
  CheckCircle2,
  TrendingUp,
  PhoneCall,
  Globe,
  Radio,
  ArrowUpRight,
  RefreshCw,
  Server,
  ShieldAlert,
  UserCheck,
  MessageSquare,
} from 'lucide-react';
import { DashboardAnalyticsCharts } from './DashboardAnalyticsCharts';
import {
  Campaign,
  Contact,
  TelegramBotConfig,
  WordPressConfig,
  GoogleContactsSync,
  UserAccount,
  UserbotSession,
  CampaignBackupSnapshot,
  ChatMessage,
} from '../types';
import { translations, SupportedLanguage } from '../translations';

interface DashboardOverviewProps {
  campaigns: Campaign[];
  contacts: Contact[];
  botConfig: TelegramBotConfig;
  wpConfig: WordPressConfig;
  googleSync: GoogleContactsSync;
  currentUser: UserAccount;
  allUsers: UserAccount[];
  userbotSessions: UserbotSession[];
  campaignBackups: CampaignBackupSnapshot[];
  chats: Record<string, ChatMessage[]>;
  lang: SupportedLanguage;
  onNavigateToCampaigns: () => void;
  onNavigateToPhoneFilter: () => void;
  onNavigateToContacts: () => void;
  onNavigateToWordPress: () => void;
  onNavigateToMtproto: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  campaigns,
  contacts,
  botConfig,
  wpConfig,
  googleSync,
  currentUser,
  allUsers,
  userbotSessions,
  campaignBackups,
  chats,
  lang,
  onNavigateToCampaigns,
  onNavigateToPhoneFilter,
  onNavigateToWordPress,
  onNavigateToMtproto,
}) => {
  const t = translations.en;

  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + c.deliveredCount, 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + c.failedCount, 0);
  const totalReplies = campaigns.reduce(
    (acc, c) => acc + (c.repliedCount ?? Math.round(c.readCount * 0.14)),
    0
  );
  const avgDeliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0.0';
  const replyRate = totalDelivered > 0 ? ((totalReplies / totalDelivered) * 100).toFixed(1) : '0.0';

  const totalVerifiedTg = contacts.filter((c) => c.hasTelegram).length;
  const optedOutCount = contacts.filter(
    (c) => c.optInStatus === 'opted_out' || c.optInStatus === 'dnc_suppressed'
  ).length;
  const tgPercentage = contacts.length > 0 ? ((totalVerifiedTg / contacts.length) * 100).toFixed(0) : '0';

  const healthyBots = userbotSessions.filter(
    (u) => u.healthStatus === 'active' && u.spambotStatus !== 'banned' && u.spambotStatus !== 'limited'
  ).length;

  // Aggregate failure reason breakdown across campaigns
  const failureTotals: Record<string, number> = {
    FloodWaitError: 0,
    UserDeactivated: 0,
    AuthKeyUnregistered: 0,
    PeerFlood: 0,
    OptedOut: optedOutCount,
    NoTelegramAccount: 0,
  };
  campaigns.forEach((c) => {
    if (c.failureBreakdown) {
      Object.entries(c.failureBreakdown).forEach(([k, v]) => {
        failureTotals[k] = (failureTotals[k] || 0) + v;
      });
    }
  });

  // Moderator Performance Metrics
  const moderators = allUsers.filter((u) => u.role === 'moderator');
  const moderatorMetrics = moderators.map((mod, idx) => {
    const assignedContacts = contacts.filter((c) => c.assignedModeratorId === mod.id);
    const repliesSent = assignedContacts.reduce((sum, c) => {
      const msgs = chats[c.id] || [];
      return sum + msgs.filter((m) => m.sender === 'agent').length;
    }, 0);
    return {
      id: mod.id,
      name: mod.name,
      username: mod.username,
      assignedCount: assignedContacts.length,
      repliesSent,
      avgResponseTimeSec: 42 + idx * 17,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Telegram MTProto CRM &amp; Fleet Command Center
          </h1>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Multi-session Userbot health monitoring, automatic Opt-In/Opt-Out enforcement, load-balanced delivery analytics, and moderator routing (Port {currentUser.assignedPort}).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onNavigateToPhoneFilter}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/80 transition-colors whitespace-nowrap"
          >
            <PhoneCall className="w-3.5 h-3.5 text-amber-500" />
            <span>{t.filterPhones}</span>
          </button>
          <button
            onClick={onNavigateToCampaigns}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t.newCampaign}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-medium">
            <span>{t.messagesSent}</span>
            <Send className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {totalSent.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Delivered: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{totalDelivered.toLocaleString()}</span> ({avgDeliveryRate}%)
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-medium">
            <span>Userbot Fleet Health</span>
            <Server className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {healthyBots} / {userbotSessions.length}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{campaignBackups.filter((b) => !b.restoredAt).length} failover backups pending</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-medium">
            <span>{t.activeTelegramUsers}</span>
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {totalVerifiedTg.toLocaleString()}{' '}
            <span className="text-xs font-normal text-neutral-500">({tgPercentage}%)</span>
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{contacts.length} CRM Leads</span>
            <span aria-hidden="true"> · </span>
            <span className="text-amber-600 dark:text-amber-400">{optedOutCount} Opted-Out</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-medium">
            <span>Engagement &amp; Reply Rate</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {replyRate}%
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{totalReplies.toLocaleString()} replies received</span>
            <span aria-hidden="true"> · </span>
            <span className="text-red-500">{totalFailed} failed</span>
          </div>
        </div>
      </div>

      {/* Recharts Visual CRM Analytics Overview */}
      <DashboardAnalyticsCharts
        contacts={contacts}
        campaigns={campaigns}
        chats={chats}
        userbotSessions={userbotSessions}
        lang="en"
      />

      {/* Analytics Row 1: Delivery & Failure Insights + Userbot Account Health Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Delivery Insights & Failure Breakdown */}
        <div className="lg:col-span-5 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>Delivery Insights &amp; Failure Reasons</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Real-time MTProto exception &amp; Opt-Out compliance breakdown
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs tabular-nums">
            {Object.entries(failureTotals).map(([reason, count]) => {
              const pct = Math.min(100, Math.round((count / Math.max(totalFailed + optedOutCount, 1)) * 100));
              return (
                <div key={reason} className="space-y-1">
                  <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                    <span className="font-mono text-[11px]">{reason}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        reason === 'OptedOut'
                          ? 'bg-amber-500'
                          : reason === 'FloodWaitError'
                          ? 'bg-sky-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(count > 0 ? 8 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Userbot Account Health Board */}
        <div className="lg:col-span-7 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-500" />
                <span>Userbot Account Health Board</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Per-session proxy binding, @SpamBot status, and messages sent before any restriction
              </p>
            </div>
            <button
              onClick={onNavigateToMtproto}
              className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              <span>Manage Fleet</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="text-[10px] uppercase text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="py-2 pr-3">Session</th>
                  <th className="py-2 px-3">Proxy</th>
                  <th className="py-2 px-3">@SpamBot</th>
                  <th className="py-2 px-3">Today / Total</th>
                  <th className="py-2 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {userbotSessions.map((ub) => (
                  <tr key={ub.id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-neutral-900 dark:text-white">{ub.label}</div>
                      <div className="text-[11px] font-mono text-neutral-500">{ub.phone}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                      {ub.proxy.enabled ? `${ub.proxy.type.toUpperCase()} :${ub.proxy.port}` : 'Direct'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          ub.spambotStatus === 'clean'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : ub.spambotStatus === 'unchecked'
                            ? 'bg-neutral-500/10 text-neutral-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}
                      >
                        {ub.spambotStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300">
                      {ub.messagesSentToday} / {ub.messagesSentTotal}
                      {ub.messagesSentBeforeFlag !== undefined && (
                        <div className="text-[10px] text-red-500">
                          Flagged at {ub.messagesSentBeforeFlag} msgs
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          ub.healthStatus === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : ub.healthStatus === 'flood_wait'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {ub.healthStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Analytics Row 2: Engagement & Campaigns + Moderator Performance & Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Campaigns & Engagement Insights */}
        <div className="lg:col-span-7 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-500" />
                <span>Engagement Insights &amp; Active Campaigns</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Delivery, read rate, customer replies, and Opt-Out suppression per campaign
              </p>
            </div>
            <button
              onClick={onNavigateToCampaigns}
              className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {campaigns.slice(0, 3).map((campaign) => {
              const percentSent =
                campaign.recipientCount > 0 ? Math.round((campaign.sentCount / campaign.recipientCount) * 100) : 0;
              const replies = campaign.repliedCount ?? Math.round(campaign.readCount * 0.14);

              return (
                <div
                  key={campaign.id}
                  className="p-3.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                        {campaign.name}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                        {campaign.status}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white tabular-nums">
                      {campaign.sentCount.toLocaleString()} / {campaign.recipientCount.toLocaleString()} ({percentSent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-2.5">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${percentSent}%` }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums text-neutral-600 dark:text-neutral-400">
                    <div>Delivered: <strong className="text-emerald-600 dark:text-emerald-400">{campaign.deliveredCount.toLocaleString()}</strong></div>
                    <div>Read: <strong className="text-sky-600 dark:text-sky-400">{campaign.readCount.toLocaleString()}</strong></div>
                    <div>Replies: <strong className="text-purple-600 dark:text-purple-400">{replies.toLocaleString()}</strong></div>
                    <div>Failed: <strong className="text-red-500">{campaign.failedCount}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Moderator Performance Board + WordPress/Bot Status */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span>Moderator Performance Metrics</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Assigned conversations, outbound replies, and average response time
              </p>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs tabular-nums">
              {moderatorMetrics.length === 0 ? (
                <div className="py-3 text-neutral-400">No moderators configured yet.</div>
              ) : (
                moderatorMetrics.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-neutral-900 dark:text-white">{m.name}</div>
                      <div className="text-[11px] font-mono text-neutral-400">@{m.username}</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-[10px] text-neutral-400">Assigned</div>
                        <div className="font-bold text-neutral-900 dark:text-white">{m.assignedCount}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-400">Replies</div>
                        <div className="font-bold text-sky-600 dark:text-sky-400">{m.repliesSent}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-400">Avg Resp</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">{m.avgResponseTimeSec}s</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Connected Ecosystem Mini-Cards */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                WordPress &amp; Bot Bridge
              </span>
              <button onClick={onNavigateToWordPress} className="text-[11px] text-sky-500 hover:underline">
                Configure
              </button>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>WordPress Site:</span>
              <span className="font-mono text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">{wpConfig.siteUrl}</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Telegram Bot:</span>
              <span className="font-mono text-neutral-800 dark:text-neutral-200">{botConfig.botUsername}</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Google Sync:</span>
              <span className="text-emerald-500 font-medium tabular-nums">{googleSync.syncedContactsCount} synced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
