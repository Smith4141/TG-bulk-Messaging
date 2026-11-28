import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { TrendingUp, Target, MessageSquare } from 'lucide-react';
import { Campaign, ChatMessage, Contact, UserbotSession } from '../types';
import { SupportedLanguage } from '../translations';

interface DashboardAnalyticsChartsProps {
  contacts: Contact[];
  campaigns: Campaign[];
  chats: Record<string, ChatMessage[]>;
  userbotSessions: UserbotSession[];
  lang: SupportedLanguage;
}

const CHART_COLORS = {
  primary: '#0284c7',
  secondary: '#10b981',
  accent: '#8b5cf6',
  warning: '#d97706',
  muted: '#64748b',
};

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  unit?: string;
}

const AnalyticsTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 shadow-sm text-xs tabular-nums">
      <div className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5 border-b border-neutral-100 dark:border-neutral-800 pb-1">
        {label}
      </div>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <span
                className="inline-block w-2 h-2 rounded-xs"
                style={{ backgroundColor: entry.color || CHART_COLORS.primary }}
              />
              {entry.name}
            </span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              {entry.unit || ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DashboardAnalyticsCharts: React.FC<DashboardAnalyticsChartsProps> = ({
  contacts,
  campaigns,
  chats,
  userbotSessions,
}) => {
  const [contactChartView, setContactChartView] = useState<'trend' | 'stages'>('trend');
  const [volumeChartView, setVolumeChartView] = useState<'sources' | 'sessions'>('sources');

  // 1. Contact Growth Trend (derived chronologically from contacts[].createdAt)
  const contactTrendData = useMemo(() => {
    if (contacts.length === 0) return [];

    const buckets = new Map<string, { sortKey: string; label: string; added: number; verifiedAdded: number }>();

    contacts.forEach((c) => {
      const date = new Date(c.createdAt || Date.now());
      const valid = !Number.isNaN(date.getTime());
      const year = valid ? date.getUTCFullYear() : 2026;
      const month = valid ? date.getUTCMonth() + 1 : 10;
      const sortKey = `${year}-${String(month).padStart(2, '0')}`;
      const label = valid
        ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : 'Current';

      const prev = buckets.get(sortKey) || { sortKey, label, added: 0, verifiedAdded: 0 };
      prev.added += 1;
      if (c.hasTelegram) prev.verifiedAdded += 1;
      buckets.set(sortKey, prev);
    });

    const sorted = Array.from(buckets.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    let runningTotal = 0;
    let runningVerified = 0;

    return sorted.map((b) => {
      runningTotal += b.added;
      runningVerified += b.verifiedAdded;
      return {
        period: b.label,
        totalContacts: runningTotal,
        verifiedTelegram: runningVerified,
        newContacts: b.added,
      };
    });
  }, [contacts]);

  const contactStageData = useMemo(() => {
    const stageOrder: Array<{ key: Contact['stage']; label: string }> = [
      { key: 'lead', label: 'Lead' },
      { key: 'contacted', label: 'Contacted' },
      { key: 'qualified', label: 'Qualified' },
      { key: 'opportunity', label: 'Opportunity' },
      { key: 'customer', label: 'Customer' },
      { key: 'churned', label: 'Churned' },
    ];
    return stageOrder.map((st) => ({
      stage: st.label,
      count: contacts.filter((c) => c.stage === st.key).length,
      verified: contacts.filter((c) => c.stage === st.key && c.hasTelegram).length,
    }));
  }, [contacts]);

  // 2. Campaign Conversion Rate (per campaign delivery, read, and conversion/reply % from App.tsx campaigns)
  const campaignConversionData = useMemo(() => {
    return campaigns.slice(0, 6).map((c) => {
      const base = Math.max(c.sentCount, c.recipientCount, 1);
      const deliveredBase = Math.max(c.deliveredCount, 1);
      const replies = c.repliedCount ?? Math.round(c.readCount * 0.14);
      const conversions = c.clickedCount > 0 ? c.clickedCount : replies;

      const deliveryRate = c.sentCount > 0 ? Number(((c.deliveredCount / Math.max(c.sentCount, 1)) * 100).toFixed(1)) : 0;
      const readRate = c.deliveredCount > 0 ? Number(((c.readCount / deliveredBase) * 100).toFixed(1)) : 0;
      const conversionRate =
        c.deliveredCount > 0
          ? Number(Math.min(100, (conversions / deliveredBase) * 100).toFixed(1))
          : 0;
      const completionRate = Number(((c.sentCount / base) * 100).toFixed(1));

      return {
        name: c.name.length > 18 ? `${c.name.slice(0, 17)}…` : c.name,
        fullName: c.name,
        deliveryRate,
        readRate,
        conversionRate,
        completionRate,
      };
    });
  }, [campaigns]);

  // 3. Total Active Message Volume (Campaigns + Live Chat Threads + Active Userbot Fleet)
  const messageVolumeSummary = useMemo(() => {
    const allChatMessages = Object.values(chats).flat();
    const inboundChats = allChatMessages.filter((m) => m.sender === 'contact').length;
    const outboundChats = allChatMessages.filter((m) => m.sender === 'agent' || m.sender === 'bot').length;
    const activeCampaignSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
    const activeCampaignRead = campaigns.reduce((sum, c) => sum + c.readCount, 0);
    const fleetSentToday = userbotSessions.reduce((sum, u) => sum + u.messagesSentToday, 0);
    const fleetTotal = userbotSessions.reduce((sum, u) => sum + u.messagesSentTotal, 0);

    const totalActiveMessages = activeCampaignSent + allChatMessages.length + fleetSentToday;

    const bySource = [
      {
        channel: 'Campaign Sent',
        volume: activeCampaignSent,
        color: CHART_COLORS.primary,
      },
      {
        channel: 'Campaign Read',
        volume: activeCampaignRead,
        color: CHART_COLORS.secondary,
      },
      {
        channel: 'Inbox Outbound',
        volume: outboundChats,
        color: CHART_COLORS.accent,
      },
      {
        channel: 'Inbox Inbound',
        volume: inboundChats,
        color: CHART_COLORS.warning,
      },
      {
        channel: 'Fleet Today',
        volume: fleetSentToday,
        color: '#0ea5e9',
      },
    ];

    const bySession = userbotSessions.map((u) => ({
      session: u.label.split('(')[0].trim().slice(0, 14),
      today: u.messagesSentToday,
      dailyLimit: u.dailyLimit,
      total: u.messagesSentTotal,
    }));

    return {
      totalActiveMessages,
      activeCampaignSent,
      liveChatCount: allChatMessages.length,
      fleetTotal,
      bySource,
      bySession,
    };
  }, [campaigns, chats, userbotSessions]);

  // Top-level summary numbers
  const verifiedPct =
    contacts.length > 0
      ? ((contacts.filter((c) => c.hasTelegram).length / contacts.length) * 100).toFixed(0)
      : '0';

  const overallConversionPct = useMemo(() => {
    const delivered = campaigns.reduce((sum, c) => sum + c.deliveredCount, 0);
    if (delivered === 0) return '0.0';
    const converted = campaigns.reduce(
      (sum, c) => sum + (c.clickedCount > 0 ? c.clickedCount : c.repliedCount ?? Math.round(c.readCount * 0.14)),
      0
    );
    return ((converted / delivered) * 100).toFixed(1);
  }, [campaigns]);

  return (
    <section
      aria-label="CRM Analytics Visualizations"
      className="space-y-4"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            CRM Performance &amp; Trend Analytics
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Live metrics computed directly from CRM contacts, broadcast campaigns, and active chat threads
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
          <span>{contacts.length} contacts</span>
          <span aria-hidden="true">·</span>
          <span>{campaigns.length} campaigns</span>
          <span aria-hidden="true">·</span>
          <span>{messageVolumeSummary.totalActiveMessages.toLocaleString()} active messages</span>
        </div>
      </div>

      {/* 3-Panel Responsive Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. Contact Growth Trend */}
        <div className="lg:col-span-4 min-w-0 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                <TrendingUp className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="truncate">Contact Growth Trend</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span className="text-xl font-bold text-neutral-900 dark:text-white">
                  {contacts.length.toLocaleString()}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {verifiedPct}% TG Verified
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setContactChartView('trend')}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  contactChartView === 'trend'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Trend
              </button>
              <button
                type="button"
                onClick={() => setContactChartView('stages')}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  contactChartView === 'stages'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Stages
              </button>
            </div>
          </div>

          <div className="w-full h-56 min-w-0">
            {contacts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                No contact data available yet
              </div>
            ) : contactChartView === 'trend' ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={contactTrendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tgTotalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="tgVerifiedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    dataKey="totalContacts"
                    name="Total Contacts"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    fill="url(#tgTotalFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="verifiedTelegram"
                    name="TG Verified"
                    stroke={CHART_COLORS.secondary}
                    strokeWidth={2}
                    fill="url(#tgVerifiedFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contactStageData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="count" name="Leads" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="verified" name="TG Verified" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 2. Campaign Conversion Rate */}
        <div className="lg:col-span-4 min-w-0 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                <Target className="w-4 h-4 text-purple-500 shrink-0" />
                <span className="truncate">Campaign Conversion Rate</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span className="text-xl font-bold text-neutral-900 dark:text-white">
                  {overallConversionPct}%
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  click &amp; reply conversion
                </span>
              </div>
            </div>
          </div>

          <div className="w-full h-56 min-w-0">
            {campaignConversionData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                No campaigns created yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={campaignConversionData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="readRate"
                    name="Read Rate (%)"
                    fill={CHART_COLORS.primary}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                  <Bar
                    dataKey="conversionRate"
                    name="Conversion (%)"
                    fill={CHART_COLORS.accent}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                  <Line
                    type="monotone"
                    dataKey="deliveryRate"
                    name="Delivery (%)"
                    stroke={CHART_COLORS.secondary}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 3. Total Active Message Volume */}
        <div className="lg:col-span-4 min-w-0 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="truncate">Total Active Message Volume</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span className="text-xl font-bold text-neutral-900 dark:text-white">
                  {messageVolumeSummary.totalActiveMessages.toLocaleString()}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {messageVolumeSummary.liveChatCount} live chat msgs
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setVolumeChartView('sources')}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  volumeChartView === 'sources'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Channels
              </button>
              <button
                type="button"
                onClick={() => setVolumeChartView('sessions')}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  volumeChartView === 'sessions'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Sessions
              </button>
            </div>
          </div>

          <div className="w-full h-56 min-w-0">
            {volumeChartView === 'sources' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={messageVolumeSummary.bySource} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="channel" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Bar dataKey="volume" name="Message Volume" radius={[4, 4, 0, 0]} barSize={28}>
                    {messageVolumeSummary.bySource.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={messageVolumeSummary.bySession} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="session" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="today" name="Sent Today" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="Total Sent" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
