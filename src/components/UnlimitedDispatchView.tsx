import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Layers,
  Pause,
  Play,
  Send,
  ShieldAlert,
  Square,
  Upload,
} from 'lucide-react';
import {
  Contact,
  TelegramApiSlot,
  UnlimitedDispatchJob,
  UnlimitedRoutingStrategy,
  UnlimitedTargetItem,
} from '../types';
import { exportToCSV, exportToExcel, parseUploadedSpreadsheet } from '../services/telegramService';

interface UnlimitedDispatchViewProps {
  contacts: Contact[];
}

const CHUNK_SIZE = 2500;

function classifyTarget(raw: string): {
  target: string;
  targetType: UnlimitedTargetItem['targetType'];
} {
  let s = raw.trim();
  const tMeMatch = s.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,})/i);
  if (tMeMatch) {
    s = `@${tMeMatch[1]}`;
  } else if (/^[a-zA-Z][a-zA-Z0-9_]{4,}$/.test(s)) {
    s = `@${s}`;
  }

  if (/^-100\d+$/.test(s) || /^-\d+$/.test(s)) {
    return { target: s, targetType: 'channel_id' };
  }
  if (/^\d{4,}$/.test(s)) {
    return { target: s, targetType: 'numeric_id' };
  }
  if (s.startsWith('@')) {
    return { target: s, targetType: 'username' };
  }
  if (/^\+?\d{7,15}$/.test(s.replace(/[\s()-]/g, ''))) {
    const cleaned = s.replace(/[^\d+]/g, '');
    return { target: cleaned.startsWith('+') ? cleaned : `+${cleaned}`, targetType: 'phone' };
  }
  return { target: s, targetType: 'numeric_id' };
}

function isValidTargetToken(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (/^-?\d{4,}$/.test(s)) return true;
  if (/^@[a-zA-Z][a-zA-Z0-9_]{3,}$/.test(s)) return true;
  if (/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[a-zA-Z0-9_]{4,}$/i.test(s)) return true;
  if (/^[a-zA-Z][a-zA-Z0-9_]{4,}$/.test(s)) return true;
  if (/^\+?\d{7,15}$/.test(s.replace(/[\s()-]/g, ''))) return true;
  return false;
}

export const UnlimitedDispatchView: React.FC<UnlimitedDispatchViewProps> = ({ contacts }) => {
  const [apiPool, setApiPool] = useState<TelegramApiSlot[]>([]);
  const [selectedApiIds, setSelectedApiIds] = useState<string[]>([]);

  const [rawTargetsText, setRawTargetsText] = useState('');
  const [importedItems, setImportedItems] = useState<UnlimitedTargetItem[]>([]);
  const [batchName, setBatchName] = useState('');
  const [messageText, setMessageText] = useState(
    'Hello {{name}}, here is your latest update from TelePulse!'
  );
  const [routingStrategy, setRoutingStrategy] = useState<UnlimitedRoutingStrategy>('round_robin');
  const [minDelayMs, setMinDelayMs] = useState(150);
  const [maxDelayMs, setMaxDelayMs] = useState(400);
  const [deduplicateTargets, setDeduplicateTargets] = useState(true);

  const [jobs, setJobs] = useState<UnlimitedDispatchJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/api-pool')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.apis) {
          const list: TelegramApiSlot[] = data.apis;
          setApiPool(list);
          setSelectedApiIds(list.filter((a) => a.enabled && a.status === 'active').map((a) => a.id));
        }
      })
      .catch(() => {});

    fetch('/api/dispatch/unlimited')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.jobs) {
          setJobs(data.jobs);
          if (data.jobs.length > 0) setActiveJobId((prev) => prev || data.jobs[0].jobId);
        }
      })
      .catch(() => {});

    const es = new EventSource('/api/events');
    const handleJobEvent = (e: Event) => {
      try {
        const job: UnlimitedDispatchJob = JSON.parse((e as MessageEvent).data);
        setJobs((prev) => {
          const exists = prev.some((j) => j.jobId === job.jobId);
          return exists ? prev.map((j) => (j.jobId === job.jobId ? job : j)) : [job, ...prev];
        });
      } catch {}
    };
    const handlePoolEvent = (e: Event) => {
      try {
        const updatedSlot: TelegramApiSlot = JSON.parse((e as MessageEvent).data);
        setApiPool((prev) => {
          const exists = prev.some((s) => s.id === updatedSlot.id);
          return exists
            ? prev.map((s) => (s.id === updatedSlot.id ? updatedSlot : s))
            : [updatedSlot, ...prev];
        });
      } catch {}
    };

    const handlePoolDelete = (e: Event) => {
      try {
        const deleted = JSON.parse((e as MessageEvent).data);
        if (deleted?.id) {
          setApiPool((prev) => prev.filter((s) => s.id !== deleted.id));
          setSelectedApiIds((prev) => prev.filter((id) => id !== deleted.id));
        }
      } catch {}
    };

    es.addEventListener('unlimited:progress', handleJobEvent);
    es.addEventListener('unlimited:paused', handleJobEvent);
    es.addEventListener('unlimited:completed', handleJobEvent);
    es.addEventListener('api_pool:updated', handlePoolEvent);
    es.addEventListener('api_pool:deleted', handlePoolDelete);
    return () => es.close();
  }, []);

  const readyApis = useMemo(
    () => apiPool.filter((a) => a.enabled && a.status === 'active'),
    [apiPool]
  );

  useEffect(() => {
    const readyIds = new Set(readyApis.map((a) => a.id));
    setSelectedApiIds((prev) => {
      const filtered = prev.filter((id) => readyIds.has(id));
      if (filtered.length === 0 && readyApis.length > 0) {
        return readyApis.map((a) => a.id);
      }
      return filtered;
    });
  }, [readyApis]);

  const parsedTargets = useMemo(() => {
    const combined: UnlimitedTargetItem[] = [...importedItems];

    if (rawTargetsText.trim()) {
      const lines = rawTargetsText.split(/[\n,;]+/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(/\t|\s+\|\s+/);
        const rawToken = parts[0].trim();
        if (!isValidTargetToken(rawToken)) continue;
        const { target, targetType } = classifyTarget(rawToken);
        combined.push({
          id: `txt_${i}_${target}`,
          target,
          targetType,
          name: parts[1]?.trim() || undefined,
        });
      }
    }

    if (!deduplicateTargets) return combined;

    const seen = new Set<string>();
    const unique: UnlimitedTargetItem[] = [];
    for (const item of combined) {
      const key = item.target.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique;
  }, [rawTargetsText, importedItems, deduplicateTargets]);

  const optedOutSet = useMemo(() => {
    const set = new Set<string>();
    contacts
      .filter((c) => c.optInStatus === 'opted_out' || c.optInStatus === 'dnc_suppressed')
      .forEach((c) => {
        if (c.telegramUid) set.add(c.telegramUid.toLowerCase());
        if (c.telegramUsername) set.add(`@${c.telegramUsername.replace(/^@/, '').toLowerCase()}`);
        if (c.phoneNumber) set.add(c.phoneNumber.toLowerCase());
      });
    return set;
  }, [contacts]);

  const targetBreakdown = useMemo(() => {
    let numeric = 0;
    let channel = 0;
    let username = 0;
    let phone = 0;
    for (const item of parsedTargets) {
      if (item.targetType === 'numeric_id') numeric++;
      else if (item.targetType === 'channel_id') channel++;
      else if (item.targetType === 'username') username++;
      else phone++;
    }
    return { numeric, channel, username, phone };
  }, [parsedTargets]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        setRawTargetsText((prev) => (prev ? `${prev}\n${text}` : text));
      } else {
        const rows = await parseUploadedSpreadsheet(file);
        const extracted: UnlimitedTargetItem[] = [];
        rows.forEach((row, idx) => {
          const candidate =
            row.telegram_id ??
            row.telegramUid ??
            row.chat_id ??
            row.chatId ??
            row.uid ??
            row.id ??
            row.ID ??
            row.username ??
            row.telegramUsername ??
            row.phone ??
            row.phoneNumber ??
            Object.values(row)[0];

          if (candidate === undefined || candidate === null) return;
          const rawStr = String(candidate).trim();
          if (!isValidTargetToken(rawStr)) return;
          const { target, targetType } = classifyTarget(rawStr);
          const customFields: Record<string, string> = {};
          Object.entries(row).forEach(([k, v]) => {
            if (v !== undefined && v !== null) customFields[k] = String(v);
          });
          extracted.push({
            id: `file_${Date.now()}_${idx}`,
            target,
            targetType,
            name: row.name || row.Name || row.first_name || row.First_Name || undefined,
            customFields,
          });
        });
        setImportedItems((prev) => [...prev, ...extracted]);
      }
    } catch (err: any) {
      setDispatchError(`File parse error: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLaunchUnlimitedDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchError(null);

    if (parsedTargets.length === 0) {
      setDispatchError('Provide at least 1 valid Telegram ID, @username, or phone.');
      return;
    }
    if (selectedApiIds.length === 0) {
      setDispatchError('Select at least 1 active API slot for dispatching.');
      return;
    }
    if (!messageText.trim()) {
      setDispatchError('Message content cannot be empty.');
      return;
    }

    setLaunching(true);
    try {
      const firstChunk = parsedTargets.slice(0, CHUNK_SIZE);
      setLaunchProgress(
        `Queueing batch (${firstChunk.length.toLocaleString()} / ${parsedTargets.length.toLocaleString()})...`
      );

      const safeMinDelayMs = Math.max(50, Number(minDelayMs) || 150);
      const safeMaxDelayMs = Math.max(safeMinDelayMs, Number(maxDelayMs) || 400);

      const res = await fetch('/api/dispatch/unlimited', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchName.trim() || `Unlimited ID Batch (${parsedTargets.length.toLocaleString()})`,
          messageText,
          targets: firstChunk.map((t) => ({
            target: t.target,
            targetType: t.targetType,
            name: t.name,
            customFields: t.customFields,
          })),
          apiIds: selectedApiIds,
          routingStrategy,
          minDelayMs: safeMinDelayMs,
          maxDelayMs: safeMaxDelayMs,
          autoAppendOptOutFooter: false,
          optedOutTargets: Array.from(optedOutSet),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setDispatchError(data.error || 'Failed to launch unlimited dispatch.');
        return;
      }

      let currentJob: UnlimitedDispatchJob = data.job;
      setActiveJobId(currentJob.jobId);
      setJobs((prev) => [currentJob, ...prev.filter((j) => j.jobId !== currentJob.jobId)]);

      let appendFailedCount = 0;
      for (let offset = CHUNK_SIZE; offset < parsedTargets.length; offset += CHUNK_SIZE) {
        const nextChunk = parsedTargets.slice(offset, offset + CHUNK_SIZE);
        setLaunchProgress(
          `Streaming targets (${Math.min(offset + CHUNK_SIZE, parsedTargets.length).toLocaleString()} / ${parsedTargets.length.toLocaleString()})...`
        );
        const appRes = await fetch(`/api/dispatch/unlimited/${currentJob.jobId}/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targets: nextChunk.map((t) => ({
              target: t.target,
              targetType: t.targetType,
              name: t.name,
              customFields: t.customFields,
            })),
          }),
        });
        if (appRes.ok) {
          const appData = await appRes.json();
          if (appData.job) currentJob = appData.job;
        } else {
          appendFailedCount += nextChunk.length;
        }
      }

      setJobs((prev) => prev.map((j) => (j.jobId === currentJob.jobId ? currentJob : j)));
      if (appendFailedCount > 0) {
        setDispatchError(`Batch started, but ${appendFailedCount.toLocaleString()} targets failed to append.`);
      }
    } catch (err: any) {
      setDispatchError(err.message || 'Network failure during launch.');
    } finally {
      setLaunching(false);
      setLaunchProgress(null);
    }
  };

  const handleControlJob = async (jobId: string, action: 'pause' | 'resume' | 'abort') => {
    try {
      const res = await fetch(`/api/dispatch/unlimited/${jobId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.job) {
        setJobs((prev) => prev.map((j) => (j.jobId === jobId ? data.job : j)));
      }
    } catch {}
  };

  const handleExportReport = async (jobId: string, format: 'xlsx' | 'csv') => {
    try {
      const res = await fetch(`/api/dispatch/unlimited/${jobId}/results`);
      if (!res.ok) return;
      const data = await res.json();
      const rows = (data.targets || []).map((t: UnlimitedTargetItem) => ({
        Target_ID: t.target,
        Type: t.targetType,
        Name: t.name || '',
        Status: t.status || 'pending',
        API_Used: t.usedApiLabel || '',
        Sent_At: t.sentAt || '',
        Error: t.error || '',
      }));
      if (format === 'xlsx') exportToExcel(rows, `unlimited_dispatch_${jobId}`, 'Dispatch_Results');
      else exportToCSV(rows, `unlimited_dispatch_${jobId}`);
    } catch {}
  };

  const activeJob = jobs.find((j) => j.jobId === activeJobId) || jobs[0] || null;

  return (
    <div className="space-y-5">
      {/* Compact Page Header */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-sky-500" />
          <span>Unlimited IDs &amp; Multi-API Dispatch</span>
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          Broadcast to any volume of Telegram Numeric IDs, Channel IDs, @usernames, or phones across your connected APIs.
        </p>
      </div>

      {/* Main Dispatch Composer + Live Queue Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleLaunchUnlimitedDispatch}
          className="lg:col-span-7 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Target Queue &amp; Composer
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Paste or upload IDs, -100 Channels, @usernames, or phones
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 text-sky-500" />
                <span>Import File</span>
              </button>
            </div>
          </div>

          {/* Simple Active APIs Selector */}
          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Select Active APIs ({selectedApiIds.length} / {readyApis.length})
              </span>
              {readyApis.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedApiIds(readyApis.map((a) => a.id))}
                    className="text-sky-600 dark:text-sky-400 hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-neutral-300 dark:text-neutral-700">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedApiIds([])}
                    className="text-neutral-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            {readyApis.length === 0 ? (
              <p className="text-[11px] text-neutral-500">
                No active APIs available. Add or enable gateways in All Gateways &amp; APIs.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {readyApis.map((slot) => {
                  const checked = selectedApiIds.includes(slot.id);
                  return (
                    <label
                      key={slot.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] cursor-pointer ${
                        checked
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 font-medium'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedApiIds((prev) => Array.from(new Set([...prev, slot.id])));
                          } else {
                            setSelectedApiIds((prev) => prev.filter((id) => id !== slot.id));
                          }
                        }}
                        className="accent-sky-600"
                      />
                      <span>{slot.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Batch Name
              </label>
              <input
                type="text"
                placeholder="e.g. Unlimited ID Broadcast"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Routing Strategy
              </label>
              <select
                value={routingStrategy}
                onChange={(e) => setRoutingStrategy(e.target.value as UnlimitedRoutingStrategy)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              >
                <option value="round_robin">Round-Robin (Distribute Evenly)</option>
                <option value="failover">Auto-Failover (Primary → Fallback)</option>
                <option value="least_used">Least-Used Quota Balancing</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Telegram IDs / @Usernames / Phones
              </label>
              {(rawTargetsText || importedItems.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setRawTargetsText('');
                    setImportedItems([]);
                  }}
                  className="text-[11px] text-rose-500 hover:underline"
                >
                  Clear List
                </button>
              )}
            </div>
            <textarea
              rows={5}
              value={rawTargetsText}
              onChange={(e) => setRawTargetsText(e.target.value)}
              placeholder={`782910412\n-1001928374650\n@marcus_vance\n+8801711000201`}
              className="w-full text-xs font-mono p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-neutral-900 dark:text-white">
                  {parsedTargets.length.toLocaleString()} Total
                </strong>
                <span>·</span>
                <span>{targetBreakdown.numeric} IDs</span>
                <span>·</span>
                <span>{targetBreakdown.channel} Channels</span>
                <span>·</span>
                <span>{targetBreakdown.username} @Handles</span>
                <span>·</span>
                <span>{targetBreakdown.phone} Phones</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deduplicateTargets}
                  onChange={(e) => setDeduplicateTargets(e.target.checked)}
                  className="rounded text-sky-600"
                />
                <span>Deduplicate</span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Message Template
              </label>
              <span className="text-[11px] text-neutral-400 font-mono">
                {'{{name}} {{id}} {{target}}'}
              </span>
            </div>
            <textarea
              rows={4}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Min Delay (ms)
              </label>
              <input
                type="number"
                min={25}
                value={minDelayMs}
                onChange={(e) => setMinDelayMs(Number(e.target.value))}
                className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Max Delay (ms)
              </label>
              <input
                type="number"
                min={50}
                value={maxDelayMs}
                onChange={(e) => setMaxDelayMs(Number(e.target.value))}
                className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
          </div>

          {dispatchError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{dispatchError}</span>
            </div>
          )}

          {launchProgress && (
            <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs text-sky-700 dark:text-sky-300">
              {launchProgress}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {parsedTargets.length.toLocaleString()} targets via {selectedApiIds.length} APIs
            </span>
            <button
              type="submit"
              disabled={launching || parsedTargets.length === 0 || selectedApiIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-400 text-white transition-colors whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{launching ? 'Queueing...' : 'Start Unlimited Dispatch'}</span>
            </button>
          </div>
        </form>

        {/* Right 5 Cols: Live Dispatch Monitor */}
        <div className="lg:col-span-5 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Live Dispatch Monitor
            </h2>
            {jobs.length > 1 && (
              <select
                value={activeJob?.jobId || ''}
                onChange={(e) => setActiveJobId(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 max-w-[190px]"
              >
                {jobs.map((j) => (
                  <option key={j.jobId} value={j.jobId}>
                    {j.name} ({j.processedCount}/{j.totalTargets})
                  </option>
                ))}
              </select>
            )}
          </div>

          {!activeJob ? (
            <div className="py-12 text-center text-xs text-neutral-400 space-y-2">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-700" />
              <div>Add targets and select APIs on the left to start dispatching.</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-white truncate">
                    {activeJob.name}
                  </span>
                  <span
                    className={`font-semibold uppercase text-[11px] ${
                      activeJob.status === 'running'
                        ? 'text-sky-600 dark:text-sky-400'
                        : activeJob.status === 'completed'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : activeJob.status === 'paused'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-500'
                    }`}
                  >
                    {activeJob.status}
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-200"
                    style={{
                      width: `${
                        activeJob.totalTargets > 0
                          ? Math.min(100, Math.round((activeJob.processedCount / activeJob.totalTargets) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center pt-1 tabular-nums">
                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">Total</div>
                    <div className="text-sm font-bold text-neutral-900 dark:text-white">
                      {activeJob.totalTargets.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">Sent</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {activeJob.sentCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">Failed</div>
                    <div className="text-sm font-bold text-rose-500">
                      {activeJob.failedCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">Opt-Out</div>
                    <div className="text-sm font-bold text-amber-500">
                      {activeJob.skippedOptOutCount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {activeJob.status === 'running' ? (
                    <button
                      type="button"
                      onClick={() => handleControlJob(activeJob.jobId, 'pause')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <Pause className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pause</span>
                    </button>
                  ) : activeJob.status === 'paused' ? (
                    <button
                      type="button"
                      onClick={() => handleControlJob(activeJob.jobId, 'resume')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>
                  ) : null}

                  {(activeJob.status === 'running' || activeJob.status === 'paused') && (
                    <button
                      type="button"
                      onClick={() => handleControlJob(activeJob.jobId, 'abort')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Square className="w-3 h-3" />
                      <span>Stop</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportReport(activeJob.jobId, 'xlsx')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportReport(activeJob.jobId, 'csv')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-500" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5">
                <div className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                  Recent Delivery Stream
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-[11px] bg-neutral-950 text-neutral-200 p-3 rounded-lg">
                  {activeJob.recentLogs.length === 0 ? (
                    <div className="text-neutral-500">Waiting for worker ticks...</div>
                  ) : (
                    activeJob.recentLogs.map((entry, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2">
                        <span
                          className={
                            entry.status === 'sent'
                              ? 'text-emerald-400'
                              : entry.status === 'skipped_opt_out'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }
                        >
                          [{entry.status === 'sent' ? 'OK' : entry.status === 'skipped_opt_out' ? 'OPT-OUT' : 'ERR'}]{' '}
                          {entry.target} → {entry.apiLabel}
                          {entry.detail ? ` (${entry.detail})` : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
