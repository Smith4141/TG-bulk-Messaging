import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Layers,
  RefreshCw,
  Server,
  ShieldAlert,
  Webhook,
  XCircle,
} from 'lucide-react';
import {
  Contact,
  MTProtoConfig,
  TelegramBotConfig,
  UserAccount,
  UserbotSession,
  WebhookEndpoint,
  WebhookLog,
} from '../types';
import {
  ConfiguredAppDcInfo,
  DcComparisonAnalysis,
  fetchTelegramDcConfig,
  LiveTelegramDcConfig,
  MTProtoDiagnosticResult,
  runMTProtoHealthDiagnostic,
} from '../services/telegramService';
import { ExcelSmsDispatchView } from './ExcelSmsDispatchView';
import { UnlimitedDispatchView } from './UnlimitedDispatchView';
import { UnifiedApiSettingsView } from './UnifiedApiSettingsView';
import { MtprotoInitLogsTable } from './MtprotoInitLogsTable';
import { WebhooksManager } from './WebhooksManager';

export type ApiHubSubTab = 'phone_send' | 'unlimited_ids' | 'gateways' | 'webhooks';

interface ApiMessagingHubViewProps {
  activeSubTab: ApiHubSubTab;
  onSelectSubTab: (tab: ApiHubSubTab) => void;
  contacts: Contact[];
  botConfig: TelegramBotConfig;
  onUpdateBotConfig: (updates: Partial<TelegramBotConfig>) => void;
  mtprotoConfig: MTProtoConfig;
  onUpdateMtprotoConfig: (updates: Partial<MTProtoConfig>) => void;
  userbotSessions: UserbotSession[];
  onUpdateUserbotSessions: (sessions: UserbotSession[]) => void;
  webhooks: WebhookEndpoint[];
  webhookLogs: WebhookLog[];
  onCreateWebhook: (hook: Omit<WebhookEndpoint, 'id' | 'totalCalls' | 'successRate'>) => void;
  onDeleteWebhook: (id: string) => void;
  onDispatchTestWebhook: (webhookId: string, eventName: string, payload: any) => Promise<WebhookLog>;
  currentUser: UserAccount;
}

export const ApiMessagingHubView: React.FC<ApiMessagingHubViewProps> = ({
  activeSubTab,
  onSelectSubTab,
  contacts,
  botConfig,
  onUpdateBotConfig,
  mtprotoConfig,
  onUpdateMtprotoConfig,
  userbotSessions,
  onUpdateUserbotSessions,
  webhooks,
  webhookLogs,
  onCreateWebhook,
  onDeleteWebhook,
  onDispatchTestWebhook,
  currentUser,
}) => {
  const [diagResult, setDiagResult] = useState<MTProtoDiagnosticResult | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [dcRefreshing, setDcRefreshing] = useState(false);
  const [dcOverride, setDcOverride] = useState<{
    configuredDc: ConfiguredAppDcInfo;
    liveDcConfig: LiveTelegramDcConfig | null;
    dcComparison: DcComparisonAnalysis;
    checkedAt: string;
  } | null>(null);

  const handleRunDiagnostic = useCallback(async () => {
    setDiagLoading(true);
    try {
      const primaryUb = userbotSessions[0];
      const result = await runMTProtoHealthDiagnostic({
        apiId: mtprotoConfig.apiId,
        apiHash: mtprotoConfig.apiHash,
        phone: primaryUb?.phone,
        sessionId: primaryUb?.id,
      });
      setDiagResult(result);
      setDcOverride(null);
    } finally {
      setDiagLoading(false);
    }
  }, [mtprotoConfig.apiId, mtprotoConfig.apiHash, userbotSessions]);

  const handleRefreshDcConfig = useCallback(async () => {
    setDcRefreshing(true);
    try {
      const res = await fetchTelegramDcConfig();
      if (res) {
        setDcOverride({
          configuredDc: res.configuredDc,
          liveDcConfig: res.liveDcConfig,
          dcComparison: res.dcComparison,
          checkedAt: res.checkedAt,
        });
      }
    } finally {
      setDcRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void handleRunDiagnostic();
  }, []);

  const configuredDc = dcOverride?.configuredDc || diagResult?.configuredDc;
  const liveDcConfig = dcOverride ? dcOverride.liveDcConfig : diagResult?.liveDcConfig;
  const dcComparison = dcOverride?.dcComparison || diagResult?.dcComparison;

  const tabs: { id: ApiHubSubTab; label: string; icon: React.ElementType }[] = [
    { id: 'phone_send', label: 'Send to Phone Numbers', icon: FileSpreadsheet },
    { id: 'unlimited_ids', label: 'Unlimited IDs & Multi-API', icon: Layers },
    { id: 'gateways', label: 'All Gateways & APIs', icon: KeyRound },
    { id: 'webhooks', label: 'Custom API Webhooks', icon: Webhook },
  ];

  const isAuthError =
    diagResult?.errorCategory === '401_unauthorized' ||
    diagResult?.errorCategory === '403_forbidden' ||
    diagResult?.errorCategory === '429_rate_limit';

  const statusTone = !diagResult
    ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-300'
    : diagResult.sessionAuthorized && diagResult.ok
    ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
    : diagResult.dcReachable && diagResult.pingOk && !isAuthError
    ? 'border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
    : 'border-rose-200 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300';

  return (
    <div className="space-y-5">
      {/* Single Hub Navigation Bar */}
      <div className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-950 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectSubTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dedicated API Health Diagnostic Panel */}
      <div className="p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-500" />
              <span>API Health Diagnostic</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Live MTProto DC ping, Data Center routing comparison (`help.GetConfig`), and credential initialization check.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {diagResult && !diagResult.sessionAuthorized && activeSubTab !== 'gateways' && (
              <button
                type="button"
                onClick={() => onSelectSubTab('gateways')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
              >
                Verify OTP in Gateways
              </button>
            )}
            <button
              type="button"
              onClick={handleRefreshDcConfig}
              disabled={dcRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              <Server className={`w-3.5 h-3.5 text-sky-500 ${dcRefreshing ? 'animate-pulse' : ''}`} />
              <span>{dcRefreshing ? 'Fetching DC Config...' : 'Fetch Live DC Config'}</span>
            </button>
            <button
              type="button"
              onClick={handleRunDiagnostic}
              disabled={diagLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
              <span>{diagLoading ? 'Pinging Telegram API...' : 'Run Ping Diagnostic'}</span>
            </button>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Connection Status */}
          <div className={`p-3.5 rounded-lg border ${statusTone} space-y-1`}>
            <div className="text-[11px] font-medium uppercase tracking-wide opacity-80 flex items-center gap-1.5">
              {diagResult?.sessionAuthorized && diagResult.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : diagResult?.dcReachable && !isAuthError ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" />
              )}
              <span>Connection Status</span>
            </div>
            <div className="text-xs font-bold">
              {diagLoading && !diagResult
                ? 'Running MTProto Ping...'
                : diagResult?.statusLabel || 'Not Tested'}
            </div>
            <div className="text-[11px] opacity-85 font-mono tabular-nums">
              {diagResult
                ? `HTTP/RPC: ${diagResult.statusCode} · Ping: ${diagResult.pingOk ? 'Pong OK' : 'Failed'} · Auth: ${diagResult.sessionAuthorized ? 'Authorized' : 'OTP Needed'}`
                : 'Awaiting check'}
            </div>
          </div>

          {/* Current DC */}
          <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-sky-500" />
              <span>Current Data Center (DC)</span>
            </div>
            <div className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2 tabular-nums">
              <span>{diagResult?.dcId ? `DC ${diagResult.dcId}` : 'DC —'}</span>
              {diagResult?.nearestDcId && diagResult.nearestDcId !== diagResult.dcId && (
                <span className="text-[11px] font-normal text-neutral-500">
                  (Nearest: DC {diagResult.nearestDcId})
                </span>
              )}
              {diagResult?.country && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                  <Globe className="w-3 h-3" />
                  {diagResult.country}
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono tabular-nums truncate">
              {diagResult?.dcServer
                ? `${diagResult.dcServer} · ${diagResult.latencyMs}ms`
                : 'No DC socket connected'}
            </div>
          </div>

          {/* Credentials Verified */}
          <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
              <span>Active MTProto Credentials</span>
            </div>
            <div className="text-xs font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
              API ID: {diagResult?.apiId || mtprotoConfig.apiId || '—'}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono truncate">
              Hash: {diagResult?.apiHashMasked || 'Not Configured'} · {diagResult?.phone || 'No Phone'}
            </div>
          </div>
        </div>

        {/* Specific Error / Initialization Message + Step Trace */}
        {diagResult && (diagResult.errorMessage || diagResult.steps.length > 0) && (
          <div className="space-y-2.5">
            {diagResult.errorMessage && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  diagResult.errorCategory === 'otp_required'
                    ? 'border-amber-200 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200'
                    : 'border-rose-200 dark:border-rose-800/70 bg-rose-50/60 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200'
                }`}
              >
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {diagResult.errorCode ? `Error ${diagResult.errorCode}: ` : ''}
                    {diagResult.statusLabel}
                  </div>
                  <div className="opacity-90">{diagResult.errorMessage}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {diagResult.steps.map((st, idx) => (
                <div
                  key={`${st.step}-${idx}`}
                  className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-[11px] space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-1 font-semibold text-neutral-800 dark:text-neutral-200">
                    <span className="flex items-center gap-1 truncate">
                      {st.ok ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate">{st.step}</span>
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400 shrink-0 tabular-nums">
                      {st.durationMs}ms
                    </span>
                  </div>
                  <div className="text-neutral-500 dark:text-neutral-400 line-clamp-2" title={st.detail}>
                    {st.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Telegram DC Config & Comparative Analysis */}
        {(dcComparison || liveDcConfig || configuredDc) && (
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-sky-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Live Telegram Data Center (DC) Config &amp; Comparative Analysis
                </h3>
              </div>
              {dcComparison && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    dcComparison.status === 'matched'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : dcComparison.status === 'mismatch'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {dcComparison.status === 'matched' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  <span>
                    {dcComparison.status === 'matched'
                      ? 'DC Config Matched'
                      : dcComparison.status === 'mismatch'
                      ? 'DC Mismatch Detected'
                      : 'DC Unconfigured'}
                  </span>
                </span>
              )}
            </div>

            {dcComparison && (
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 text-xs space-y-1.5">
                <div className="font-semibold text-neutral-800 dark:text-neutral-100">
                  {dcComparison.summary}
                </div>
                {dcComparison.differences.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                    {dcComparison.differences.map((diff, i) => (
                      <li key={i}>{diff}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* App Configured DC */}
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  App Configured DC Settings
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-[11px] tabular-nums">
                  <span className="text-neutral-500">Configured DC ID:</span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                    {configuredDc?.dcId ? `DC ${configuredDc.dcId}` : 'Not Assigned'}
                  </span>
                  <span className="text-neutral-500">Configured Endpoint:</span>
                  <span className="font-mono text-neutral-800 dark:text-neutral-200 truncate">
                    {configuredDc?.dcServer || '—'}
                  </span>
                  <span className="text-neutral-500">Config Source:</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {configuredDc?.source || 'default'}
                  </span>
                  <span className="text-neutral-500">MTProto Proxy:</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {configuredDc?.proxyEnabled ? 'Enabled' : 'Direct Socket'}
                  </span>
                </div>
              </div>

              {/* Live Telegram API Config */}
              <div className="p-3 rounded-lg border border-sky-200/70 dark:border-sky-900/50 bg-sky-50/30 dark:bg-sky-950/20 space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                  Live Telegram API (`help.GetConfig`)
                </div>
                {liveDcConfig ? (
                  <div className="grid grid-cols-2 gap-y-1 text-[11px] tabular-nums">
                    <span className="text-neutral-500">Active / Nearest DC:</span>
                    <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                      DC {liveDcConfig.thisDc}
                      {liveDcConfig.nearestDc ? ` (Nearest DC ${liveDcConfig.nearestDc})` : ''}
                    </span>
                    <span className="text-neutral-500">Live Primary Endpoint:</span>
                    <span className="font-mono text-neutral-800 dark:text-neutral-200 truncate">
                      {dcComparison?.livePrimaryEndpoint || '—'}
                    </span>
                    <span className="text-neutral-500">Region / Mode:</span>
                    <span className="font-mono text-neutral-700 dark:text-neutral-300">
                      {liveDcConfig.country || '—'} · {liveDcConfig.testMode ? 'Test DC' : 'Production DC'}
                    </span>
                    <span className="text-neutral-500">DC Nodes Returned:</span>
                    <span className="font-mono text-neutral-700 dark:text-neutral-300">
                      {liveDcConfig.dcOptions.length} options
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-500">
                    Live DC options unavailable until Telegram MTProto connection succeeds.
                  </div>
                )}
              </div>
            </div>

            {liveDcConfig && liveDcConfig.dcOptions.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left text-[11px] tabular-nums">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500">
                    <tr>
                      <th className="py-1.5 px-3 font-medium">DC</th>
                      <th className="py-1.5 px-3 font-medium">Live Telegram Endpoint</th>
                      <th className="py-1.5 px-3 font-medium">Transport Flags</th>
                      <th className="py-1.5 px-3 font-medium">App Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                    {liveDcConfig.dcOptions
                      .filter((opt) => !opt.ipv6)
                      .slice(0, 10)
                      .map((opt, idx) => {
                        const endpoint = `${opt.ipAddress}:${opt.port}`;
                        const matchesApp =
                          configuredDc?.dcId === opt.id &&
                          (!configuredDc.dcServer ||
                            configuredDc.dcServer.includes(opt.ipAddress));
                        const flags = [
                          opt.static ? 'Static' : null,
                          opt.mediaOnly ? 'MediaOnly' : null,
                          opt.tcpoOnly ? 'TCPO' : null,
                          opt.cdn ? 'CDN' : null,
                        ]
                          .filter(Boolean)
                          .join(', ');
                        return (
                          <tr
                            key={`${opt.id}-${opt.ipAddress}-${opt.port}-${idx}`}
                            className={
                              opt.isActiveThisDc
                                ? 'bg-sky-50/50 dark:bg-sky-950/20'
                                : 'hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30'
                            }
                          >
                            <td className="py-1.5 px-3 font-mono font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                              DC {opt.id}
                              {opt.isActiveThisDc && (
                                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-sky-600 text-white font-sans">
                                  ACTIVE
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-neutral-700 dark:text-neutral-300">
                              {endpoint}
                            </td>
                            <td className="py-1.5 px-3 text-neutral-500 dark:text-neutral-400">
                              {flags || 'Standard MTProto'}
                            </td>
                            <td className="py-1.5 px-3 whitespace-nowrap">
                              {matchesApp ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Matched
                                </span>
                              ) : configuredDc?.dcId === opt.id ? (
                                <span className="text-sky-600 dark:text-sky-400">Same DC ID</span>
                              ) : (
                                <span className="text-neutral-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real-Time MTProto Initialization Logs Table */}
      <MtprotoInitLogsTable
        latestDiagnosticTimestamp={diagResult?.checkedAt}
        latestDiagnostic={diagResult}
      />

      {/* Focused Single-Purpose Module Views */}
      {activeSubTab === 'phone_send' && (
        <ExcelSmsDispatchView userbotSessions={userbotSessions} />
      )}

      {activeSubTab === 'unlimited_ids' && (
        <UnlimitedDispatchView contacts={contacts} />
      )}

      {activeSubTab === 'gateways' && (
        <UnifiedApiSettingsView
          botConfig={botConfig}
          onUpdateBotConfig={onUpdateBotConfig}
          mtprotoConfig={mtprotoConfig}
          onUpdateMtprotoConfig={onUpdateMtprotoConfig}
          userbotSessions={userbotSessions}
          onUpdateUserbotSessions={onUpdateUserbotSessions}
          onDiagnosticCompleted={(result) => setDiagResult(result)}
        />
      )}

      {activeSubTab === 'webhooks' && (
        <WebhooksManager
          webhooks={webhooks}
          webhookLogs={webhookLogs}
          currentUser={currentUser}
          onCreateWebhook={onCreateWebhook}
          onDeleteWebhook={onDeleteWebhook}
          onDispatchTestWebhook={onDispatchTestWebhook}
        />
      )}
    </div>
  );
};

