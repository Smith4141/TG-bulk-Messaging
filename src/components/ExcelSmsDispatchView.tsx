import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Globe,
  Pause,
  Play,
  Send,
  Square,
  Upload,
} from 'lucide-react';
import {
  ApiProviderType,
  TelegramApiSlot,
  UnlimitedDispatchJob,
  UnlimitedTargetItem,
  UserbotSession,
} from '../types';
import {
  downloadSampleSmsExcelTemplate,
  exportToCSV,
  exportToExcel,
  normalizePhoneNumber,
  parseUploadedSpreadsheet,
} from '../services/telegramService';

interface ExcelSmsDispatchViewProps {
  userbotSessions: UserbotSession[];
}

type DeliveryMode = 'mtproto_only' | 'tg_then_sms' | 'sms_only';

const COUNTRY_PRESETS = [
  { label: 'Mixed International (Keep + / 00)', code: '' },
  { label: 'Bangladesh (+880)', code: '+880' },
  { label: 'UAE (+971)', code: '+971' },
  { label: 'Saudi Arabia (+966)', code: '+966' },
  { label: 'Qatar (+974)', code: '+974' },
  { label: 'Kuwait (+965)', code: '+965' },
  { label: 'Malaysia (+60)', code: '+60' },
  { label: 'Singapore (+65)', code: '+65' },
  { label: 'UK (+44)', code: '+44' },
  { label: 'US / Canada (+1)', code: '+1' },
  { label: 'India (+91)', code: '+91' },
  { label: 'Pakistan (+92)', code: '+92' },
  { label: 'Australia (+61)', code: '+61' },
];

const CHUNK_SIZE = 2000;

interface ParsedExcelPhoneRow {
  id: string;
  rawPhone: string;
  formattedPhone: string;
  isValid: boolean;
  countryCode: string;
  name?: string;
  customFields: Record<string, string>;
}

const isSmsType = (t: ApiProviderType) => t === 'sms_http' || t === 'sms_twilio';

export const ExcelSmsDispatchView: React.FC<ExcelSmsDispatchViewProps> = ({
  userbotSessions,
}) => {
  const [apiPool, setApiPool] = useState<TelegramApiSlot[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('mtproto_only');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [rawSheetRows, setRawSheetRows] = useState<Record<string, any>[]>([]);
  const [sheetColumns, setSheetColumns] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState<string>('');
  const [nameColumn, setNameColumn] = useState<string>('');
  const [pastedNumbers, setPastedNumbers] = useState('');
  const [defaultCountryCode, setDefaultCountryCode] = useState('');
  const [deduplicate, setDeduplicate] = useState(true);

  const [batchName, setBatchName] = useState('');
  const [messageText, setMessageText] = useState(
    'Hello {{Name}}, greetings from our international team! Reference: {{Order_ID}}.'
  );
  const [minDelayMs, setMinDelayMs] = useState(350);
  const [maxDelayMs, setMaxDelayMs] = useState(900);
  const [jobs, setJobs] = useState<UnlimitedDispatchJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/api-pool')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.apis) setApiPool(data.apis);
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

  const readySlots = useMemo(
    () =>
      apiPool.filter(
        (s) =>
          s.enabled &&
          s.status === 'active' &&
          (isSmsType(s.type) ||
            (s.type === 'mtproto' && s.isLiveTelegramClient))
      ),
    [apiPool]
  );

  const liveMtprotoSlots = useMemo(
    () => readySlots.filter((s) => s.type === 'mtproto'),
    [readySlots]
  );
  const smsSlots = useMemo(
    () => readySlots.filter((s) => isSmsType(s.type)),
    [readySlots]
  );
  const readySlotKey = useMemo(
    () => readySlots.map((s) => `${s.id}:${s.status}`).join(','),
    [readySlots]
  );

  useEffect(() => {
    const activeLiveMt = liveMtprotoSlots.map((s) => s.id);
    const activeSms = smsSlots.map((s) => s.id);

    if (deliveryMode === 'mtproto_only') {
      setSelectedSlotIds(activeLiveMt);
    } else if (deliveryMode === 'sms_only') {
      setSelectedSlotIds(activeSms);
    } else {
      setSelectedSlotIds([...activeLiveMt, ...activeSms]);
    }
  }, [deliveryMode, readySlotKey, userbotSessions.length]);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);

    try {
      if (file.name.toLowerCase().endsWith('.txt')) {
        const txt = await file.text();
        setPastedNumbers((prev) => (prev ? `${prev}\n${txt}` : txt));
        setUploadedFileName(file.name);
      } else {
        const rows = await parseUploadedSpreadsheet(file);
        if (rows.length === 0) {
          setFeedback({ ok: false, text: `No rows found inside "${file.name}".` });
          return;
        }
        const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
        setRawSheetRows(rows);
        setSheetColumns(cols);
        setUploadedFileName(file.name);

        const autoPhoneCol =
          cols.find((c) =>
            /^(phone|mobile|number|msisdn|telegram|contact|phone_number|tel|cell|নাম্বার)$/i.test(
              c.trim()
            )
          ) ||
          cols.find((c) => /phone|mobile|number|msisdn/i.test(c)) ||
          cols[0] ||
          '';
        const autoNameCol =
          cols.find((c) => /^(name|full_name|customer_name|first_name|নাম)$/i.test(c.trim())) ||
          cols.find((c) => /name/i.test(c) && c !== autoPhoneCol) ||
          '';

        setPhoneColumn(autoPhoneCol);
        setNameColumn(autoNameCol);
        setFeedback({
          ok: true,
          text: `Loaded ${rows.length.toLocaleString()} rows from "${file.name}".`,
        });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: `Failed to parse Excel/CSV file: ${err.message}` });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const parsedRows = useMemo<ParsedExcelPhoneRow[]>(() => {
    const items: ParsedExcelPhoneRow[] = [];

    rawSheetRows.forEach((row, idx) => {
      const colKey = phoneColumn || Object.keys(row)[0];
      const rawVal = colKey ? String(row[colKey] ?? '').trim() : '';
      if (!rawVal) return;

      const norm = normalizePhoneNumber(rawVal, defaultCountryCode || undefined);
      const customFields: Record<string, string> = {};
      Object.entries(row).forEach(([k, v]) => {
        if (v !== undefined && v !== null) customFields[k] = String(v);
      });
      const resolvedName = nameColumn ? String(row[nameColumn] ?? '').trim() : undefined;
      if (resolvedName && !customFields.Name) customFields.Name = resolvedName;

      items.push({
        id: `xls_${idx}`,
        rawPhone: rawVal,
        formattedPhone: norm.formatted || rawVal,
        isValid: norm.isValid,
        countryCode: norm.countryCode,
        name: resolvedName || undefined,
        customFields,
      });
    });

    if (pastedNumbers.trim()) {
      const lines = pastedNumbers.split(/[\n,;]+/);
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const parts = trimmed.split(/\t|\s+\|\s+/);
        const rawVal = parts[0].trim();
        const norm = normalizePhoneNumber(rawVal, defaultCountryCode || undefined);
        const resolvedName = parts[1]?.trim() || undefined;
        items.push({
          id: `txt_${idx}`,
          rawPhone: rawVal,
          formattedPhone: norm.formatted || rawVal,
          isValid: norm.isValid,
          countryCode: norm.countryCode,
          name: resolvedName,
          customFields: resolvedName ? { Name: resolvedName } : {},
        });
      });
    }

    if (!deduplicate) return items;
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.formattedPhone;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawSheetRows, phoneColumn, nameColumn, pastedNumbers, defaultCountryCode, deduplicate]);

  const validRows = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter((r) => !r.isValid), [parsedRows]);

  const handleLaunchDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (validRows.length === 0) {
      setFeedback({
        ok: false,
        text: 'Upload an Excel sheet or paste at least 1 valid international phone number.',
      });
      return;
    }
    if (!messageText.trim()) {
      setFeedback({ ok: false, text: 'Message text cannot be empty.' });
      return;
    }

    const chosenSlots = readySlots.filter((s) => selectedSlotIds.includes(s.id));
    const mtIds = chosenSlots.filter((s) => s.type === 'mtproto').map((s) => s.id);
    const smsIds = chosenSlots.filter((s) => isSmsType(s.type)).map((s) => s.id);

    let orderedIds: string[] = [];
    if (deliveryMode === 'mtproto_only') orderedIds = mtIds;
    else if (deliveryMode === 'sms_only') orderedIds = smsIds;
    else orderedIds = [...mtIds, ...smsIds];

    if (orderedIds.length === 0) {
      setFeedback({
        ok: false,
        text: 'Select at least 1 active gateway matching the chosen delivery mode (add gateways in All Gateways & APIs).',
      });
      return;
    }

    const queuedTargets = validRows.map((r) => ({
      target: r.formattedPhone,
      targetType: 'phone' as const,
      name: r.name,
      customFields: r.customFields,
    }));

    const routingStrategy =
      deliveryMode === 'tg_then_sms' ? 'failover' : 'round_robin';

    setLaunching(true);
    try {
      const firstChunk = queuedTargets.slice(0, CHUNK_SIZE);
      setLaunchProgress(
        `Queueing ${firstChunk.length.toLocaleString()} / ${queuedTargets.length.toLocaleString()} dispatches...`
      );

      const safeMinDelayMs = Math.max(50, Number(minDelayMs) || 150);
      const safeMaxDelayMs = Math.max(safeMinDelayMs, Number(maxDelayMs) || 450);

      const res = await fetch('/api/dispatch/unlimited', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:
            batchName.trim() ||
            `Phone Dispatch (${uploadedFileName || `${validRows.length.toLocaleString()} numbers`})`,
          messageText,
          targets: firstChunk,
          apiIds: orderedIds,
          routingStrategy,
          minDelayMs: safeMinDelayMs,
          maxDelayMs: safeMaxDelayMs,
          autoAppendOptOutFooter: false,
          optedOutTargets: [],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ ok: false, text: data.error || 'Failed to start international dispatch.' });
        return;
      }

      let currentJob: UnlimitedDispatchJob = data.job;
      setActiveJobId(currentJob.jobId);
      setJobs((prev) => [currentJob, ...prev.filter((j) => j.jobId !== currentJob.jobId)]);

      let chunkFailedCount = 0;
      for (let offset = CHUNK_SIZE; offset < queuedTargets.length; offset += CHUNK_SIZE) {
        const nextChunk = queuedTargets.slice(offset, offset + CHUNK_SIZE);
        setLaunchProgress(
          `Uploading queue (${Math.min(offset + CHUNK_SIZE, queuedTargets.length).toLocaleString()} / ${queuedTargets.length.toLocaleString()})...`
        );
        const appRes = await fetch(`/api/dispatch/unlimited/${currentJob.jobId}/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets: nextChunk }),
        });
        if (appRes.ok) {
          const appData = await appRes.json();
          if (appData.job) currentJob = appData.job;
        } else {
          chunkFailedCount += nextChunk.length;
        }
      }

      setJobs((prev) => prev.map((j) => (j.jobId === currentJob.jobId ? currentJob : j)));
      if (chunkFailedCount > 0) {
        setFeedback({
          ok: false,
          text: `Dispatch started, but ${chunkFailedCount.toLocaleString()} queued items failed to append. Check server connectivity.`,
        });
      } else {
        setFeedback({
          ok: true,
          text: `Dispatched ${queuedTargets.length.toLocaleString()} messages across ${validRows.length.toLocaleString()} phone numbers.`,
        });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message || 'Network error launching dispatch.' });
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
        Phone_Number: t.target,
        Name: t.name || '',
        Channel: t.channelLabel || t.usedApiLabel || '',
        Status: t.status || 'pending',
        Gateway_Used: t.usedApiLabel || '',
        Sent_At: t.sentAt || '',
        Error: t.error || '',
      }));
      if (format === 'xlsx') exportToExcel(rows, `phone_dispatch_${jobId}`, 'Dispatch_Report');
      else exportToCSV(rows, `phone_dispatch_${jobId}`);
    } catch {}
  };

  const activeJob = jobs.find((j) => j.jobId === activeJobId) || jobs[0] || null;
  const activeJobProgressPct =
    activeJob && activeJob.totalTargets > 0
      ? Math.round((activeJob.processedCount / activeJob.totalTargets) * 100)
      : 0;

  const mergeVariables = useMemo(() => {
    const base = ['Name', 'Phone'];
    const extras = sheetColumns.filter(
      (c) => c !== phoneColumn && c !== nameColumn && c !== 'Name' && c !== 'Phone'
    );
    return [...base, ...extras.slice(0, 8)];
  }, [sheetColumns, phoneColumn, nameColumn]);

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            <span>Send to Phone Numbers (Telegram MTProto &amp; Direct SMS)</span>
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Upload an Excel/CSV sheet or paste any international phone numbers and broadcast directly without Bot <code>/start</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={downloadSampleSmsExcelTemplate}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-emerald-500" />
          <span>Excel Template</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            feedback.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Composer + Live Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleLaunchDispatch}
          className="lg:col-span-7 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>Import Phone Numbers &amp; Compose</span>
              </h2>
              <p className="text-xs text-neutral-500">
                Supports <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>, or pasted international numbers.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Excel / CSV</span>
              </button>
            </div>
          </div>

          {/* Parsing & Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Country Parsing Rule
              </label>
              <select
                value={defaultCountryCode}
                onChange={(e) => setDefaultCountryCode(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                {COUNTRY_PRESETS.map((c) => (
                  <option key={c.label} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Phone Column
              </label>
              <select
                value={phoneColumn}
                disabled={sheetColumns.length === 0}
                onChange={(e) => setPhoneColumn(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 disabled:opacity-50"
              >
                {sheetColumns.length === 0 ? (
                  <option value="">Upload file first</option>
                ) : (
                  sheetColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Name Column (Optional)
              </label>
              <select
                value={nameColumn}
                disabled={sheetColumns.length === 0}
                onChange={(e) => setNameColumn(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 disabled:opacity-50"
              >
                <option value="">None</option>
                {sheetColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Paste numbers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Paste International Numbers (one per line or comma-separated)
              </label>
              {(rawSheetRows.length > 0 || pastedNumbers.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setRawSheetRows([]);
                    setSheetColumns([]);
                    setUploadedFileName(null);
                    setPastedNumbers('');
                  }}
                  className="text-[11px] text-rose-500 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={pastedNumbers}
              onChange={(e) => setPastedNumbers(e.target.value)}
              placeholder={
                '+8801711000001\tRahim\n+971501234567\tTariq\n+447911123456\tOliver\n+14155550199\tSarah'
              }
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 tabular-nums">
              <div className="flex items-center gap-3">
                {uploadedFileName && (
                  <span className="font-medium text-sky-600 dark:text-sky-400">
                    File: {uploadedFileName}
                  </span>
                )}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Valid: {validRows.length.toLocaleString()}
                </span>
                {invalidRows.length > 0 && (
                  <span className="text-rose-500">Invalid: {invalidRows.length}</span>
                )}
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deduplicate}
                  onChange={(e) => setDeduplicate(e.target.checked)}
                  className="accent-sky-600"
                />
                <span>Deduplicate</span>
              </label>
            </div>
          </div>

          {parsedRows.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-[11px] tabular-nums">
                <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  <tr>
                    <th className="py-1.5 px-2.5 font-medium">#</th>
                    <th className="py-1.5 px-2.5 font-medium">E.164 Number</th>
                    <th className="py-1.5 px-2.5 font-medium">Country</th>
                    <th className="py-1.5 px-2.5 font-medium">Name</th>
                    <th className="py-1.5 px-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                  {parsedRows.slice(0, 50).map((row, idx) => (
                    <tr key={row.id}>
                      <td className="py-1 px-2.5 text-neutral-400">{idx + 1}</td>
                      <td className="py-1 px-2.5 font-mono text-neutral-900 dark:text-neutral-100">
                        {row.formattedPhone}
                      </td>
                      <td className="py-1 px-2.5 text-neutral-500">{row.countryCode || '—'}</td>
                      <td className="py-1 px-2.5 text-neutral-700 dark:text-neutral-300">
                        {row.name || '—'}
                      </td>
                      <td className="py-1 px-2.5">
                        {row.isValid ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Valid</span>
                        ) : (
                          <span className="text-rose-500">Invalid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Delivery Channel & Campaign Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Channel Mode
              </label>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              >
                <option value="mtproto_only">Telegram MTProto Direct Only</option>
                <option value="tg_then_sms">Failover: Telegram MTProto → Direct SMS</option>
                <option value="sms_only">Direct Mobile SMS Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Campaign Name
              </label>
              <input
                type="text"
                placeholder="e.g. Global Promo"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
          </div>

          {/* Simple Active Senders Checkboxes */}
          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Active Senders ({selectedSlotIds.length} selected)
              </span>
              <span className="text-[11px] text-neutral-500 tabular-nums">
                TG: {liveMtprotoSlots.length} · SMS: {smsSlots.length}
              </span>
            </div>
            {readySlots.length === 0 ? (
              <p className="text-[11px] text-neutral-500">
                No active Telegram MTProto or Direct SMS gateways connected yet. Configure them under All Gateways &amp; APIs.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {readySlots.map((slot) => {
                  const checked = selectedSlotIds.includes(slot.id);
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
                            setSelectedSlotIds((prev) => Array.from(new Set([...prev, slot.id])));
                          } else {
                            setSelectedSlotIds((prev) => prev.filter((id) => id !== slot.id));
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

          {/* Message Composer */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Message Content
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {mergeVariables.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMessageText((prev) => `${prev} {{${v}}}`)}
                    className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-neutral-100 dark:bg-neutral-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                  >
                    +{'{{' + v + '}}'}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={4}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500 tabular-nums">
              <span>{messageText.length} characters</span>
              <div className="flex items-center gap-1.5">
                <span>Delay (ms):</span>
                <input
                  type="number"
                  min={50}
                  value={minDelayMs}
                  onChange={(e) => setMinDelayMs(Number(e.target.value))}
                  className="w-14 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
                <span>–</span>
                <input
                  type="number"
                  min={minDelayMs}
                  value={maxDelayMs}
                  onChange={(e) => setMaxDelayMs(Number(e.target.value))}
                  className="w-14 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={launching || validRows.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>
              {launching
                ? launchProgress || 'Starting...'
                : deliveryMode === 'mtproto_only'
                ? `Send Telegram Messages to ${validRows.length.toLocaleString()} Numbers`
                : `Send Bulk Messages to ${validRows.length.toLocaleString()} Numbers`}
            </span>
          </button>
        </form>

        {/* Right 5 Cols: Live Delivery Monitor */}
        <div className="lg:col-span-5 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Live Delivery Monitor
            </h2>
            {jobs.length > 0 && (
              <select
                value={activeJob?.jobId || ''}
                onChange={(e) => setActiveJobId(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 max-w-[190px]"
              >
                {jobs.map((j) => (
                  <option key={j.jobId} value={j.jobId}>
                    {j.name} ({j.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {!activeJob ? (
            <div className="py-12 text-center text-xs text-neutral-400">
              Upload a phone list and launch a dispatch to watch live delivery progress here.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                    {activeJob.name}
                  </span>
                  <span className="text-neutral-500">
                    {activeJob.processedCount.toLocaleString()} /{' '}
                    {activeJob.totalTargets.toLocaleString()}
                  </span>
                </div>
                <progress
                  max={100}
                  value={activeJobProgressPct}
                  className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-neutral-200 dark:[&::-webkit-progress-bar]:bg-neutral-800 [&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50">
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase">
                    Sent
                  </div>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {activeJob.sentCount.toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/50">
                  <div className="text-[10px] text-rose-700 dark:text-rose-300 uppercase">
                    Failed
                  </div>
                  <div className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    {activeJob.failedCount.toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-[10px] text-neutral-500 uppercase">Status</div>
                  <div className="text-xs font-bold capitalize text-neutral-800 dark:text-neutral-200 mt-0.5">
                    {activeJob.status}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeJob.status === 'running' && (
                  <button
                    type="button"
                    onClick={() => handleControlJob(activeJob.jobId, 'pause')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-500" />
                    <span>Pause</span>
                  </button>
                )}
                {activeJob.status === 'paused' && (
                  <button
                    type="button"
                    onClick={() => handleControlJob(activeJob.jobId, 'resume')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Resume</span>
                  </button>
                )}
                {(activeJob.status === 'running' || activeJob.status === 'paused') && (
                  <button
                    type="button"
                    onClick={() => handleControlJob(activeJob.jobId, 'abort')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-rose-200 dark:border-rose-900 text-rose-600"
                  >
                    <Square className="w-3 h-3" />
                    <span>Stop</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleExportReport(activeJob.jobId, 'xlsx')}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Export .xlsx</span>
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {activeJob.recentLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-400">
                    Waiting for first dispatch...
                  </div>
                ) : (
                  activeJob.recentLogs.map((log, i) => (
                    <div
                      key={`${log.target}_${i}`}
                      className="px-3 py-2 text-[11px] flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {log.target}
                        </div>
                        <div className="text-neutral-500 truncate">
                          {log.apiLabel}
                          {log.detail ? ` · ${log.detail}` : ''}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-semibold ${
                          log.status === 'sent'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-500'
                        }`}
                      >
                        {log.status === 'sent' ? 'Sent' : 'Failed'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
