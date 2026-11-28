import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  UserPlus,
  Shuffle,
  Trash2,
  Eye,
  EyeOff,
  MessageSquare,
  Send,
  Zap,
  ArrowRight,
  Lock,
  KeyRound,
  UserCheck,
  UserX,
  Clock,
  ShieldAlert,
  Ban,
  RefreshCw,
} from 'lucide-react';
import {
  Contact,
  ModeratorRoutingConfig,
  ModeratorRoutingMode,
  SignupRequest,
  UserAccount,
  UserAccountStatus,
  UserRole,
} from '../types';

export interface CreateTeamUserPayload {
  name: string;
  username: string;
  password: string;
  email: string;
  role: 'admin' | 'moderator' | 'editor' | 'viewer';
  department: string;
}

export interface UpdateTeamUserPayload {
  role?: 'admin' | 'moderator' | 'editor' | 'viewer';
  status?: UserAccountStatus;
  password?: string;
}

export interface UpdateAdminCredentialsPayload {
  username?: string;
  name?: string;
  password?: string;
}

interface RoleManagementViewProps {
  allUsers: UserAccount[];
  signupRequests: SignupRequest[];
  currentUser: UserAccount;
  authorizedAdminEmail: string;
  adminPasswordConfigured: boolean;
  contacts: Contact[];
  moderatorRouting: ModeratorRoutingConfig;
  onUpdateModeratorRouting: (updates: Partial<ModeratorRoutingConfig>) => void;
  onRouteContactsToModerator: (moderatorId: string, scope: 'all' | 'unassigned' | string[]) => number | void;
  onDistributeRoundRobin: (scope: 'all' | 'unassigned') => number | void;
  onOpenModeratorInbox: (moderatorId: string) => void;
  onCreateUser: (newUser: CreateTeamUserPayload) => Promise<{ ok: boolean; error?: string }>;
  onUpdateUser: (userId: string, updates: UpdateTeamUserPayload) => Promise<{ ok: boolean; error?: string }>;
  onDeleteUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  onApproveSignup: (
    requestId: string,
    role: 'admin' | 'moderator' | 'editor' | 'viewer'
  ) => Promise<{ ok: boolean; error?: string }>;
  onRejectSignup: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdateAdminCredentials: (payload: UpdateAdminCredentialsPayload) => Promise<{ ok: boolean; error?: string }>;
  onResetAdminCredentials: () => Promise<{ ok: boolean; error?: string }>;
  onRefreshUsers?: () => Promise<void>;
}

export const RoleManagementView: React.FC<RoleManagementViewProps> = ({
  allUsers,
  signupRequests,
  currentUser,
  authorizedAdminEmail,
  adminPasswordConfigured,
  contacts,
  moderatorRouting,
  onUpdateModeratorRouting,
  onRouteContactsToModerator,
  onDistributeRoundRobin,
  onOpenModeratorInbox,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onApproveSignup,
  onRejectSignup,
  onUpdateAdminCredentials,
  onResetAdminCredentials,
  onRefreshUsers,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserAccount | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  const [requestFilter, setRequestFilter] = useState<'pending' | 'all'>('pending');
  const [approvalRoles, setApprovalRoles] = useState<
    Record<string, 'admin' | 'moderator' | 'editor' | 'viewer'>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Admin credential update state
  const [adminUsernameInput, setAdminUsernameInput] = useState(currentUser.username);
  const [adminNameInput, setAdminNameInput] = useState(currentUser.name);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [confirmResetAdmin, setConfirmResetAdmin] = useState(false);
  const [adminResetting, setAdminResetting] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setAdminUsernameInput(currentUser.username);
    setAdminNameInput(currentUser.name);
  }, [currentUser.username, currentUser.name]);

  const moderators = allUsers.filter((u) => u.role === 'moderator' && u.status !== 'suspended');
  const [selectedTargetModId, setSelectedTargetModId] = useState<string>(
    moderatorRouting.defaultModeratorId || moderators[0]?.id || ''
  );
  const [routingFeedback, setRoutingFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create user form state
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'moderator' | 'editor' | 'viewer'>('moderator');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartment, setNewDepartment] = useState('Customer Support & Inbox');
  const [showPassword, setShowPassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const isAdmin = currentUser.role === 'admin';
  const isTeamManager = currentUser.role === 'admin' || currentUser.role === 'editor';

  // Strict Admin & Editor access guard
  if (!isTeamManager) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-neutral-900 text-center space-y-3 shadow-sm">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-neutral-900 dark:text-white">
          Authorization Required
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          User Role Management, account approvals, and user provisioning are restricted to Administrators and Editors.
        </p>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setActionError(null);
    setRoutingFeedback(msg);
    setTimeout(() => setRoutingFeedback(null), 4000);
  };

  const handleAdminCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFeedback(null);

    const cleanUsername = adminUsernameInput.trim().toLowerCase().replace(/^@+/, '');
    if (!/^[a-z0-9_.-]{3,32}$/.test(cleanUsername)) {
      setAdminFeedback({
        type: 'err',
        text: 'Admin ID/Username must be 3–32 characters (letters, numbers, _, ., -).',
      });
      return;
    }

    if (adminPasswordInput !== '' && (adminPasswordInput.length < 4 || adminPasswordInput.length > 60)) {
      setAdminFeedback({
        type: 'err',
        text: 'Administrator password must be strictly between 4 and 60 characters.',
      });
      return;
    }

    setAdminSaving(true);
    const res = await onUpdateAdminCredentials({
      username: cleanUsername,
      name: adminNameInput.trim() || 'Administrator',
      password: adminPasswordInput || undefined,
    });
    setAdminSaving(false);

    if (res.ok) {
      setAdminPasswordInput('');
      setAdminFeedback({
        type: 'ok',
        text: 'Administrator ID and security credentials updated.',
      });
    } else {
      setAdminFeedback({
        type: 'err',
        text: res.error || 'Failed to update Administrator credentials.',
      });
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const cleanFullName = newFullName.trim();
    const cleanUsername = newUsername.trim().toLowerCase().replace(/^@+/, '');

    if (cleanFullName.length < 2) {
      setCreateError('Full name must be at least 2 characters.');
      return;
    }
    if (!/^[a-z0-9_.-]{3,32}$/.test(cleanUsername)) {
      setCreateError('Username must be 3–32 characters (letters, numbers, _, ., -).');
      return;
    }
    if (newPassword.length < 4 || newPassword.length > 60) {
      setCreateError('Password must be strictly between 4 and 60 characters.');
      return;
    }

    setCreating(true);
    const res = await onCreateUser({
      name: cleanFullName,
      username: cleanUsername,
      password: newPassword,
      email: newEmail.trim() || `${cleanUsername}@telepulse.enterprise`,
      role: newRole,
      department: newDepartment.trim() || 'Customer Support & Inbox',
    });
    setCreating(false);

    if (!res.ok) {
      setCreateError(res.error || 'Failed to create team account.');
      return;
    }

    setIsCreateModalOpen(false);
    setCreateError(null);
    setNewFullName('');
    setNewUsername('');
    setNewPassword('');
    setNewEmail('');
    showToast(`Created approved team account @${cleanUsername} (${newRole}).`);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    setResetPasswordError(null);

    if (resetPasswordValue.length < 4 || resetPasswordValue.length > 60) {
      setResetPasswordError('Password must be strictly between 4 and 60 characters.');
      return;
    }

    setBusyId(resetPasswordUser.id);
    const res = await onUpdateUser(resetPasswordUser.id, { password: resetPasswordValue });
    setBusyId(null);

    if (!res.ok) {
      setResetPasswordError(res.error || 'Failed to reset user password.');
      return;
    }
    const targetName = resetPasswordUser.username;
    setResetPasswordUser(null);
    setResetPasswordValue('');
    showToast(`Password updated for @${targetName}. Active sessions for that user were invalidated.`);
  };

  const pendingRequests = signupRequests.filter((r) => r.status === 'pending');
  const displayedRequests = requestFilter === 'pending' ? pendingRequests : signupRequests;

  const unassignedCount = contacts.filter((c) => !c.assignedModeratorId).length;
  const activeTargetModId =
    moderators.find((m) => m.id === selectedTargetModId)?.id ||
    moderators.find((m) => m.id === moderatorRouting.defaultModeratorId)?.id ||
    moderators[0]?.id ||
    '';

  const capabilities = [
    {
      name: 'Create Administrators & Full System Control',
      admin: true,
      moderator: false,
      editor: false,
      viewer: false,
      ruleText: 'Only Administrators can create/manage Admin accounts, reset Root Admin credentials, or view Executive Dashboard',
    },
    {
      name: 'Authorization Management & User Provisioning (Non-Admin)',
      admin: true,
      moderator: false,
      editor: true,
      viewer: false,
      ruleText: 'Admin & Editor can approve signups and provision/manage Editor, Moderator & Viewer accounts',
    },
    {
      name: 'Live Customer Chats & Instant Replies',
      admin: true,
      moderator: true,
      editor: true,
      viewer: true,
      ruleText: 'Viewers stay locked in full-screen Live Chat; Moderators/Editors/Admins manage conversations & instant replies',
    },
    {
      name: 'Bulk Campaigns, Phone Filtering & Telegram Verification',
      admin: true,
      moderator: true,
      editor: true,
      viewer: false,
      ruleText: 'Moderators, Editors & Admins can run bulk campaigns, phone filtering, and Telegram checks',
    },
    {
      name: 'Multi-API Dispatch, Contact Lists & CRM Directories',
      admin: true,
      moderator: false,
      editor: true,
      viewer: false,
      ruleText: 'Editors & Admins manage Multi-API Hub, contact lists, imports, and CRM directories',
    },
    {
      name: 'WordPress, Cloud Storage & Audit Logs',
      admin: true,
      moderator: false,
      editor: true,
      viewer: false,
      ruleText: 'Available to Editors and Administrators',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              User Role Management, Approvals &amp; Access Security
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              {isAdmin ? 'Admin Full Control' : 'Editor Team Access'}
            </span>
            {pendingRequests.length > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                {pendingRequests.length} Pending Approval
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Review signup applications, enforce 4–60 character credentials, manage team permissions, and configure moderator routing.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRefreshUsers && (
            <button
              type="button"
              onClick={() => void onRefreshUsers()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Approved User</span>
          </button>
        </div>
      </div>

      {routingFeedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{routingFeedback}</span>
        </div>
      )}

      {actionError && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Administrator Google AI Studio Link & ID/Password Panel (Admin Only) */}
      {isAdmin && (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                Administrator Identity &amp; Google AI Studio Link
              </h2>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Authorized Google AI Studio account:{' '}
              <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                {authorizedAdminEmail || currentUser.email}
              </span>
            </p>
          </div>

          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${
              adminPasswordConfigured
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
            }`}
          >
            {adminPasswordConfigured ? 'ID + Password Configured' : 'Set Admin Password (4–60 chars)'}
          </span>
        </div>

        <form onSubmit={handleAdminCredentialsSubmit} className="p-4 space-y-3">
          {adminFeedback && (
            <div
              className={`px-3 py-2 rounded-lg text-xs border ${
                adminFeedback.type === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}
            >
              {adminFeedback.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                Admin ID / Username
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={32}
                value={adminUsernameInput}
                onChange={(e) => setAdminUsernameInput(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={adminNameInput}
                onChange={(e) => setAdminNameInput(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                New Admin Password (4–60 chars)
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  minLength={4}
                  maxLength={60}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep existing"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full text-xs font-mono px-3 pr-9 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-2.5 top-2 text-neutral-400 hover:text-neutral-200"
                >
                  {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Admin can sign in via linked Google AI Studio account or Admin ID + password (4–60 chars).
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {!confirmResetAdmin ? (
                <button
                  type="button"
                  onClick={() => setConfirmResetAdmin(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  Reset Admin Username &amp; Password
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={adminResetting}
                    onClick={async () => {
                      setAdminFeedback(null);
                      setAdminResetting(true);
                      const res = await onResetAdminCredentials();
                      setAdminResetting(false);
                      if (!res.ok) {
                        setConfirmResetAdmin(false);
                        setAdminFeedback({
                          type: 'err',
                          text: res.error || 'Failed to reset Administrator credentials.',
                        });
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
                  >
                    {adminResetting ? 'Resetting...' : 'Confirm Full Reset'}
                  </button>
                  <button
                    type="button"
                    disabled={adminResetting}
                    onClick={() => setConfirmResetAdmin(false)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={adminSaving}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 transition-colors"
              >
                {adminSaving ? 'Saving...' : 'Update Admin Credentials'}
              </button>
            </div>
          </div>
        </form>
      </div>
      )}

      {/* Pending Signup Approval Queue */}
      <div className="rounded-xl border border-sky-200 dark:border-sky-900/50 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-sky-50/40 dark:bg-sky-950/20">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                Signup Approval Queue ({pendingRequests.length} Pending)
              </h2>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Applicants remain completely blocked from accessing the website until approved here.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRequestFilter('pending')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                requestFilter === 'pending'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              Pending ({pendingRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setRequestFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                requestFilter === 'all'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              All History ({signupRequests.length})
            </button>
          </div>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {displayedRequests.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No {requestFilter === 'pending' ? 'pending signup applications' : 'signup applications'} right now.
            </div>
          ) : (
            displayedRequests.map((reqItem) => {
              const selectedRole = approvalRoles[reqItem.id] || reqItem.requestedRole;
              return (
                <div
                  key={reqItem.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {reqItem.name}
                      </span>
                      <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-1.5 py-0.2 rounded">
                        @{reqItem.username}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          reqItem.status === 'pending'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : reqItem.status === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {reqItem.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {reqItem.email} · {reqItem.department} · Submitted{' '}
                      {new Date(reqItem.createdAt).toLocaleString()}
                    </div>
                    {reqItem.reason && (
                      <div className="text-[11px] text-neutral-600 dark:text-neutral-300 italic">
                        “{reqItem.reason}”
                      </div>
                    )}
                  </div>

                  {reqItem.status === 'pending' ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        value={selectedRole}
                        onChange={(e) =>
                          setApprovalRoles((prev) => ({
                            ...prev,
                            [reqItem.id]: e.target.value as 'admin' | 'moderator' | 'editor' | 'viewer',
                          }))
                        }
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-medium"
                      >
                        <option value="viewer">Approve as Viewer</option>
                        <option value="moderator">Approve as Moderator</option>
                        <option value="editor">Approve as Editor</option>
                        {isAdmin && <option value="admin">Approve as Administrator</option>}
                      </select>

                      <button
                        type="button"
                        disabled={busyId === reqItem.id}
                        onClick={async () => {
                          setBusyId(reqItem.id);
                          const res = await onApproveSignup(reqItem.id, selectedRole);
                          setBusyId(null);
                          if (res.ok) {
                            showToast(`Approved @${reqItem.username} as ${selectedRole}.`);
                          } else {
                            setActionError(res.error || 'Failed to approve application.');
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyId === reqItem.id}
                        onClick={async () => {
                          setBusyId(reqItem.id);
                          const res = await onRejectSignup(reqItem.id);
                          setBusyId(null);
                          if (res.ok) {
                            showToast(`Declined signup request for @${reqItem.username}.`);
                          } else {
                            setActionError(res.error || 'Failed to decline application.');
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-neutral-400 font-mono">
                      {reqItem.reviewNote || reqItem.status}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Registered Team Accounts (No Plaintext Passwords Exposed) */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Approved &amp; Managed Accounts ({allUsers.length})
          </h2>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Scrypt Hashed · 4–60 Char Policy</span>
          </span>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {allUsers.map((user) => {
            const isRootAdmin = user.id === 'usr_admin';
            const isSelf = user.id === currentUser.id;
            const isRestrictedForEditor = !isAdmin && user.role === 'admin';
            const lockAccountControls = isRootAdmin || isSelf || isRestrictedForEditor;
            const isSuspended = user.status === 'suspended';
            return (
              <div
                key={user.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-neutral-300 dark:ring-neutral-700"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {user.name}
                      </span>
                      <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-1.5 py-0.2 rounded font-semibold">
                        @{user.username}
                      </span>
                      {user.googleLinked && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold">
                          Google AI Studio Linked
                        </span>
                      )}
                      {isSuspended ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold">
                          Suspended
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                          Approved
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {user.email} · {user.department} · ID: <span className="font-mono">{user.id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {lockAccountControls ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                      {user.role}{isRootAdmin ? ' (root)' : isSelf ? ' (you)' : ''}
                    </span>
                  ) : (
                    <>
                      <select
                        value={user.role}
                        disabled={busyId === user.id}
                        onChange={async (e) => {
                          const nextRole = e.target.value as 'admin' | 'moderator' | 'editor' | 'viewer';
                          setBusyId(user.id);
                          const res = await onUpdateUser(user.id, { role: nextRole });
                          setBusyId(null);
                          if (res.ok) showToast(`Updated @${user.username} role to ${nextRole}.`);
                          else setActionError(res.error || 'Failed to update role.');
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-semibold"
                      >
                        {isAdmin && <option value="admin">Administrator</option>}
                        <option value="editor">Editor</option>
                        <option value="moderator">Moderator</option>
                        <option value="viewer">Viewer</option>
                      </select>

                      <button
                        type="button"
                        disabled={busyId === user.id}
                        onClick={() => {
                          setResetPasswordUser(user);
                          setResetPasswordValue('');
                          setResetPasswordError(null);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      >
                        Reset Password
                      </button>

                      <button
                        type="button"
                        disabled={busyId === user.id}
                        onClick={async () => {
                          const nextStatus: UserAccountStatus = isSuspended ? 'approved' : 'suspended';
                          setBusyId(user.id);
                          const res = await onUpdateUser(user.id, { status: nextStatus });
                          setBusyId(null);
                          if (res.ok) {
                            showToast(
                              nextStatus === 'suspended'
                                ? `Suspended @${user.username} and revoked active sessions.`
                                : `Reactivated @${user.username}.`
                            );
                          } else {
                            setActionError(res.error || 'Failed to update status.');
                          }
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          isSuspended
                            ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            : 'border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>{isSuspended ? 'Reactivate' : 'Suspend'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyId === user.id}
                        onClick={async () => {
                          setBusyId(user.id);
                          const res = await onDeleteUser(user.id);
                          setBusyId(null);
                          if (res.ok) showToast(`Deleted account @${user.username}.`);
                          else setActionError(res.error || 'Failed to delete user.');
                        }}
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Moderator Communication Routing & Instant Reply Engine */}
      <div className="rounded-xl border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/50 dark:bg-purple-950/20">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                Moderator Communication Routing &amp; Instant Reply System
              </h2>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Route conversations to approved moderators so they can respond from their Shared Inbox.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onUpdateModeratorRouting({ enabled: !moderatorRouting.enabled })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 ${
              moderatorRouting.enabled
                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
            }`}
          >
            {moderatorRouting.enabled ? 'System Enabled' : 'Enable Routing System'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Routing Strategy
              </label>
              <select
                value={moderatorRouting.mode}
                onChange={(e) => onUpdateModeratorRouting({ mode: e.target.value as ModeratorRoutingMode })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-medium"
              >
                <option value="specific_moderator">Route All to Specific Moderator</option>
                <option value="round_robin">Even Round-Robin Across Moderators</option>
                <option value="manual">Manual Assignment Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Target Moderator
              </label>
              <select
                value={activeTargetModId}
                onChange={(e) => {
                  setSelectedTargetModId(e.target.value);
                  onUpdateModeratorRouting({ defaultModeratorId: e.target.value });
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-medium"
              >
                {moderators.length === 0 ? (
                  <option value="">No approved moderators yet</option>
                ) : (
                  moderators.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (@{m.username})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col justify-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moderatorRouting.autoRouteNewContacts}
                  onChange={(e) => onUpdateModeratorRouting({ autoRouteNewContacts: e.target.checked })}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-purple-600"
                />
                <span>Auto-route new CRM leads &amp; imports</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moderatorRouting.autoRouteInboundMessages}
                  onChange={(e) => onUpdateModeratorRouting({ autoRouteInboundMessages: e.target.checked })}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-purple-600"
                />
                <span>Auto-route incoming Telegram messages</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              disabled={!activeTargetModId || contacts.length === 0}
              onClick={() => {
                const modName = moderators.find((m) => m.id === activeTargetModId)?.name || 'Moderator';
                onRouteContactsToModerator(activeTargetModId, 'all');
                showToast(`All ${contacts.length} communication threads routed to ${modName}.`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Route All Communications ({contacts.length})</span>
            </button>

            <button
              type="button"
              disabled={!activeTargetModId || unassignedCount === 0}
              onClick={() => {
                const modName = moderators.find((m) => m.id === activeTargetModId)?.name || 'Moderator';
                onRouteContactsToModerator(activeTargetModId, 'unassigned');
                showToast(`Routed ${unassignedCount} unassigned thread(s) to ${modName}.`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Route Unassigned Only ({unassignedCount})</span>
            </button>

            <button
              type="button"
              disabled={moderators.length === 0 || contacts.length === 0}
              onClick={() => {
                onDistributeRoundRobin('all');
                showToast(`Distributed all ${contacts.length} threads evenly across ${moderators.length} active moderators.`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5 text-sky-500" />
              <span>Distribute Round-Robin</span>
            </button>
          </div>

          {moderators.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {moderators.map((mod) => {
                const assignedThreads = contacts.filter((c) => c.assignedModeratorId === mod.id);
                const isDefault = moderatorRouting.defaultModeratorId === mod.id;
                return (
                  <div
                    key={mod.id}
                    className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={mod.avatar}
                        alt={mod.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-purple-300 dark:ring-purple-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {mod.name}
                          </span>
                          {isDefault && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 shrink-0">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                          @{mod.username} ·{' '}
                          <strong className="text-neutral-800 dark:text-neutral-200">
                            {assignedThreads.length}
                          </strong>{' '}
                          active threads
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenModeratorInbox(mod.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-purple-600 dark:text-purple-400 hover:border-purple-400 transition-colors shrink-0"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Open Chat</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Role Capabilities Matrix */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Role Capabilities Matrix
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-400">
              <tr>
                <th className="py-2.5 px-4">Rule / Permission</th>
                <th className="py-2.5 px-4 text-center font-bold text-amber-600 dark:text-amber-400">Admin</th>
                <th className="py-2.5 px-4 text-center font-bold text-purple-600 dark:text-purple-400">Moderator</th>
                <th className="py-2.5 px-4 text-center font-bold text-sky-600 dark:text-sky-400">Editor</th>
                <th className="py-2.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-normal">
              {capabilities.map((cap, i) => (
                <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                  <td className="py-3 px-4 text-neutral-800 dark:text-neutral-200">
                    <div className="font-semibold">{cap.name}</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{cap.ruleText}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cap.admin ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-neutral-300 dark:text-neutral-700 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cap.moderator ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-neutral-300 dark:text-neutral-700 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cap.editor ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-neutral-300 dark:text-neutral-700 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cap.viewer ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-neutral-300 dark:text-neutral-700 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW USER MODAL (ADMIN ONLY) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Create Approved Team User
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Directly provision an approved account with a username, 4–60 character password, and role.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Full name"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={32}
                    placeholder="3-32 chars"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Password (4–60 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      maxLength={60}
                      autoComplete="new-password"
                      placeholder="4–60 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-200"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Role Assignment
                </label>
                <select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as 'admin' | 'moderator' | 'editor' | 'viewer')
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-semibold"
                >
                  {isAdmin && (
                    <option value="admin">
                      Administrator — Full control &amp; can create new admins
                    </option>
                  )}
                  <option value="editor">
                    Editor — Team provisioning, live chat, campaigns, multi-API, WordPress, cloud &amp; audit logs
                  </option>
                  <option value="moderator">
                    Moderator — Live chats, instant replies, bulk campaigns &amp; phone verification
                  </option>
                  <option value="viewer">
                    Viewer — Full-screen customer live chat only
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="user@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              {createError && (
                <div className="p-2.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCreateError(null);
                  }}
                  className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-sm disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Save Approved User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET USER PASSWORD MODAL (ADMIN ONLY) */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Reset Password (@{resetPasswordUser.username})
                </h3>
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  New Password (4–60 characters)
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    maxLength={60}
                    autoComplete="new-password"
                    placeholder="4–60 characters"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 pr-9 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-2 text-neutral-400 hover:text-neutral-200"
                  >
                    {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {resetPasswordError && (
                <div className="p-2.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300">
                  {resetPasswordError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === resetPasswordUser.id}
                  className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-50"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
