import React, { useState } from 'react';
import {
  Send,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Trash2,
  Users,
  ShieldCheck,
  Radio,
  Zap,
  RotateCcw,
  Download,
  Server,
  Clock,
  Layers,
  X,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import {
  Campaign,
  Contact,
  UserAccount,
  CloudFile,
  UserbotSession,
  AudienceList,
  CampaignBackupSnapshot,
} from '../types';
import { translations, SupportedLanguage } from '../translations';
import { exportToExcel, exportToCSV } from '../services/telegramService';

interface CampaignManagerProps {
  campaigns: Campaign[];
  contacts: Contact[];
  cloudFiles: CloudFile[];
  userbotSessions: UserbotSession[];
  audienceLists: AudienceList[];
  campaignBackups: CampaignBackupSnapshot[];
  currentUser: UserAccount;
  lang: SupportedLanguage;
  onCreateCampaign: (
    campaign: Omit<
      Campaign,
      'id' | 'createdAt' | 'sentCount' | 'deliveredCount' | 'readCount' | 'clickedCount' | 'failedCount' | 'unsubscribedCount'
    >
  ) => void;
  onUpdateCampaignStatus: (id: string, status: Campaign['status']) => void;
  onDeleteCampaign: (id: string) => void;
  onTriggerFailover: (campaign: Campaign, sessionId: string, reason: 'UserDeactivated' | 'AuthKeyUnregistered') => void;
  onResumeFromBackup: (backup: CampaignBackupSnapshot, newSessionId: string) => Promise<void> | void;
  onNavigateToUserbots?: () => void;
}

export const CampaignManager: React.FC<CampaignManagerProps> = ({
  campaigns,
  contacts,
  userbotSessions,
  audienceLists,
  campaignBackups,
  currentUser,
  lang,
  onCreateCampaign,
  onUpdateCampaignStatus,
  onDeleteCampaign,
  onTriggerFailover,
  onResumeFromBackup,
  onNavigateToUserbots,
}) => {
  const t = translations.en;

  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'paused' | 'scheduled' | 'completed' | 'draft'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCampaignForDetails, setSelectedCampaignForDetails] = useState<Campaign | null>(null);
  const [backupTargetSession, setBackupTargetSession] = useState<Record<string, string>>({});
  const [resumingBackupId, setResumingBackupId] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  // Healthy active Userbot sessions eligible for load-balancing
  const healthySessions = userbotSessions.filter(
    (s) =>
      s.isConnected &&
      s.healthStatus === 'active' &&
      s.spambotStatus !== 'banned' &&
      s.spambotStatus !== 'limited'
  );

  // New Campaign Form State
  const [name, setName] = useState('');
  const [messageText, setMessageText] = useState(
    'Hello {{First_Name}}, your order {{Order_Number}} ({{Customer_Tier}}) is ready for priority dispatch on TelePulse.'
  );
  const [targetSegment, setTargetSegment] = useState<string>('telegram_verified');
  const [mediaType, setMediaType] = useState<'none' | 'photo' | 'document'>('none');
  const [mediaUrl, setMediaUrl] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [sendRate, setSendRate] = useState(15);
  const [scheduleChoice, setScheduleChoice] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('2026-11-20T10:00');
  const [tagInput, setTagInput] = useState('VIP, Followup');
  const [sendingEngine, setSendingEngine] = useState<'mtproto' | 'bot_api'>('mtproto');
  const [minDelaySeconds, setMinDelaySeconds] = useState<number>(2);
  const [maxDelaySeconds, setMaxDelaySeconds] = useState<number>(5);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(() =>
    healthySessions.map((s) => s.id)
  );
  const [autoAppendOptOutFooter, setAutoAppendOptOutFooter] = useState(true);
  const [spambotPreFlightCheck, setSpambotPreFlightCheck] = useState(true);

  const toggleSessionSelection = (id: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Resolve real eligible contacts for segment (strictly honoring Opt-Out suppression)
  const resolveTargetContacts = (segment: string) => {
    let pool = contacts;
    if (segment === 'telegram_verified') {
      pool = contacts.filter((c) => c.hasTelegram);
    } else if (segment === 'stage:customer') {
      pool = contacts.filter((c) => c.stage === 'customer');
    } else if (segment === 'tag:VIP') {
      pool = contacts.filter((c) => c.tags.some((tg) => tg.toLowerCase().includes('vip')));
    } else if (segment.startsWith('audience:')) {
      const audId = segment.replace('audience:', '');
      const aud = audienceLists.find((a) => a.id === audId);
      pool = aud ? contacts.filter((c) => aud.contactIds.includes(c.id)) : [];
    }
    const eligible = pool.filter((c) => c.optInStatus !== 'opted_out' && c.optInStatus !== 'dnc_suppressed');
    const suppressed = pool.length - eligible.length;
    return { eligible, suppressed, total: pool.length };
  };

  const targetSummary = resolveTargetContacts(targetSegment);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !messageText.trim()) return;

    const activePoolIds =
      selectedSessionIds.length > 0
        ? selectedSessionIds.filter((id) => healthySessions.some((s) => s.id === id))
        : healthySessions.map((s) => s.id);

    onCreateCampaign({
      name: name.trim(),
      messageText: messageText.trim(),
      mediaType: mediaType === 'none' ? undefined : mediaType,
      mediaUrl: mediaType === 'none' ? undefined : mediaUrl.trim() || undefined,
      buttonText: buttonText.trim() || undefined,
      buttonUrl: buttonUrl.trim() || undefined,
      targetSegment,
      recipientCount: Math.max(targetSummary.eligible.length, 1),
      status: scheduleChoice === 'immediate' ? 'running' : 'scheduled',
      scheduledTime: scheduleChoice === 'scheduled' ? new Date(scheduledDate).toISOString() : undefined,
      sendRatePerSecond: sendRate,
      tags: tagInput.split(',').map((item) => item.trim()).filter(Boolean),
      sendingEngine,
      antiBanDelaySeconds: Math.round((minDelaySeconds + maxDelaySeconds) / 2),
      minDelaySeconds,
      maxDelaySeconds,
      assignedSessionIds: activePoolIds,
      autoAppendOptOutFooter,
      spambotPreFlightCheck,
    });

    setIsModalOpen(false);
    setName('');
  };

  const insertVariable = (variable: string) => {
    setMessageText((prev) => `${prev} {{${variable}}}`);
  };

  const handleDownloadBackup = (backup: CampaignBackupSnapshot) => {
    const rows = backup.pendingRecipients.map((r) => ({
      Campaign: backup.campaignName,
      Backup_Tag: backup.tag,
      Contact_ID: r.contactId,
      Name: r.name,
      Phone: r.phoneNumber,
      Status: r.status,
    }));
    exportToExcel(rows, backup.tag.replace(/[^a-zA-Z0-9_-]/g, '_'));
  };

  const handleTriggerResume = async (backup: CampaignBackupSnapshot) => {
    const chosenId = backupTargetSession[backup.id] || healthySessions[0]?.id;
    if (!chosenId) return;
    setResumingBackupId(backup.id);
    try {
      await onResumeFromBackup(backup, chosenId);
    } finally {
      setResumingBackupId(null);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (activeTab === 'all') return true;
    return c.status === activeTab;
  });

  const buildCampaignPerformanceRows = (list: Campaign[]) =>
    list.map((camp) => {
      const conversions = camp.repliedCount ?? Math.round(camp.readCount * 0.14);
      const deliveryRate = camp.sentCount > 0 ? Number(((camp.deliveredCount / camp.sentCount) * 100).toFixed(2)) : 0;
      const failureRate = camp.sentCount > 0 ? Number(((camp.failedCount / camp.sentCount) * 100).toFixed(2)) : 0;
      const readRate = camp.deliveredCount > 0 ? Number(((camp.readCount / camp.deliveredCount) * 100).toFixed(2)) : 0;
      const conversionRate =
        camp.deliveredCount > 0 ? Number(((conversions / camp.deliveredCount) * 100).toFixed(2)) : 0;
      const failureBreakdownText = camp.failureBreakdown
        ? Object.entries(camp.failureBreakdown)
            .map(([reason, count]) => `${reason}: ${count}`)
            .join('; ')
        : '';

      return {
        'Campaign ID': camp.id,
        'Campaign Name': camp.name,
        Status: camp.status,
        Engine: camp.sendingEngine === 'bot_api' ? 'Bot API' : 'MTProto Userbot Pool',
        'Target Segment': camp.targetSegment,
        'Created Date': new Date(camp.createdAt).toISOString().slice(0, 10),
        'Target Recipients': camp.recipientCount,
        Sent: camp.sentCount,
        Delivered: camp.deliveredCount,
        Failed: camp.failedCount,
        Read: camp.readCount,
        Clicked: camp.clickedCount,
        'Conversions / Replies': conversions,
        'Opt-Out / Unsubscribed': camp.unsubscribedCount,
        'Delivery Rate (%)': deliveryRate,
        'Failure Rate (%)': failureRate,
        'Read Rate (%)': readRate,
        'Conversion Rate (%)': conversionRate,
        'Failure Breakdown': failureBreakdownText,
      };
    });

  const handleExportPerformanceReport = (format: 'xlsx' | 'csv', singleCampaign?: Campaign) => {
    const targetList = singleCampaign ? [singleCampaign] : filteredCampaigns;
    if (targetList.length === 0) {
      setExportToast('No campaigns available under the selected filter to export.');
      setTimeout(() => setExportToast(null), 4000);
      return;
    }

    const rows = buildCampaignPerformanceRows(targetList);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const baseName = singleCampaign
      ? `TelePulse_Report_${singleCampaign.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}_${dateStamp}`
      : `TelePulse_Campaign_Performance_${activeTab}_${dateStamp}`;

    if (format === 'xlsx') {
      exportToExcel(rows, `${baseName}.xlsx`, 'Campaign Performance');
    } else {
      exportToCSV(rows, `${baseName}.csv`);
    }

    setExportToast(
      `Exported ${targetList.length} campaign performance report${targetList.length > 1 ? 's' : ''} (.${format}).`
    );
    setTimeout(() => setExportToast(null), 4500);
  };

  const handleExportCheckpoints = (camp: Campaign, format: 'xlsx' | 'csv') => {
    const checkpoints = camp.checkpoints || [];
    if (checkpoints.length === 0) return;
    const rows = checkpoints.map((cp) => ({
      Campaign: camp.name,
      'Contact ID': cp.contactId,
      Name: cp.name,
      'Phone Number': cp.phoneNumber,
      Status: cp.status,
      'Session Label': cp.assignedSessionLabel || '',
      'Failure Reason': cp.failureReason || '',
      'Failure Detail': cp.failureDetail || '',
      'Sent At': cp.sentAt || '',
      'Replied At': cp.repliedAt || '',
    }));
    const baseName = `TelePulse_Checkpoints_${camp.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}`;
    if (format === 'xlsx') {
      exportToExcel(rows, `${baseName}.xlsx`, 'Checkpoints');
    } else {
      exportToCSV(rows, `${baseName}.csv`);
    }
    setExportToast(`Exported ${checkpoints.length} recipient checkpoints (.${format}).`);
    setTimeout(() => setExportToast(null), 4500);
  };

  const sampleContact = targetSummary.eligible[0] || contacts[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {t.campaigns}
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              {healthySessions.length} Healthy Userbots Ready
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Load-balanced MTProto campaigns across multiple Userbot sessions with randomized delays, Opt-Out gating, and automated failover snapshots.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleExportPerformanceReport('csv')}
            disabled={filteredCampaigns.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-sky-500" />
            <span>Export Report (.csv)</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportPerformanceReport('xlsx')}
            disabled={filteredCampaigns.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Export Report (.xlsx)</span>
          </button>

          {onNavigateToUserbots && (
            <button
              onClick={onNavigateToUserbots}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0"
            >
              <Server className="w-3.5 h-3.5 text-sky-500" />
              <span>Manage Userbots</span>
            </button>
          )}
          <button
            onClick={() => {
              setSelectedSessionIds(healthySessions.map((s) => s.id));
              setIsModalOpen(true);
            }}
            disabled={currentUser.role === 'viewer'}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all whitespace-nowrap shrink-0 ${
              currentUser.role === 'viewer'
                ? 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed opacity-60'
                : 'bg-sky-600 hover:bg-sky-500 shadow-sm shadow-sky-600/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{t.newCampaign}</span>
          </button>
        </div>
      </div>

      {exportToast && (
        <div className="px-3.5 py-2.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{exportToast}</span>
        </div>
      )}

      {/* Automated Backup Snapshots & Hot-Swap Recovery Panel */}
      {campaignBackups.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300/70 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                Automated Failover Backups &amp; Session Hot-Swap Recovery
              </h2>
            </div>
            <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 tabular-nums">
              {campaignBackups.filter((b) => !b.restoredAt).length} Pending Recovery
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {campaignBackups.slice(0, 4).map((bkp) => {
              const selectedSession = backupTargetSession[bkp.id] || healthySessions[0]?.id || '';
              return (
                <div
                  key={bkp.id}
                  className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-neutral-900 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-white font-mono">
                        {bkp.tag}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Flagged: <strong className="text-red-500">{bkp.triggeredBySessionLabel}</strong> ({bkp.triggeredReason}) ·{' '}
                        <span className="tabular-nums font-semibold text-neutral-800 dark:text-neutral-200">
                          {bkp.pendingCount} pending customers
                        </span>
                      </div>
                    </div>
                    {bkp.restoredAt ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Resumed
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Paused Snapshot
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDownloadBackup(bkp)}
                      className="px-2.5 py-1.5 text-[11px] font-medium rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export Pending (.xlsx)</span>
                    </button>

                    {!bkp.restoredAt && (
                      <>
                        <select
                          value={selectedSession}
                          onChange={(e) =>
                            setBackupTargetSession((prev) => ({ ...prev, [bkp.id]: e.target.value }))
                          }
                          className="flex-1 min-w-[160px] text-[11px] px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                        >
                          {healthySessions.length === 0 ? (
                            <option value="">No healthy Userbot — Add via OTP</option>
                          ) : (
                            healthySessions.map((hs) => (
                              <option key={hs.id} value={hs.id}>
                                {hs.label} ({hs.phone})
                              </option>
                            ))
                          )}
                        </select>

                        <button
                          type="button"
                          disabled={!selectedSession || resumingBackupId === bkp.id}
                          onClick={() => handleTriggerResume(bkp)}
                          className="px-3 py-1.5 text-[11px] font-semibold rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>
                            {resumingBackupId === bkp.id
                              ? 'Resuming...'
                              : 'Reassign & Resume'}
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg max-w-xl overflow-x-auto">
        {(['all', 'running', 'paused', 'scheduled', 'completed', 'draft'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Campaign Cards */}
      <div className="space-y-4">
        {filteredCampaigns.map((camp) => {
          const sentPct = camp.recipientCount > 0 ? Math.round((camp.sentCount / camp.recipientCount) * 100) : 0;
          const delivPct = camp.sentCount > 0 ? ((camp.deliveredCount / camp.sentCount) * 100).toFixed(1) : '0';
          const readPct = camp.deliveredCount > 0 ? ((camp.readCount / camp.deliveredCount) * 100).toFixed(1) : '0';
          const assignedLabels = (camp.assignedSessionIds || [])
            .map((id) => userbotSessions.find((s) => s.id === id)?.label || id)
            .slice(0, 3);

          return (
            <div
              key={camp.id}
              className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-neutral-900 dark:text-white">{camp.name}</h2>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        camp.status === 'running'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          : camp.status === 'paused'
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                          : camp.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : camp.status === 'scheduled'
                          ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                      }`}
                    >
                      {camp.status}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                      {camp.sendingEngine === 'bot_api' ? 'Bot API' : 'MTProto Userbot Pool'}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      Segment: <strong className="text-neutral-700 dark:text-neutral-300">{camp.targetSegment}</strong>
                    </span>
                  </div>

                  {camp.pausedReason && (
                    <div className="text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1 inline-block">
                      Auto-Paused: {camp.pausedReason}
                    </div>
                  )}

                  <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2 max-w-3xl">
                    {camp.messageText}
                  </p>

                  <div className="flex items-center flex-wrap gap-3 text-[11px] text-neutral-400 pt-1">
                    <span className="tabular-nums">
                      Delay: {camp.minDelaySeconds ?? camp.antiBanDelaySeconds ?? 3}–{camp.maxDelaySeconds ?? (camp.antiBanDelaySeconds ? camp.antiBanDelaySeconds + 3 : 7)}s
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Sessions: {assignedLabels.length > 0 ? assignedLabels.join(', ') : 'Auto Pool'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Created: {new Date(camp.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {camp.status === 'running' && (
                    <>
                      <button
                        onClick={() =>
                          onTriggerFailover(
                            camp,
                            camp.assignedSessionIds?.[0] || healthySessions[0]?.id || userbotSessions[0]?.id || 'ub_1',
                            'UserDeactivated'
                          )
                        }
                        className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1"
                        title="Test Automated Pause + Pending Backup Snapshot"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Simulate Failover</span>
                      </button>

                      <button
                        onClick={() => onUpdateCampaignStatus(camp.id, 'paused')}
                        disabled={currentUser.role === 'viewer'}
                        className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        title="Pause Campaign"
                      >
                        <Pause className="w-4 h-4 text-amber-500" />
                      </button>
                    </>
                  )}

                  {camp.status === 'paused' && (
                    <button
                      onClick={() => onUpdateCampaignStatus(camp.id, 'running')}
                      disabled={currentUser.role === 'viewer'}
                      className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      title="Resume Campaign"
                    >
                      <Play className="w-4 h-4 text-emerald-500" />
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedCampaignForDetails(camp)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 whitespace-nowrap"
                  >
                    Checkpoints &amp; Analytics
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportPerformanceReport('csv', camp)}
                    className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1 whitespace-nowrap"
                    title="Export this campaign performance report as CSV"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-500" />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportPerformanceReport('xlsx', camp)}
                    className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1 whitespace-nowrap"
                    title="Export this campaign performance report as Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Excel</span>
                  </button>

                  {currentUser.role !== 'viewer' && (
                    <button
                      onClick={() => onDeleteCampaign(camp.id)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Funnel Metrics */}
              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs tabular-nums">
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Target Pool</div>
                  <div className="font-bold text-neutral-900 dark:text-white mt-0.5">
                    {camp.recipientCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Sent ({sentPct}%)</div>
                  <div className="font-bold text-neutral-900 dark:text-white mt-0.5">
                    {camp.sentCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Delivered ({delivPct}%)</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {camp.deliveredCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Read ({readPct}%)</div>
                  <div className="font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                    {camp.readCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Replies</div>
                  <div className="font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    {(camp.repliedCount ?? Math.round(camp.readCount * 0.14)).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Failed / Opt-Out</div>
                  <div className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {camp.failedCount} / {camp.unsubscribedCount}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE CAMPAIGN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Create Resilient Load-Balanced Campaign
                </h3>
                <p className="text-xs text-neutral-500">
                  Assign multiple Userbot sessions, enforce automatic Opt-Out suppression, and map dynamic CSV variables.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column */}
              <div className="md:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., VIP Order Confirmation Blast"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      Target Audience / Saved List
                    </label>
                    <select
                      value={targetSegment}
                      onChange={(e) => setTargetSegment(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="telegram_verified">Active Telegram Verified ({contacts.filter((c) => c.hasTelegram).length} contacts)</option>
                      <option value="all">All CRM Contacts ({contacts.length} contacts)</option>
                      <option value="stage:customer">Paying Customers Stage</option>
                      <option value="tag:VIP">Tagged "VIP" Leads</option>
                      {audienceLists.map((aud) => (
                        <option key={aud.id} value={`audience:${aud.id}`}>
                          Saved Audience: {aud.name} ({aud.contactIds.length})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Compliance Summary Strip */}
                <div className="px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Opt-In Eligible: <strong className="tabular-nums">{targetSummary.eligible.length}</strong> contacts
                  </span>
                  <span className="text-amber-700 dark:text-amber-400 tabular-nums">
                    Auto-Suppressed (Opt-Out): <strong>{targetSummary.suppressed}</strong>
                  </span>
                </div>

                {/* Load-Balanced Userbot Session Pool */}
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-500" />
                      Load Balancing: Assign Userbot Sessions
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSendingEngine('mtproto')}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          sendingEngine === 'mtproto'
                            ? 'bg-sky-600 text-white'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        MTProto Pool
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendingEngine('bot_api')}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          sendingEngine === 'bot_api'
                            ? 'bg-purple-600 text-white'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        Bot API
                      </button>
                    </div>
                  </div>

                  {sendingEngine === 'mtproto' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                      {userbotSessions.map((ub) => {
                        const isClean =
                          ub.isConnected &&
                          ub.healthStatus === 'active' &&
                          ub.spambotStatus !== 'banned' &&
                          ub.spambotStatus !== 'limited';
                        const isChecked = selectedSessionIds.includes(ub.id);
                        return (
                          <label
                            key={ub.id}
                            className={`flex items-start gap-2 p-2 rounded-lg border text-[11px] cursor-pointer ${
                              !isClean
                                ? 'opacity-50 cursor-not-allowed border-red-300 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/10'
                                : isChecked
                                ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/30'
                                : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!isClean}
                              checked={isClean && isChecked}
                              onChange={() => toggleSessionSelection(ub.id)}
                              className="mt-0.5 accent-sky-600"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-neutral-900 dark:text-white truncate">
                                {ub.label}
                              </div>
                              <div className="text-[10px] text-neutral-500 font-mono truncate">
                                {ub.phone} · {isClean ? (ub.proxy.enabled ? `SOCKS5` : 'Direct') : ub.healthStatus}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Randomized Throttling + Pre-flight + Opt-Out Footer */}
                  <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                    <div>
                      <span className="text-[11px] text-neutral-500 block mb-1">
                        Randomized Human Delay (sec)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={minDelaySeconds}
                          onChange={(e) => setMinDelaySeconds(Math.max(1, Number(e.target.value)))}
                          className="w-16 px-2 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 tabular-nums"
                        />
                        <span className="text-neutral-400">to</span>
                        <input
                          type="number"
                          min={minDelaySeconds}
                          max={60}
                          value={maxDelaySeconds}
                          onChange={(e) => setMaxDelaySeconds(Math.max(minDelaySeconds, Number(e.target.value)))}
                          className="w-16 px-2 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 tabular-nums"
                        />
                        <span className="text-[11px] text-neutral-400">sec</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-neutral-700 dark:text-neutral-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={spambotPreFlightCheck}
                          onChange={(e) => setSpambotPreFlightCheck(e.target.checked)}
                          className="accent-sky-600"
                        />
                        <span>Pre-flight @SpamBot check</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoAppendOptOutFooter}
                          onChange={(e) => setAutoAppendOptOutFooter(e.target.checked)}
                          className="accent-emerald-600"
                        />
                        <span>Auto-append Opt-Out footer</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Dynamic Message & Variable Tags */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Dynamic Message Template
                    </label>
                    <span className="text-[11px] text-neutral-400 tabular-nums">{messageText.length} chars</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-[10px] text-neutral-400 self-center">CSV Variables:</span>
                    {['First_Name', 'Order_Number', 'Customer_Tier', 'name', 'company', 'phone'].map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => insertVariable(tag)}
                        className="px-2 py-0.5 text-[10px] font-mono rounded bg-neutral-100 dark:bg-neutral-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                      >
                        +{`{{${tag}}}`}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    required
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full text-xs p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans"
                  />
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      Dispatch Timing
                    </label>
                    <select
                      value={scheduleChoice}
                      onChange={(e) => setScheduleChoice(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="immediate">Launch Immediately</option>
                      <option value="scheduled">Schedule Later</option>
                    </select>
                  </div>
                  {scheduleChoice === 'scheduled' ? (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Schedule Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Campaign Tags
                      </label>
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Telegram Preview */}
              <div className="md:col-span-5 bg-neutral-100 dark:bg-neutral-950/80 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
                    <Smartphone className="w-4 h-4 text-sky-500" />
                    <span>Live Telegram Variable Preview</span>
                  </div>

                  <div className="max-w-xs mx-auto bg-white dark:bg-neutral-900 rounded-2xl p-3.5 shadow-md border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 space-y-2">
                    <div className="whitespace-pre-wrap leading-relaxed text-[11px]">
                      {messageText
                        .replace(/\{\{First_Name\}\}/gi, sampleContact?.customFields?.First_Name || sampleContact?.name.split(' ')[0] || 'Marcus')
                        .replace(/\{\{Order_Number\}\}/gi, sampleContact?.customFields?.Order_Number || 'ORD-9042')
                        .replace(/\{\{Customer_Tier\}\}/gi, sampleContact?.customFields?.Customer_Tier || 'Enterprise VIP')
                        .replace(/\{\{name\}\}/gi, sampleContact?.name || 'Marcus Vance')
                        .replace(/\{\{company\}\}/gi, sampleContact?.company || 'Apex Logistics')
                        .replace(/\{\{phone\}\}/gi, sampleContact?.phoneNumber || '+8801711223344')}
                      {autoAppendOptOutFooter && !/stop|unsubscribe/i.test(messageText)
                        ? '\n\nReply STOP or /unsubscribe to opt out.'
                        : ''}
                    </div>
                    <div className="text-[9px] text-right text-neutral-400 flex items-center justify-end gap-1">
                      <span>Now</span>
                      <CheckCircle2 className="w-2.5 h-2.5 text-sky-500" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{scheduleChoice === 'immediate' ? 'Dispatch Load-Balanced' : 'Schedule'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECKPOINTING & FAILURE ANALYTICS MODAL */}
      {selectedCampaignForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {selectedCampaignForDetails.name} — Checkpoints &amp; Failure Analytics
                </h3>
                <span className="text-xs text-neutral-400">
                  Per-contact state preservation (Pending / Sent / Failed / Replied / Opted-Out)
                </span>
              </div>
              <button
                onClick={() => setSelectedCampaignForDetails(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center tabular-nums">
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                  <div className="text-[10px] text-neutral-400">Recipients</div>
                  <div className="text-base font-bold text-neutral-900 dark:text-white mt-1">
                    {selectedCampaignForDetails.recipientCount.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                  <div className="text-[10px] text-neutral-400">Delivered</div>
                  <div className="text-base font-bold text-emerald-500 mt-1">
                    {selectedCampaignForDetails.deliveredCount.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                  <div className="text-[10px] text-neutral-400">Replied</div>
                  <div className="text-base font-bold text-sky-500 mt-1">
                    {(selectedCampaignForDetails.repliedCount ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                  <div className="text-[10px] text-neutral-400">Failed</div>
                  <div className="text-base font-bold text-red-500 mt-1">
                    {selectedCampaignForDetails.failedCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                  <div className="text-[10px] text-neutral-400">Opt-Out Suppressed</div>
                  <div className="text-base font-bold text-amber-500 mt-1">
                    {selectedCampaignForDetails.unsubscribedCount}
                  </div>
                </div>
              </div>

              {/* Per-Contact Checkpoints Table */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Contact Checkpoints ({selectedCampaignForDetails.checkpoints?.length || 0})
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                  {(selectedCampaignForDetails.checkpoints || []).length === 0 ? (
                    <div className="p-4 text-center text-neutral-400">
                      Checkpoints are recorded per-contact during live MTProto dispatch.
                    </div>
                  ) : (
                    (selectedCampaignForDetails.checkpoints || []).map((cp) => (
                      <div key={cp.contactId} className="px-3.5 py-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-neutral-900 dark:text-white">{cp.name}</div>
                          <div className="text-[11px] font-mono text-neutral-500">{cp.phoneNumber}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              cp.status === 'sent'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : cp.status === 'replied'
                                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                : cp.status === 'opted_out'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : cp.status === 'failed'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                : 'bg-neutral-500/10 text-neutral-500'
                            }`}
                          >
                            {cp.status}
                          </span>
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            {cp.assignedSessionLabel || 'Queued'} {cp.failureReason ? `· ${cp.failureReason}` : ''}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleExportPerformanceReport('csv', selectedCampaignForDetails)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-500" />
                  <span>Performance (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPerformanceReport('xlsx', selectedCampaignForDetails)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Performance (.xlsx)</span>
                </button>
                {(selectedCampaignForDetails.checkpoints || []).length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleExportCheckpoints(selectedCampaignForDetails, 'csv')}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-500" />
                    <span>Checkpoints (.csv)</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedCampaignForDetails(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
