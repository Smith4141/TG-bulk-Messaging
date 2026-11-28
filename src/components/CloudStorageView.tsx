import React, { useState } from 'react';
import {
  HardDrive,
  Upload,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  FileCode,
  Download,
  Copy,
  Check,
  Trash2,
  Lock,
} from 'lucide-react';
import { CloudFile, UserAccount } from '../types';

interface CloudStorageViewProps {
  cloudFiles: CloudFile[];
  currentUser: UserAccount;
  onUploadFile: (file: Omit<CloudFile, 'id' | 'uploadedAt'>) => void;
  onDeleteFile: (id: string) => void;
}

export const CloudStorageView: React.FC<CloudStorageViewProps> = ({
  cloudFiles,
  currentUser,
  onUploadFile,
  onDeleteFile,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadNotice(null);
    const submitFile = (url: string) => {
      onUploadFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url,
        encrypted: true,
      });
      setUploadNotice(`Uploaded "${file.name}" (${formatBytes(file.size)}) to repository.`);
      setTimeout(() => setUploadNotice(null), 3500);
    };

    if (file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          submitFile(reader.result);
        } else {
          submitFile(URL.createObjectURL(file));
        }
      };
      reader.onerror = () => submitFile(URL.createObjectURL(file));
      reader.readAsDataURL(file);
    } else {
      submitFile(URL.createObjectURL(file));
    }
  };

  const handleCopyLink = async (file: CloudFile) => {
    try {
      await navigator.clipboard.writeText(file.url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = file.url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadFile = (file: CloudFile) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalBytesUsed = cloudFiles.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
  const quotaLimitBytes = 500 * 1024 * 1024 * 1024;
  const usedPct = Math.min(100, Math.max(cloudFiles.length > 0 ? 1 : 0, Math.round((totalBytesUsed / quotaLimitBytes) * 100)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Secure Cloud Media &amp; Data Storage
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
              AES-256 Server-Side Encrypted
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Store promotional brochures, video teasers, catalogs, and customer data export backups with high-speed CDN delivery.
          </p>
        </div>

        <label
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-white transition-all cursor-pointer ${
            currentUser.role === 'viewer'
              ? 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed opacity-60'
              : 'bg-sky-600 hover:bg-sky-500 shadow-sm shadow-sky-600/20'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Asset</span>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={currentUser.role === 'viewer'}
            className="hidden"
          />
        </label>
      </div>

      {uploadNotice && (
        <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{uploadNotice}</span>
        </div>
      )}

      {/* Storage Quota Card */}
      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-900 dark:text-white">
              Enterprise Tenant Storage Quota
            </div>
            <div className="text-[11px] text-neutral-500">
              {formatBytes(totalBytesUsed)} used across {cloudFiles.length} asset(s) · 500 GB limit
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-40 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full" style={{ width: `${usedPct}%` }} />
          </div>
          <span className="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300">
            {usedPct}%
          </span>
        </div>
      </div>

      {/* Files List */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Cloud Assets Repository ({cloudFiles.length})
          </h2>
          <div className="flex items-center gap-1 text-[11px] text-emerald-500">
            <Lock className="w-3 h-3" />
            <span>End-to-End Encrypted</span>
          </div>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {cloudFiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No assets uploaded yet. Click &quot;Upload Asset&quot; to store brochures, images, or export files.
            </div>
          ) : (
            cloudFiles.map((file) => (
              <div
                key={file.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {file.type.includes('image') ? (
                      <ImageIcon className="w-4 h-4 text-sky-500" />
                    ) : file.type.includes('pdf') ? (
                      <FileText className="w-4 h-4 text-red-500" />
                    ) : (
                      <FileCode className="w-4 h-4 text-purple-500" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                      <span>{formatBytes(file.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Uploaded {file.uploadedAt}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-500 font-medium">AES-256</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(file)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(file)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1 transition-colors"
                  >
                    {copiedId === file.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === file.id ? 'Copied Link' : 'Copy Link'}</span>
                  </button>

                  {currentUser.role !== 'viewer' && (
                    <button
                      type="button"
                      onClick={() => onDeleteFile(file.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
