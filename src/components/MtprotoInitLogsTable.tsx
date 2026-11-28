import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Server,
  Terminal,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  clearMTProtoInitLogs,
  exportMTProtoInitLogsToJson,
  fetchMTProtoInitLogs,
  MTProtoDiagnosticResult,
  MTProtoInitLogEntry,
} from '../services/telegramService';

interface MtprotoInitLogsTableProps {
  latestDiagnosticTimestamp?: string;
  latestDiagnostic?: MTProtoDiagnosticResult | null;
}

const ACTION_LABELS: Record<MTProtoInitLogEntry['action'], string> = {
  diagnostic_ping: 'Ping Diagnostic',
  test_connection: 'Test Connection',
  otp_request: 'OTP Request',
  otp_sign_in: 'OTP Sign-In',
  connect_session: 'StringSession Import',
  auto_reconnect: 'Auto-Reconnect',
};

export const MtprotoInitLogsTable: React.FC<MtprotoInitLogsTableProps> = ({
  latestDiagnosticTimestamp,
  latestDiagnostic,
}) => {
  const [logs, setLogs] = useState<MTProtoInitLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchMTProtoInitLogs();
      setLogs(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, latestDiagnosticTimestamp]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    const onInitLog = (e: Event) => {
      try {
        const entry: MTProtoInitLogEntry = JSON.parse((e as MessageEvent).data);
        if (!entry?.id) return;
        setLogs((prev) => {
          if (prev.some((item) => item.id === entry.id)) return prev;
          return [entry, ...prev].slice(0, 100);
        });
      } catch {}
    };
    es.addEventListener('mtproto:init_log', onInitLog);
    return () => es.close();
  }, []);

  const handleClear = async () => {
    await clearMTProtoInitLogs();
    setLogs([]);
    setExpandedLogIds({});
  };

  const handleExportJson = async () => {
    setExporting(true);
    try {
      await exportMTProtoInitLogsToJson(logs, latestDiagnostic);
    } finally {
      setExporting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-500" />
            <span>MTProto Initialization Logs ({logs.length})</span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Real-time log stream of MTProto client initialization attempts, stack traces, error objects (401, 403, 429), and Data Center (DC) routing.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportJson}
            disabled={exporting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/50 disabled:opacity-50"
            title="Export MTProto initialization logs including stack traces and full error objects as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting...' : 'Export JSON'}</span>
          </button>
          <button
            type="button"
            onClick={loadLogs}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            title="Refresh initialization logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              title="Clear logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="text-[11px] text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-3 font-medium whitespace-nowrap">Timestamp</th>
              <th className="py-2 px-3 font-medium">Connection Attempt Result</th>
              <th className="py-2 px-3 font-medium whitespace-nowrap">Error Code</th>
              <th className="py-2 pl-3 font-medium whitespace-nowrap">Data Center (DC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-neutral-400">
                  No MTProto initialization attempts logged yet. Click &quot;Run Ping Diagnostic&quot; or &quot;Test Connection&quot; to log an attempt.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const ts = new Date(log.timestamp);
                const timeStr = Number.isNaN(ts.getTime())
                  ? log.timestamp
                  : `${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`;
                const hasTrace = Boolean(log.stackTrace || log.errorDetails);
                const isExpanded = Boolean(expandedLogIds[log.id]);

                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 align-top">
                      <td
                        className="py-2.5 pr-3 font-mono text-[11px] text-neutral-500 whitespace-nowrap"
                        title={log.timestamp}
                      >
                        {timeStr}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.result === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : log.result === 'partial' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          )}
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {log.resultLabel}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                          {hasTrace && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(log.id)}
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-sky-600 dark:text-sky-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  <span>Hide Trace</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  <span>Inspect Trace / Error</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        {log.errorMessage && (
                          <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 max-w-xl break-words">
                            {log.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.errorCode === null ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            200 OK
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-semibold border ${
                              log.errorCode === 401 && log.result === 'partial'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {log.errorCode}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 font-mono text-[11px] text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Server className="w-3 h-3 text-sky-500 shrink-0" />
                          <span>{log.dc || 'DC —'}</span>
                          {log.latencyMs > 0 && (
                            <span className="text-neutral-400">({log.latencyMs}ms)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && hasTrace && (
                      <tr className="bg-neutral-50/90 dark:bg-neutral-950/80">
                        <td colSpan={4} className="p-3 space-y-2">
                          {log.errorDetails && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                                Sanitized Error Object
                              </div>
                              <pre className="p-2.5 rounded-lg bg-neutral-900 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-48">
                                {JSON.stringify(log.errorDetails, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.stackTrace && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                                Stack Trace
                              </div>
                              <pre className="p-2.5 rounded-lg bg-neutral-900 text-amber-200 font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                                {log.stackTrace}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
