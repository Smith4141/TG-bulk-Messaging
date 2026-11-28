/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GripVertical, Maximize2, Minimize2, RotateCcw, BellRing, X } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar, TabId } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { CampaignManager } from './components/CampaignManager';
import { PhoneFilterView } from './components/PhoneFilterView';
import { ContactManager } from './components/ContactManager';
import { LiveChatView } from './components/LiveChatView';
import { WordPressIntegration } from './components/WordPressIntegration';
import { ApiMessagingHubView, ApiHubSubTab } from './components/ApiMessagingHubView';
import { CloudStorageView } from './components/CloudStorageView';
import { LoginView, BootstrapAdminPayload, SignupApplicationPayload, ResetAdminWithGooglePayload } from './components/LoginView';
import {
  RoleManagementView,
  CreateTeamUserPayload,
  UpdateTeamUserPayload,
  UpdateAdminCredentialsPayload,
} from './components/RoleManagementView';
import { AuditLogsView } from './components/AuditLogsView';
import { LandingPage } from './components/LandingPage';
import { NotificationBell } from './components/NotificationBell';
import { storageService } from './services/storageService';
import { applySiteLanguage, stopSiteTranslator } from './services/siteTranslator';
import { SupportedLanguage } from './translations';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase';
import * as firestoreSync from './services/firestoreSyncService';
import {
  Contact,
  Campaign,
  ChatMessage,
  AutoResponseRule,
  WebhookEndpoint,
  WebhookLog,
  WordPressConfig,
  GoogleContactsSync,
  TelegramBotConfig,
  MTProtoConfig,
  AuditLog,
  CloudFile,
  UserAccount,
  SignupRequest,
  UserbotSession,
  AudienceList,
  CampaignBackupSnapshot,
  CampaignRecipientCheckpoint,
  ModeratorRoutingConfig,
  AppNotification,
} from './types';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => storageService.getTheme());
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [siteLang, setSiteLang] = useState<string>(() => storageService.getLanguage());
  const [isTranslatingSite, setIsTranslatingSite] = useState(false);
  const [viewMode, setViewMode] = useState<'portal' | 'website'>('portal');
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [apiHubSubTab, setApiHubSubTab] = useState<ApiHubSubTab>('phone_send');
  const [selectedChatContactId, setSelectedChatContactId] = useState<string>('c_01');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('telepulse_sidebar_width'));
      return saved >= 190 && saved <= 420 ? saved : 256;
    } catch {
      return 256;
    }
  });
  const [moduleWidthPct, setModuleWidthPct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('telepulse_module_width_pct'));
      return saved >= 55 && saved <= 100 ? saved : 100;
    } catch {
      return 100;
    }
  });
  const [moduleScale, setModuleScale] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('telepulse_module_scale'));
      return saved >= 80 && saved <= 120 ? saved : 100;
    } catch {
      return 100;
    }
  });
  const [activeDragHandle, setActiveDragHandle] = useState<'sidebar' | 'module' | null>(null);
  const mainContentRef = useRef<HTMLElement>(null);

  // Users, Server Session & Strict RBAC (token kept in memory only, never localStorage)
  const [allUsers, setAllUsers] = useState<UserAccount[]>(() => storageService.getUsers());
  const [signupRequests, setSignupRequests] = useState<SignupRequest[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState<UserAccount | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const authTokenRef = useRef<string | null>(null);
  authTokenRef.current = authToken;
  const [adminPasswordConfigured, setAdminPasswordConfigured] = useState<boolean>(true);
  const [authorizedAdminEmail, setAuthorizedAdminEmail] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const currentUser = authenticatedUser || allUsers[0];

  // Universal Notification Center State
  const [liveNotifications, setLiveNotifications] = useState<AppNotification[]>([]);
  const [notifReadIds, setNotifReadIds] = useState<string[]>([]);
  const [notifDismissedIds, setNotifDismissedIds] = useState<string[]>([]);
  const [notifSoundEnabled, setNotifSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('telepulse_notif_sound') !== 'false';
    } catch {
      return true;
    }
  });
  const [notifDesktopEnabled, setNotifDesktopEnabled] = useState<boolean>(() => {
    try {
      return (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        localStorage.getItem('telepulse_notif_desktop') === 'true'
      );
    } catch {
      return false;
    }
  });
  const [toastNotification, setToastNotification] = useState<AppNotification | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const notifSoundRef = useRef(notifSoundEnabled);
  notifSoundRef.current = notifSoundEnabled;
  const notifDesktopRef = useRef(notifDesktopEnabled);
  notifDesktopRef.current = notifDesktopEnabled;
  const seenPendingReqIdsRef = useRef<Set<string>>(new Set());

  // Core Data
  const [contacts, setContacts] = useState<Contact[]>(() => storageService.getContacts());
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => storageService.getCampaigns());
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => storageService.getChats());
  const [autoResponses, setAutoResponses] = useState<AutoResponseRule[]>(() => storageService.getAutoResponses());
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(() => storageService.getWebhooks());
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>(() => storageService.getWebhookLogs());
  const [wpConfig, setWpConfig] = useState<WordPressConfig>(() => storageService.getWordPressConfig());
  const [googleSync, setGoogleSync] = useState<GoogleContactsSync>(() => storageService.getGoogleSync());
  const [botConfig, setBotConfig] = useState<TelegramBotConfig>(() => storageService.getBotConfig());
  const [mtprotoConfig, setMtprotoConfig] = useState<MTProtoConfig>(() => storageService.getMTProtoConfig());
  const [userbotSessions, setUserbotSessions] = useState<UserbotSession[]>(() => storageService.getUserbotSessions());
  const [audienceLists, setAudienceLists] = useState<AudienceList[]>(() => storageService.getAudienceLists());
  const [campaignBackups, setCampaignBackups] = useState<CampaignBackupSnapshot[]>(() =>
    storageService.getCampaignBackups()
  );
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>(() => storageService.getCloudFiles());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => storageService.getAuditLogs());
  const [moderatorRouting, setModeratorRouting] = useState<ModeratorRoutingConfig>(() =>
    storageService.getModeratorRouting()
  );

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firebaseAuthLoading, setFirebaseAuthLoading] = useState<boolean>(false);
  const [firebaseAuthError, setFirebaseAuthError] = useState<string | null>(null);
  const firebaseUidRef = useRef<string | null>(null);
  firebaseUidRef.current = firebaseUser?.uid || null;

  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const allUsersRef = useRef(allUsers);
  allUsersRef.current = allUsers;
  const moderatorRoutingRef = useRef(moderatorRouting);
  moderatorRoutingRef.current = moderatorRouting;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const selectedChatContactIdRef = useRef(selectedChatContactId);
  selectedChatContactIdRef.current = selectedChatContactId;
  const initialStateRef = useRef({
    contacts,
    campaigns,
    chats,
    autoResponses,
    webhooks,
    userbotSessions,
    audienceLists,
    cloudFiles,
    wpConfig,
    googleSync,
    botConfig,
    mtprotoConfig,
    moderatorRouting,
  });

  // Firebase Auth & Real-Time Firestore Subscription (only active once auth is ready & signed in)
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      setFirebaseUser(user);
      setAuthReady(true);

      if (!user || cancelled) return;

      try {
        await firestoreSync.ensureFirebaseUserProfile(user);
        await firestoreSync.seedWorkspaceIfEmpty(user.uid, initialStateRef.current);
        if (cancelled) return;

        unsubFirestore = firestoreSync.subscribeWorkspaceCollections(user.uid, {
          onContacts: setContacts,
          onCampaigns: setCampaigns,
          onChats: setChats,
          onAutoResponses: setAutoResponses,
          onWebhooks: setWebhooks,
          onWebhookLogs: setWebhookLogs,
          onUserbotSessions: setUserbotSessions,
          onAudienceLists: setAudienceLists,
          onCampaignBackups: setCampaignBackups,
          onCloudFiles: setCloudFiles,
          onAuditLogs: setAuditLogs,
          onSetting: (key, payload) => {
            if (key === 'wordpress') setWpConfig((prev) => ({ ...prev, ...payload }));
            else if (key === 'googleSync') setGoogleSync((prev) => ({ ...prev, ...payload }));
            else if (key === 'botConfig') setBotConfig((prev) => ({ ...prev, ...payload }));
            else if (key === 'mtprotoConfig') setMtprotoConfig((prev) => ({ ...prev, ...payload }));
            else if (key === 'moderatorRouting') setModeratorRouting((prev) => ({ ...prev, ...payload }));
          },
        });
      } catch (err: any) {
        console.error('Firestore initialization error:', err);
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        if (active && data?.success) {
          setAdminPasswordConfigured(Boolean(data.adminPasswordConfigured));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const playNotificationChime = useCallback(() => {
    if (!notifSoundRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      };
      playTone(660, now, 0.14);
      playTone(880, now + 0.11, 0.18);
      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 450);
    } catch {}
  }, []);

  const pushLiveNotification = useCallback(
    (notif: Omit<AppNotification, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => {
      const item: AppNotification = {
        id: notif.id || `live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: notif.timestamp || new Date().toISOString(),
        category: notif.category,
        severity: notif.severity,
        title: notif.title,
        message: notif.message,
        targetTab: notif.targetTab,
        targetContactId: notif.targetContactId,
      };
      setLiveNotifications((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 40));
      setToastNotification(item);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setToastNotification(null);
      }, 5000);

      playNotificationChime();

      if (notifDesktopRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(item.title, { body: item.message });
        } catch {}
      }
    },
    [playNotificationChime]
  );

  // Load read/dismissed notification state per logged-in user
  useEffect(() => {
    if (!authenticatedUser?.id) return;
    try {
      const savedRead = JSON.parse(localStorage.getItem(`telepulse_notif_read_${authenticatedUser.id}`) || '[]');
      const savedDismissed = JSON.parse(
        localStorage.getItem(`telepulse_notif_dismissed_${authenticatedUser.id}`) || '[]'
      );
      setNotifReadIds(Array.isArray(savedRead) ? savedRead : []);
      setNotifDismissedIds(Array.isArray(savedDismissed) ? savedDismissed : []);
    } catch {
      setNotifReadIds([]);
      setNotifDismissedIds([]);
    }
  }, [authenticatedUser?.id]);

  useEffect(() => {
    if (!authenticatedUser?.id) return;
    try {
      localStorage.setItem(
        `telepulse_notif_read_${authenticatedUser.id}`,
        JSON.stringify(notifReadIds.slice(-300))
      );
    } catch {}
  }, [authenticatedUser?.id, notifReadIds]);

  useEffect(() => {
    if (!authenticatedUser?.id) return;
    try {
      localStorage.setItem(
        `telepulse_notif_dismissed_${authenticatedUser.id}`,
        JSON.stringify(notifDismissedIds.slice(-300))
      );
    } catch {}
  }, [authenticatedUser?.id, notifDismissedIds]);

  const fetchAdminUsers = async (tokenOverride?: string | null, announceNewSignups = false) => {
    const token = tokenOverride ?? authTokenRef.current;
    if (!token) return;
    try {
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && Array.isArray(data.users)) {
        setAllUsers(data.users);
        const nextReqs: SignupRequest[] = Array.isArray(data.signupRequests) ? data.signupRequests : [];
        setSignupRequests(nextReqs);
        if (data.authorizedAdminEmail) setAuthorizedAdminEmail(String(data.authorizedAdminEmail));
        if (typeof data.adminPasswordConfigured === 'boolean') {
          setAdminPasswordConfigured(data.adminPasswordConfigured);
        }

        const pendingReqs = nextReqs.filter((r) => r.status === 'pending');
        if (announceNewSignups) {
          for (const reqItem of pendingReqs) {
            if (!seenPendingReqIdsRef.current.has(reqItem.id)) {
              pushLiveNotification({
                id: `live_signup_${reqItem.id}`,
                category: 'approval',
                severity: 'warning',
                title: 'New Account Approval Request',
                message: `${reqItem.name} (@${reqItem.username}) applied for ${reqItem.requestedRole} access.`,
                targetTab: 'team_rbac',
                timestamp: reqItem.createdAt,
              });
            }
          }
        }
        seenPendingReqIdsRef.current = new Set(pendingReqs.map((r) => r.id));
      }
    } catch {}
  };

  useEffect(() => {
    if (
      !isLoggedIn ||
      (authenticatedUser?.role !== 'admin' && authenticatedUser?.role !== 'editor') ||
      !authToken
    ) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void fetchAdminUsers(authTokenRef.current, true);
    }, 25000);
    return () => window.clearInterval(intervalId);
  }, [isLoggedIn, authenticatedUser?.role, authToken]);

  const applyAuthenticatedSession = (user: UserAccount, token: string) => {
    authTokenRef.current = token;
    setAuthToken(token);
    setAuthenticatedUser(user);
    setIsLoggedIn(true);
    setFirebaseAuthError(null);
    if (user.role === 'viewer') {
      setActiveTab('live_chat');
      setIsFullScreen(true);
      setViewMode('portal');
    } else if (user.role === 'moderator') {
      setActiveTab('live_chat');
      setIsFullScreen(false);
    } else if (user.role === 'editor') {
      setActiveTab('campaigns');
      setIsFullScreen(false);
    } else {
      setActiveTab('dashboard');
      setIsFullScreen(false);
    }

    storageService.logAction('USER_LOGGED_IN', 'Auth System', `User @${user.username} logged in as ${user.role}.`, user);
    setAuditLogs(storageService.getAuditLogs());
    if (user.role === 'admin' || user.role === 'editor') {
      void fetchAdminUsers(token);
    }
  };

  const handleCredentialLogin = async (
    username: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.token || !data?.user) {
        return { ok: false, error: data?.error || 'Invalid ID/username or password.' };
      }
      if (typeof data.adminPasswordConfigured === 'boolean') {
        setAdminPasswordConfigured(data.adminPasswordConfigured);
      }
      applyAuthenticatedSession(data.user, data.token);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach authentication server.' };
    }
  };

  const handleSignupRequest = async (
    payload: SignupApplicationPayload
  ): Promise<{ ok: boolean; message?: string; error?: string }> => {
    try {
      const res = await fetch('/api/auth/signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to submit signup application.' };
      }
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, error: 'Unable to submit signup application.' };
    }
  };

  const handleBootstrapAdmin = async (
    payload: BootstrapAdminPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    setFirebaseAuthError(null);
    setFirebaseAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (!cred.user) {
        return { ok: false, error: 'Google sign-in did not return an account.' };
      }
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          username: payload.username,
          password: payload.password,
          name: payload.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.token || !data?.user) {
        await signOut(auth).catch(() => {});
        const msg = data?.error || 'Failed to configure Administrator credentials.';
        setFirebaseAuthError(msg);
        return { ok: false, error: msg };
      }
      setAdminPasswordConfigured(true);
      applyAuthenticatedSession(data.user, data.token);
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Google verification or Admin setup failed.';
      setFirebaseAuthError(msg);
      return { ok: false, error: msg };
    } finally {
      setFirebaseAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async (): Promise<{ ok: boolean; error?: string }> => {
    setFirebaseAuthError(null);
    setFirebaseAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (!cred.user) {
        return { ok: false, error: 'Google sign-in did not return an account.' };
      }
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/google-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.token || !data?.user) {
        await signOut(auth).catch(() => {});
        const msg =
          data?.error ||
          'Google Sign-In is restricted exclusively to the authorized Administrator Google AI Studio account.';
        setFirebaseAuthError(msg);
        return { ok: false, error: msg };
      }
      if (typeof data.adminPasswordConfigured === 'boolean') {
        setAdminPasswordConfigured(data.adminPasswordConfigured);
      }
      applyAuthenticatedSession(data.user, data.token);
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Google sign-in failed.';
      setFirebaseAuthError(msg);
      return { ok: false, error: msg };
    } finally {
      setFirebaseAuthLoading(false);
    }
  };

  const handleGoogleAdminReset = async (
    payload: ResetAdminWithGooglePayload
  ): Promise<{ ok: boolean; error?: string }> => {
    setFirebaseAuthError(null);
    setFirebaseAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (!cred.user) {
        return { ok: false, error: 'Google sign-in did not return an account.' };
      }
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/admin/reset-with-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          username: payload.username,
          password: payload.password,
          name: payload.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.token || !data?.user) {
        await signOut(auth).catch(() => {});
        const msg =
          data?.error ||
          'Only the authorized Administrator Google AI Studio account can reset Admin credentials.';
        setFirebaseAuthError(msg);
        return { ok: false, error: msg };
      }
      setAdminPasswordConfigured(true);
      applyAuthenticatedSession(data.user, data.token);
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Google verification failed.';
      setFirebaseAuthError(msg);
      return { ok: false, error: msg };
    } finally {
      setFirebaseAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Google sign-out failed:', err);
    }
  };

  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    storageService.setTheme(theme);
  }, [theme]);

  // Apply global website translation for any of the 249+ supported languages
  useEffect(() => {
    storageService.setLanguage(siteLang);
    applySiteLanguage(siteLang, ({ translating }) => {
      setIsTranslatingSite(translating);
    });
  }, [siteLang]);

  useEffect(() => {
    return () => {
      stopSiteTranslator();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('telepulse_sidebar_width', String(sidebarWidth));
    } catch {}
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem('telepulse_module_width_pct', String(moduleWidthPct));
    } catch {}
  }, [moduleWidthPct]);

  useEffect(() => {
    try {
      localStorage.setItem('telepulse_module_scale', String(moduleScale));
    } catch {}
  }, [moduleScale]);

  useEffect(() => {
    if (!isFullScreen || currentUser.role === 'viewer') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullScreen, currentUser.role]);

  const startSidebarResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const initialWidth = sidebarWidth;
    setActiveDragHandle('sidebar');

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const nextWidth = Math.max(190, Math.min(420, Math.round(initialWidth + dx)));
      setSidebarWidth(nextWidth);
    };

    const onUp = () => {
      setActiveDragHandle(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startModuleResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const initialPct = moduleWidthPct;
    const containerWidth = mainContentRef.current?.clientWidth || 1200;
    setActiveDragHandle('module');

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      // Multiply by 2 when centered so right edge tracks pointer smoothly
      const deltaPct = ((dx * 2) / Math.max(400, containerWidth)) * 100;
      const nextPct = Math.max(55, Math.min(100, Math.round(initialPct + deltaPct)));
      setModuleWidthPct(nextPct);
    };

    const onUp = () => {
      setActiveDragHandle(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const resetWorkspaceDimensions = () => {
    setSidebarWidth(256);
    setModuleWidthPct(100);
    setModuleScale(100);
  };

  // Strict RBAC Tab & Viewer Full-Screen Enforcement
  useEffect(() => {
    if (currentUser.role === 'moderator') {
      if (!['live_chat', 'campaigns', 'phone_filter'].includes(activeTab)) {
        setActiveTab('live_chat');
      }
    } else if (currentUser.role === 'editor') {
      if (
        ![
          'live_chat',
          'campaigns',
          'api_hub',
          'phone_filter',
          'contacts',
          'wordpress',
          'cloud_storage',
          'team_rbac',
          'audit_logs',
        ].includes(activeTab)
      ) {
        setActiveTab('campaigns');
      }
    } else if (currentUser.role === 'viewer') {
      if (activeTab !== 'live_chat') {
        setActiveTab('live_chat');
      }
      if (!isFullScreen) {
        setIsFullScreen(true);
      }
      if (viewMode !== 'portal') {
        setViewMode('portal');
      }
    }
  }, [currentUser.role, activeTab, isFullScreen, viewMode]);

  // Hydrate Multi-Session Userbots & Backups from server + Subscribe to SSE Live Events
  useEffect(() => {
    let mounted = true;
    fetch('/api/userbots')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        if (Array.isArray(data.userbots) && data.userbots.length > 0) {
          setUserbotSessions(data.userbots);
        }
        if (Array.isArray(data.backups) && data.backups.length > 0) {
          setCampaignBackups(data.backups);
        }
      })
      .catch(() => {});

    const evtSource = new EventSource('/api/events');

    evtSource.addEventListener('userbot:updated', (e) => {
      try {
        const updatedSession: UserbotSession = JSON.parse((e as MessageEvent).data);
        setUserbotSessions((prev) => {
          const exists = prev.some((s) => s.id === updatedSession.id);
          return exists
            ? prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
            : [updatedSession, ...prev];
        });
        if (
          updatedSession.healthStatus === 'flagged_spambot' ||
          updatedSession.healthStatus === 'flood_wait' ||
          updatedSession.healthStatus === 'user_deactivated'
        ) {
          pushLiveNotification({
            id: `live_ub_${updatedSession.id}_${updatedSession.healthStatus}`,
            category: 'session',
            severity: 'critical',
            title: `Session Alert: ${updatedSession.label}`,
            message: `${updatedSession.phone} reported ${updatedSession.healthStatus.replace(/_/g, ' ')}.`,
            targetTab: 'api_hub',
          });
        }
      } catch {}
    });

    evtSource.addEventListener('campaign:progress', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as {
          campaignId: string;
          checkpoint: CampaignRecipientCheckpoint;
          session?: UserbotSession;
        };
        if (payload.session) {
          setUserbotSessions((prev) =>
            prev.map((s) => (s.id === payload.session!.id ? payload.session! : s))
          );
        }
        setCampaigns((prev) =>
          prev.map((camp) => {
            if (camp.id !== payload.campaignId) return camp;
            const existingCps = camp.checkpoints || [];
            const nextCps = existingCps.some((c) => c.contactId === payload.checkpoint.contactId)
              ? existingCps.map((c) => (c.contactId === payload.checkpoint.contactId ? payload.checkpoint : c))
              : [...existingCps, payload.checkpoint];

            const sentCount = nextCps.filter((c) => c.status === 'sent' || c.status === 'replied').length;
            const failedCount = nextCps.filter((c) => c.status === 'failed').length;
            const unsubscribedCount = nextCps.filter((c) => c.status === 'opted_out').length;
            const breakdown = { ...(camp.failureBreakdown || {}) };
            if (payload.checkpoint.failureReason) {
              breakdown[payload.checkpoint.failureReason] = (breakdown[payload.checkpoint.failureReason] || 0) + 1;
            }
            return {
              ...camp,
              checkpoints: nextCps,
              sentCount,
              deliveredCount: sentCount,
              failedCount,
              unsubscribedCount,
              failureBreakdown: breakdown,
            };
          })
        );
      } catch {}
    });

    evtSource.addEventListener('campaign:paused_failover', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as {
          campaignId: string;
          pausedReason: string;
          flaggedSessionId?: string;
          backup?: CampaignBackupSnapshot;
        };
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === payload.campaignId
              ? {
                  ...c,
                  status: 'paused',
                  pausedReason: payload.pausedReason,
                  flaggedSessionId: payload.flaggedSessionId,
                }
              : c
          )
        );
        if (payload.backup) {
          setCampaignBackups((prev) => [
            payload.backup!,
            ...prev.filter((b) => b.id !== payload.backup!.id),
          ]);
        }
        pushLiveNotification({
          id: `live_failover_${payload.campaignId}_${Date.now()}`,
          category: 'campaign',
          severity: 'warning',
          title: 'Campaign Auto-Paused (Failover Guard)',
          message: payload.pausedReason || 'Campaign paused with backup snapshot saved.',
          targetTab: 'campaigns',
        });
        storageService.logAction(
          'CAMPAIGN_AUTO_FAILOVER_PAUSE',
          'MTProto Resilience',
          `Campaign paused (${payload.pausedReason}). Backup snapshot saved.`,
          currentUserRef.current
        );
        setAuditLogs(storageService.getAuditLogs());
      } catch {}
    });

    evtSource.addEventListener('campaign:completed', (e) => {
      try {
        const { campaignId } = JSON.parse((e as MessageEvent).data);
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaignId ? { ...c, status: 'completed' } : c))
        );
        pushLiveNotification({
          id: `live_cmp_done_${campaignId}`,
          category: 'campaign',
          severity: 'success',
          title: 'Campaign Broadcast Completed',
          message: `Campaign ${campaignId} finished dispatching.`,
          targetTab: 'campaigns',
        });
      } catch {}
    });

    evtSource.addEventListener('unlimited:paused', (e) => {
      try {
        const job = JSON.parse((e as MessageEvent).data);
        pushLiveNotification({
          id: `live_unlim_pause_${job.jobId}_${Date.now()}`,
          category: 'campaign',
          severity: 'warning',
          title: `Dispatch Paused: ${job.name || job.jobId}`,
          message: `${job.sentCount || 0}/${job.totalTargets || 0} dispatched before pause.`,
          targetTab: 'api_hub',
        });
      } catch {}
    });

    evtSource.addEventListener('unlimited:completed', (e) => {
      try {
        const job = JSON.parse((e as MessageEvent).data);
        pushLiveNotification({
          id: `live_unlim_done_${job.jobId}`,
          category: 'campaign',
          severity: 'success',
          title: `Dispatch Completed: ${job.name || job.jobId}`,
          message: `Sent ${job.sentCount || 0} of ${job.totalTargets || 0} targets.`,
          targetTab: 'api_hub',
        });
      } catch {}
    });

    evtSource.addEventListener('inbox:new_message', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as {
          sessionId: string;
          sessionLabel: string;
          senderId: string;
          text: string;
          isOptOut: boolean;
          timestamp: string;
        };
        const matched =
          contactsRef.current.find(
            (c) => c.telegramUid === payload.senderId || c.telegramUsername === payload.senderId
          ) || contactsRef.current[0];

        if (!matched) return;
        const isThreadCurrentlyOpen =
          activeTabRef.current === 'live_chat' && selectedChatContactIdRef.current === matched.id;
        if (!isThreadCurrentlyOpen) {
          pushLiveNotification({
            id: `live_msg_${matched.id}_${Date.now()}`,
            category: payload.isOptOut ? 'compliance' : 'chat',
            severity: payload.isOptOut ? 'warning' : 'info',
            title: payload.isOptOut
              ? `Opt-Out Request: ${matched.name}`
              : `Inbound Message: ${matched.name}`,
            message: payload.text.slice(0, 140),
            targetTab: payload.isOptOut ? 'contacts' : 'live_chat',
            targetContactId: matched.id,
          });
        }
        const msg: ChatMessage = {
          id: `m_sse_${Date.now()}`,
          contactId: matched.id,
          sender: 'contact',
          senderName: matched.name,
          text: payload.text,
          timestamp: new Date().toTimeString().slice(0, 8),
          status: isThreadCurrentlyOpen ? 'read' : 'delivered',
          sessionId: payload.sessionId,
          sessionLabel: payload.sessionLabel,
        };
        setChats((prev) => ({
          ...prev,
          [matched.id]: [
            ...(prev[matched.id] || []).map((m) =>
              m.sender === 'agent' && m.status !== 'read' ? { ...m, status: 'read' as const } : m
            ),
            msg,
          ],
        }));

        if (payload.isOptOut) {
          setContacts((prev) =>
            prev.map((c) =>
              c.id === matched.id
                ? {
                    ...c,
                    optInStatus: 'opted_out',
                    optOutTimestamp: new Date().toISOString(),
                    optOutReason: 'Inbound STOP / Unsubscribe via Telegram Userbot',
                  }
                : c
            )
          );
        } else {
          const cfg = moderatorRoutingRef.current;
          const mods = allUsersRef.current.filter((u) => u.role === 'moderator');
          let autoModId: string | undefined;
          if (!matched.assignedModeratorId && cfg.enabled && cfg.autoRouteInboundMessages && cfg.mode !== 'manual' && mods.length > 0) {
            if (cfg.mode === 'specific_moderator') {
              autoModId = mods.find((m) => m.id === cfg.defaultModeratorId)?.id || mods[0].id;
            } else if (cfg.mode === 'round_robin') {
              const idx = cfg.lastRoundRobinIndex % mods.length;
              autoModId = mods[idx].id;
              setModeratorRouting((prevCfg) => ({ ...prevCfg, lastRoundRobinIndex: idx + 1 }));
            }
          }
          if (!matched.initialSessionId || autoModId) {
            setContacts((prev) =>
              prev.map((c) =>
                c.id === matched.id
                  ? {
                      ...c,
                      initialSessionId: c.initialSessionId || payload.sessionId,
                      assignedModeratorId: c.assignedModeratorId || autoModId,
                    }
                  : c
              )
            );
          }
        }
      } catch {}
    });

    return () => {
      mounted = false;
      evtSource.close();
    };
  }, []);

  // Persistence effects
  useEffect(() => storageService.setContacts(contacts), [contacts]);
  useEffect(() => storageService.setCampaigns(campaigns), [campaigns]);
  useEffect(() => storageService.setChats(chats), [chats]);
  useEffect(() => storageService.setAutoResponses(autoResponses), [autoResponses]);
  useEffect(() => storageService.setWebhooks(webhooks), [webhooks]);
  useEffect(() => storageService.setWebhookLogs(webhookLogs), [webhookLogs]);
  useEffect(() => storageService.setWordPressConfig(wpConfig), [wpConfig]);
  useEffect(() => storageService.setGoogleSync(googleSync), [googleSync]);
  useEffect(() => storageService.setBotConfig(botConfig), [botConfig]);
  useEffect(() => storageService.setUserbotSessions(userbotSessions), [userbotSessions]);
  useEffect(() => storageService.setAudienceLists(audienceLists), [audienceLists]);
  useEffect(() => storageService.setCampaignBackups(campaignBackups), [campaignBackups]);
  useEffect(() => storageService.setCloudFiles(cloudFiles), [cloudFiles]);
  useEffect(() => storageService.setModeratorRouting(moderatorRouting), [moderatorRouting]);

  const handleLanguageChange = (_newLang: SupportedLanguage) => {
    setLang('en');
  };

  const handleSiteLanguageChange = (code: string) => {
    setSiteLang(code);
  };

  const handleLogout = () => {
    storageService.logAction('USER_LOGGED_OUT', 'Auth System', `User @${currentUser.username} logged out.`, currentUser);
    authTokenRef.current = null;
    setAuthToken(null);
    setAuthenticatedUser(null);
    setSignupRequests([]);
    setIsLoggedIn(false);
    setIsFullScreen(false);
    setViewMode('portal');
    storageService.setIsLoggedIn(false);
    setAuditLogs(storageService.getAuditLogs());
    void signOut(auth).catch(() => {});
  };

  const handleCreateUser = async (
    payload: CreateTeamUserPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    const token = authTokenRef.current;
    if (!token || (currentUser.role !== 'admin' && currentUser.role !== 'editor')) {
      return { ok: false, error: 'Administrator or Editor session required.' };
    }
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.user) {
        return { ok: false, error: data?.error || 'Failed to create team user.' };
      }
      await fetchAdminUsers(token);
      storageService.logAction(
        'USER_CREATED',
        'RBAC Security',
        `Created approved account @${data.user.username} (${data.user.role})`,
        currentUser
      );
      setAuditLogs(storageService.getAuditLogs());
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to connect to auth service.' };
    }
  };

  const handleUpdateUser = async (
    userId: string,
    updates: UpdateTeamUserPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    const token = authTokenRef.current;
    if (!token || (currentUser.role !== 'admin' && currentUser.role !== 'editor')) {
      return { ok: false, error: 'Administrator or Editor session required.' };
    }
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to update user.' };
      }
      await fetchAdminUsers(token);
      storageService.logAction('USER_UPDATED', 'RBAC Security', `Updated user ${userId}`, currentUser);
      setAuditLogs(storageService.getAuditLogs());
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to connect to auth service.' };
    }
  };

  const handleDeleteUser = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
    const token = authTokenRef.current;
    if (!token || (currentUser.role !== 'admin' && currentUser.role !== 'editor')) {
      return { ok: false, error: 'Administrator or Editor session required.' };
    }
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to delete user.' };
      }
      await fetchAdminUsers(token);
      storageService.logAction('USER_DELETED', 'RBAC Security', `Deleted user ${userId}`, currentUser);
      setAuditLogs(storageService.getAuditLogs());
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to connect to auth service.' };
    }
  };

  const handleApproveSignup = async (
    requestId: string,
    role: 'admin' | 'moderator' | 'editor' | 'viewer'
  ): Promise<{ ok: boolean; error?: string }> => {
    const token = authTokenRef.current;
    if (!token || (currentUser.role !== 'admin' && currentUser.role !== 'editor')) {
      return { ok: false, error: 'Administrator or Editor session required.' };
    }
    try {
      const res = await fetch(`/api/auth/requests/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to approve signup request.' };
      }
      await fetchAdminUsers(token);
      storageService.logAction(
        'SIGNUP_APPROVED',
        'RBAC Security',
        `Approved @${data.user?.username || requestId} as ${role}`,
        currentUser
      );
      setAuditLogs(storageService.getAuditLogs());
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to connect to auth service.' };
    }
  };

  const handleRejectSignup = async (requestId: string): Promise<{ ok: boolean; error?: string }> => {
    const token = authTokenRef.current;
    if (!token || (currentUser.role !== 'admin' && currentUser.role !== 'editor')) {
      return { ok: false, error: 'Administrator or Editor session required.' };
    }
    try {
      const res = await fetch(`/api/auth/requests/${encodeURIComponent(requestId)}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to decline signup request.' };
      }
      await fetchAdminUsers(token);
      storageService.logAction('SIGNUP_DECLINED', 'RBAC Security', `Declined signup request ${requestId}`, currentUser);
      setAuditLogs(storageService.getAuditLogs());
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to connect to auth service.' };
    }
  };

  const handleUpdateAdminCredentials = async (
    payload: UpdateAdminCredentialsPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    const token = authTokenRef.current;
    if (!token || currentUser.role !== 'admin') {
      return { ok: false, error: 'Administrator session required.' };
    }
    try {
      const res = await fetch('/api/auth/admin/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.token || !data?.user) {
        return { ok: false, error: data?.error || 'Failed to update Administrator credentials.' };
      }
      authTokenRef.current = data.token;
      setAuthToken(data.token);
      setAuthenticatedUser(data.user);
      if (typeof data.adminPasswordConfigured === 'boolean') {
        setAdminPasswordConfigured(data.adminPasswordConfigured);
      }
      await fetchAdminUsers(data.token);
      storageService.logAction('ADMIN_CREDENTIALS_UPDATED', 'RBAC Security', 'Administrator updated ID/password.', data.user);
      setAuditLogs(storageService.getAuditLogs());
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to connect to auth service.' };
    }
  };

  const handleResetAdminCredentials = async (): Promise<{ ok: boolean; error?: string }> => {
    const token = authTokenRef.current;
    if (!token || currentUser.role !== 'admin') {
      return { ok: false, error: 'Administrator session required.' };
    }
    try {
      const res = await fetch('/api/auth/admin/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to reset Administrator credentials.' };
      }
      setAdminPasswordConfigured(Boolean(data.adminPasswordConfigured));
      storageService.logAction(
        'ADMIN_CREDENTIALS_RESET',
        'RBAC Security',
        'All Administrator username and password credentials were reset.',
        currentUser
      );
      authTokenRef.current = null;
      setAuthToken(null);
      setAuthenticatedUser(null);
      setSignupRequests([]);
      setIsLoggedIn(false);
      setViewMode('portal');
      storageService.setIsLoggedIn(false);
      setAuditLogs(storageService.getAuditLogs());
      void signOut(auth).catch(() => {});
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to connect to auth service.' };
    }
  };

  const pickNextModeratorId = (cfg: ModeratorRoutingConfig, usersList: UserAccount[]): { moderatorId?: string; nextIndex: number } => {
    const mods = usersList.filter((u) => u.role === 'moderator');
    if (!cfg.enabled || cfg.mode === 'manual' || mods.length === 0) {
      return { moderatorId: undefined, nextIndex: cfg.lastRoundRobinIndex };
    }
    if (cfg.mode === 'specific_moderator') {
      const target = mods.find((m) => m.id === cfg.defaultModeratorId) || mods[0];
      return { moderatorId: target.id, nextIndex: cfg.lastRoundRobinIndex };
    }
    const idx = cfg.lastRoundRobinIndex % mods.length;
    return { moderatorId: mods[idx].id, nextIndex: cfg.lastRoundRobinIndex + 1 };
  };

  // Contacts & Smart Deduplication (Preserving Opt-Out Status!)
  const handleAddContact = (contactData: Omit<Contact, 'id' | 'createdAt'>) => {
    let assignedModeratorId = contactData.assignedModeratorId;
    if (!assignedModeratorId && moderatorRouting.enabled && moderatorRouting.autoRouteNewContacts && moderatorRouting.mode !== 'manual') {
      const picked = pickNextModeratorId(moderatorRouting, allUsers);
      assignedModeratorId = picked.moderatorId;
      if (picked.nextIndex !== moderatorRouting.lastRoundRobinIndex) {
        setModeratorRouting((prev) => ({ ...prev, lastRoundRobinIndex: picked.nextIndex }));
      }
    }
    const newContact: Contact = {
      ...contactData,
      assignedModeratorId,
      id: `c_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setContacts((prev) => [newContact, ...prev]);
    if (firebaseUidRef.current) {
      void firestoreSync.saveContactToFirestore(firebaseUidRef.current, newContact);
    }
  };

  const handleUpdateContact = (id: string, updates: Partial<Contact>) => {
    let updatedContact: Contact | undefined;
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        updatedContact = { ...c, ...updates };
        return updatedContact;
      })
    );
    if (firebaseUidRef.current && updatedContact) {
      void firestoreSync.saveContactToFirestore(firebaseUidRef.current, updatedContact);
    }
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    if (firebaseUidRef.current) {
      void firestoreSync.deleteContactFromFirestore(firebaseUidRef.current, id);
    }
  };

  const handleBulkAddContacts = (newContacts: Partial<Contact>[]) => {
    let rrIndex = moderatorRouting.lastRoundRobinIndex;
    const mods = allUsers.filter((u) => u.role === 'moderator');
    const shouldAutoRoute =
      moderatorRouting.enabled && moderatorRouting.autoRouteNewContacts && moderatorRouting.mode !== 'manual' && mods.length > 0;

    const resolveModeratorForContact = (explicit?: string) => {
      if (explicit) return explicit;
      if (!shouldAutoRoute) return undefined;
      if (moderatorRouting.mode === 'specific_moderator') {
        return (mods.find((m) => m.id === moderatorRouting.defaultModeratorId) || mods[0]).id;
      }
      const chosen = mods[rrIndex % mods.length].id;
      rrIndex += 1;
      return chosen;
    };

    setContacts((prev) => {
      const normalizeKey = (p: string) => p.replace(/\D/g, '') || p.trim();
      const byDigits = new Map(prev.map((c) => [normalizeKey(c.phoneNumber), c]));
      const added: Contact[] = [];

      newContacts.forEach((c, idx) => {
        const phone = c.phoneNumber || '';
        const key = normalizeKey(phone);
        const existing = key ? byDigits.get(key) : undefined;
        if (existing) {
          // Strict compliance merge:
          // 1) Never re-opt-in an existing opted_out or dnc_suppressed contact
          // 2) Apply incoming opted_out / dnc_suppressed flag if CSV explicitly opts them out
          const existingSuppressed =
            existing.optInStatus === 'opted_out' || existing.optInStatus === 'dnc_suppressed';
          const incomingSuppressed =
            c.optInStatus === 'opted_out' || c.optInStatus === 'dnc_suppressed';

          let mergedOptIn: Contact['optInStatus'] = existing.optInStatus;
          if (existingSuppressed) {
            mergedOptIn = existing.optInStatus;
          } else if (incomingSuppressed && c.optInStatus) {
            mergedOptIn = c.optInStatus;
          } else if (
            c.optInStatus === 'explicit_opt_in' &&
            existing.optInStatus === 'implicit_opt_in'
          ) {
            mergedOptIn = 'explicit_opt_in';
          }

          const incomingNameClean =
            c.name && !/^Lead\s+/i.test(c.name.trim()) ? c.name.trim() : '';

          byDigits.set(key, {
            ...existing,
            name: incomingNameClean || existing.name,
            company: c.company?.trim() || existing.company,
            email: c.email?.trim() || existing.email,
            group: c.group?.trim() || existing.group,
            telegramUsername: c.telegramUsername || existing.telegramUsername,
            telegramUid: c.telegramUid || existing.telegramUid,
            hasTelegram: existing.hasTelegram || Boolean(c.hasTelegram),
            assignedModeratorId:
              existing.assignedModeratorId || resolveModeratorForContact(c.assignedModeratorId),
            customFields: { ...(existing.customFields || {}), ...(c.customFields || {}) },
            tags: Array.from(new Set([...(existing.tags || []), ...(c.tags || [])])),
            notes: existing.notes || c.notes,
            optInStatus: mergedOptIn,
            optOutTimestamp: existingSuppressed
              ? existing.optOutTimestamp
              : incomingSuppressed
              ? c.optOutTimestamp || new Date().toISOString()
              : existing.optOutTimestamp,
            optOutReason: existingSuppressed
              ? existing.optOutReason
              : incomingSuppressed
              ? c.optOutReason || 'CSV Import Opt-Out Compliance'
              : existing.optOutReason,
          });
        } else {
          const created: Contact = {
            id: c.id || `c_${Date.now()}_${idx}`,
            name: c.name || `Lead ${idx + 1}`,
            phoneNumber: phone || '+8801700000000',
            telegramUsername: c.telegramUsername,
            telegramUid: c.telegramUid || `tg_${Math.floor(Math.random() * 900000000 + 100000000)}`,
            hasTelegram: c.hasTelegram ?? true,
            telegramStatus: c.telegramStatus || 'active',
            lastSeen: 'Verified via Ingestion',
            company: c.company || '',
            email: c.email || '',
            group: c.group,
            stage: c.stage || 'lead',
            tags: c.tags || ['Batch Import'],
            optInStatus: c.optInStatus || 'explicit_opt_in',
            optInMethod: c.optInMethod || 'auto_assigned',
            optInDate: new Date().toISOString().slice(0, 10),
            optInSource: c.optInSource || 'CSV/Excel Smart Ingest',
            optOutTimestamp:
              c.optInStatus === 'opted_out' || c.optInStatus === 'dnc_suppressed'
                ? c.optOutTimestamp || new Date().toISOString()
                : undefined,
            optOutReason:
              c.optInStatus === 'opted_out' || c.optInStatus === 'dnc_suppressed'
                ? c.optOutReason || 'Imported as Opted-Out'
                : undefined,
            googleContactSynced: false,
            assignedToAgentId: currentUser.id,
            assignedModeratorId: resolveModeratorForContact(c.assignedModeratorId),
            customFields: c.customFields || {},
            notes: c.notes || 'Imported via TelePulse Smart Ingest.',
            createdAt: new Date().toISOString(),
          };
          byDigits.set(normalizeKey(created.phoneNumber), created);
          added.push(created);
        }
      });

      const mergedExisting = prev.map((c) => byDigits.get(normalizeKey(c.phoneNumber)) || c);
      if (firebaseUidRef.current) {
        const uid = firebaseUidRef.current;
        for (const item of [...added, ...mergedExisting.slice(0, 50)]) {
          void firestoreSync.saveContactToFirestore(uid, item);
        }
      }
      return [...added, ...mergedExisting];
    });

    if (rrIndex !== moderatorRouting.lastRoundRobinIndex) {
      setModeratorRouting((prev) => ({ ...prev, lastRoundRobinIndex: rrIndex }));
    }

    storageService.logAction('BULK_CONTACT_INGEST', 'CRM Engine', `Merged/imported ${newContacts.length} contacts with Opt-In/Opt-Out compliance enforcement`, currentUser);
    setAuditLogs(storageService.getAuditLogs());
  };

  // Campaign Creation & Live Load-Balanced Dispatch
  const handleCreateCampaign = async (campData: any) => {
    const seg = campData.targetSegment || 'all';
    let targetPool = contacts;
    if (seg === 'telegram_verified') targetPool = contacts.filter((c) => c.hasTelegram);
    else if (seg === 'stage:customer') targetPool = contacts.filter((c) => c.stage === 'customer');
    else if (seg === 'tag:VIP') targetPool = contacts.filter((c) => c.tags.some((t) => t.toLowerCase().includes('vip')));
    else if (seg.startsWith('audience:')) {
      const aud = audienceLists.find((a) => a.id === seg.replace('audience:', ''));
      targetPool = aud ? contacts.filter((c) => aud.contactIds.includes(c.id)) : [];
    }

    const checkpoints: CampaignRecipientCheckpoint[] = targetPool.map((c) => ({
      contactId: c.id,
      name: c.name,
      phoneNumber: c.phoneNumber,
      status: c.optInStatus === 'opted_out' || c.optInStatus === 'dnc_suppressed' ? 'opted_out' : 'pending',
    }));

    const campaignId = `cmp_${Date.now()}`;
    const newCamp: Campaign = {
      ...campData,
      id: campaignId,
      createdAt: new Date().toISOString(),
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      clickedCount: 0,
      failedCount: 0,
      unsubscribedCount: checkpoints.filter((c) => c.status === 'opted_out').length,
      checkpoints,
    };

    setCampaigns((prev) => [newCamp, ...prev]);
    if (firebaseUidRef.current) {
      void firestoreSync.saveCampaignToFirestore(firebaseUidRef.current, newCamp);
    }
    storageService.logAction('CAMPAIGN_CREATED', 'Broadcast Engine', `Dispatched "${newCamp.name}" across ${campData.assignedSessionIds?.length || 1} Userbot sessions`, currentUser);
    setAuditLogs(storageService.getAuditLogs());

    if (newCamp.status === 'running') {
      try {
        await fetch('/api/campaigns/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            campaignName: newCamp.name,
            messageText: newCamp.messageText,
            recipients: targetPool,
            sessionIds: campData.assignedSessionIds,
            minDelaySec: campData.minDelaySeconds ?? 2,
            maxDelaySec: campData.maxDelaySeconds ?? 4,
            autoAppendOptOutFooter: campData.autoAppendOptOutFooter ?? true,
          }),
        });
      } catch (err) {
        console.warn('Dispatch trigger failed:', err);
      }
    }
  };

  const handleTriggerFailover = async (
    camp: Campaign,
    sessionId: string,
    reason: 'UserDeactivated' | 'AuthKeyUnregistered'
  ) => {
    const pendingRecipients = (camp.checkpoints || []).filter((c) => c.status === 'pending');
    const fallbackPending =
      pendingRecipients.length > 0
        ? pendingRecipients
        : contacts
            .filter((c) => c.optInStatus !== 'opted_out')
            .slice(0, 4)
            .map((c) => ({
              contactId: c.id,
              name: c.name,
              phoneNumber: c.phoneNumber,
              status: 'pending' as const,
            }));

    try {
      await fetch(`/api/campaigns/${camp.id}/trigger-failover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: camp.name,
          sessionId,
          reason,
          pendingRecipients: fallbackPending,
        }),
      });
    } catch (err) {
      console.warn('Failover trigger error:', err);
    }
  };

  const handleResumeFromBackup = async (backup: CampaignBackupSnapshot, newSessionId: string) => {
    const targetCamp = campaigns.find((c) => c.id === backup.campaignId);
    try {
      const res = await fetch(`/api/campaigns/${backup.campaignId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupId: backup.id,
          newSessionId,
          campaignName: backup.campaignName,
          messageText: targetCamp?.messageText || 'Hello {{name}}, following up on your request!',
          pendingRecipients: backup.pendingRecipients,
        }),
      });
      if (res.ok) {
        setCampaignBackups((prev) =>
          prev.map((b) =>
            b.id === backup.id
              ? { ...b, restoredAt: new Date().toISOString(), restoredWithSessionId: newSessionId }
              : b
          )
        );
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === backup.campaignId
              ? {
                  ...c,
                  status: 'running',
                  pausedReason: undefined,
                  assignedSessionIds: [newSessionId],
                }
              : c
          )
        );
        storageService.logAction('CAMPAIGN_HOTSWAP_RESUMED', 'MTProto Resilience', `Resumed "${backup.campaignName}" with session ${newSessionId}`, currentUser);
        setAuditLogs(storageService.getAuditLogs());
      }
    } catch (err) {
      console.warn('Resume backup failed:', err);
    }
  };

  const handleUpdateCampaignStatus = (id: string, status: Campaign['status']) => {
    let nextCamp: Campaign | undefined;
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        nextCamp = { ...c, status };
        return nextCamp;
      })
    );
    if (firebaseUidRef.current && nextCamp) {
      void firestoreSync.saveCampaignToFirestore(firebaseUidRef.current, nextCamp);
    }
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    if (firebaseUidRef.current) {
      void firestoreSync.deleteCampaignFromFirestore(firebaseUidRef.current, id);
    }
  };

  // Shared Inbox Thread-Continuous Messaging
  const handleSendMessage = async (
    contactId: string,
    text: string,
    options?: {
      replyTo?: ChatMessage['replyTo'];
      attachment?: ChatMessage['attachment'];
      originalText?: string;
      translatedLang?: string;
    }
  ) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.optInStatus === 'opted_out' || contact.optInStatus === 'dnc_suppressed') return;

    const sessionId = contact.initialSessionId || userbotSessions.find((u) => u.healthStatus === 'active')?.id;
    const sessionObj = userbotSessions.find((u) => u.id === sessionId);

    const newMsg: ChatMessage = {
      id: `m_${Date.now()}`,
      contactId,
      sender: 'agent',
      senderName: currentUser.name,
      text,
      timestamp: new Date().toTimeString().slice(0, 8),
      status: 'sent',
      sessionId,
      sessionLabel: sessionObj?.label,
      originalText: options?.originalText,
      translatedLang: options?.translatedLang,
      replyTo: options?.replyTo,
      attachment: options?.attachment,
    };

    setChats((prev) => ({ ...prev, [contactId]: [...(prev[contactId] || []), newMsg] }));
    if (firebaseUidRef.current) {
      void firestoreSync.saveChatMessageToFirestore(firebaseUidRef.current, newMsg);
    }

    try {
      await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          phoneNumber: contact.phoneNumber,
          telegramUsername: contact.telegramUsername,
          telegramUid: contact.telegramUid,
          initialSessionId: sessionId,
          text: text || (options?.attachment ? `[Attachment: ${options.attachment.name}]` : ''),
          botToken: botConfig.botToken,
          moderatorId: currentUser.id,
          moderatorName: currentUser.name,
        }),
      });
    } catch {}

    setTimeout(() => {
      setChats((prev) => ({
        ...prev,
        [contactId]: (prev[contactId] || []).map((m) => (m.id === newMsg.id ? { ...m, status: 'read' as const } : m)),
      }));
    }, 1200);
  };

  const handleUpdateMessageStatus = (
    contactId: string,
    messageId: string,
    status: ChatMessage['status']
  ) => {
    setChats((prev) => ({
      ...prev,
      [contactId]: (prev[contactId] || []).map((m) => (m.id === messageId ? { ...m, status } : m)),
    }));
  };

  const handleMarkThreadRead = (contactId: string) => {
    setChats((prev) => ({
      ...prev,
      [contactId]: (prev[contactId] || []).map((m) =>
        m.sender === 'agent' && m.status !== 'read' ? { ...m, status: 'read' as const } : m
      ),
    }));
  };

  const handleMarkIncomingRead = (contactId: string) => {
    setChats((prev) => {
      const list = prev[contactId] || [];
      if (!list.some((m) => m.sender === 'contact' && m.status !== 'read')) return prev;
      return {
        ...prev,
        [contactId]: list.map((m) =>
          m.sender === 'contact' && m.status !== 'read' ? { ...m, status: 'read' as const } : m
        ),
      };
    });
  };

  const handleMarkIncomingUnread = (contactId: string) => {
    setChats((prev) => {
      const list = prev[contactId] || [];
      const lastContactIdx = [...list].reverse().findIndex((m) => m.sender === 'contact');
      if (lastContactIdx === -1) return prev;
      const targetIdx = list.length - 1 - lastContactIdx;
      return {
        ...prev,
        [contactId]: list.map((m, idx) =>
          idx === targetIdx ? { ...m, status: 'delivered' as const } : m
        ),
      };
    });
  };

  const handleToggleArchiveThread = (contactId: string, archive: boolean) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              isArchived: archive,
              archivedAt: archive ? new Date().toISOString() : undefined,
            }
          : c
      )
    );
    storageService.logAction(
      archive ? 'CHAT_THREAD_ARCHIVED' : 'CHAT_THREAD_UNARCHIVED',
      'Shared Inbox',
      `${archive ? 'Archived' : 'Restored'} conversation for contact ${contactId}`,
      currentUser
    );
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleArchiveInactiveThreads = (contactIds: string[]) => {
    if (contactIds.length === 0) return;
    const idSet = new Set(contactIds);
    const now = new Date().toISOString();
    setContacts((prev) =>
      prev.map((c) => (idSet.has(c.id) ? { ...c, isArchived: true, archivedAt: now } : c))
    );
    storageService.logAction(
      'INACTIVE_CHATS_ARCHIVED',
      'Shared Inbox',
      `Archived ${contactIds.length} inactive chat thread(s).`,
      currentUser
    );
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleReactMessage = (contactId: string, messageId: string, emoji: string) => {
    setChats((prev) => {
      const list = prev[contactId] || [];
      return {
        ...prev,
        [contactId]: list.map((m) => {
          if (m.id !== messageId) return m;
          const nextReactions = { ...(m.reactions || {}) };
          if (nextReactions[emoji]) {
            delete nextReactions[emoji];
          } else {
            nextReactions[emoji] = 1;
          }
          return { ...m, reactions: nextReactions };
        }),
      };
    });
  };

  const handleTogglePinMessage = (contactId: string, messageId: string) => {
    setChats((prev) => {
      const list = prev[contactId] || [];
      return {
        ...prev,
        [contactId]: list.map((m) =>
          m.id === messageId ? { ...m, isPinned: !m.isPinned } : { ...m, isPinned: false }
        ),
      };
    });
  };

  const handleSimulateInboundMessage = (contactId: string, incomingText: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    const isThreadOpen = activeTabRef.current === 'live_chat' && selectedChatContactIdRef.current === contactId;
    const newMsg: ChatMessage = {
      id: `m_in_${Date.now()}`,
      contactId,
      sender: 'contact',
      senderName: contact ? contact.name : 'Customer',
      text: incomingText,
      timestamp: new Date().toTimeString().slice(0, 8),
      status: isThreadOpen ? 'read' : 'delivered',
    };

    const lower = incomingText.trim().toLowerCase();
    const isOptOutKeyword = ['stop', 'unsubscribe', '/unsubscribe'].some((kw) => lower.includes(kw));
    const matchedRule = autoResponses.find((r) => {
      if (!r.isActive) return false;
      const kw = r.triggerKeyword.toLowerCase();
      if (r.matchType === 'exact') return lower === kw;
      if (r.matchType === 'starts_with') return lower.startsWith(kw);
      return lower.includes(kw);
    });

    setChats((prev) => {
      const updated = [
        ...(prev[contactId] || []).map((m) =>
          m.sender === 'agent' && m.status !== 'read' ? { ...m, status: 'read' as const } : m
        ),
        newMsg,
      ];
      if (isOptOutKeyword || matchedRule?.action === 'opt_out') {
        const confirmReply: ChatMessage = {
          id: `m_bot_${Date.now() + 5}`,
          contactId,
          sender: 'bot',
          senderName: 'TelePulse Compliance Bot',
          text: 'You have been unsubscribed (Opt-Out). You will receive no further messages.',
          timestamp: new Date().toTimeString().slice(0, 8),
          status: 'read',
        };
        return { ...prev, [contactId]: [...updated, confirmReply] };
      }
      if (matchedRule) {
        const botReply: ChatMessage = {
          id: `m_bot_${Date.now() + 10}`,
          contactId,
          sender: 'bot',
          senderName: 'TelePulse Auto-Responder',
          text: matchedRule.replyText,
          timestamp: new Date().toTimeString().slice(0, 8),
          status: 'read',
        };
        return { ...prev, [contactId]: [...updated, botReply] };
      }
      return { ...prev, [contactId]: updated };
    });

    if (isOptOutKeyword || matchedRule?.action === 'opt_out') {
      handleUpdateContact(contactId, {
        optInStatus: 'opted_out',
        optOutTimestamp: new Date().toISOString(),
        optOutReason: `Customer replied "${incomingText}"`,
      });
      storageService.logAction('LEAD_OPTED_OUT', 'Compliance Guard', `${contact?.phoneNumber} opted out via STOP.`, currentUser);
      setAuditLogs(storageService.getAuditLogs());
    } else if (
      contact &&
      !contact.assignedModeratorId &&
      moderatorRouting.enabled &&
      moderatorRouting.autoRouteInboundMessages &&
      moderatorRouting.mode !== 'manual'
    ) {
      const picked = pickNextModeratorId(moderatorRouting, allUsers);
      if (picked.moderatorId) {
        handleUpdateContact(contactId, { assignedModeratorId: picked.moderatorId });
        if (picked.nextIndex !== moderatorRouting.lastRoundRobinIndex) {
          setModeratorRouting((prev) => ({ ...prev, lastRoundRobinIndex: picked.nextIndex }));
        }
      }
    }
  };

  const handleAssignModerator = (contactId: string, moderatorId: string) => {
    handleUpdateContact(contactId, { assignedModeratorId: moderatorId || undefined });
    const mod = allUsers.find((u) => u.id === moderatorId);
    storageService.logAction(
      'INBOX_MODERATOR_ASSIGNED',
      'Shared Inbox',
      `Assigned contact ${contactId} to ${mod ? mod.name : 'Unassigned'}`,
      currentUser
    );
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleUpdateModeratorRouting = (updates: Partial<ModeratorRoutingConfig>) => {
    setModeratorRouting((prev) => {
      const next = { ...prev, ...updates };
      storageService.setModeratorRouting(next);
      return next;
    });
    storageService.logAction(
      'MODERATOR_ROUTING_UPDATED',
      'Moderator Routing',
      `Updated moderator routing configuration (${JSON.stringify(updates)})`,
      currentUser
    );
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleRouteContactsToModerator = (moderatorId: string, scope: 'all' | 'unassigned' | string[]) => {
    if (!moderatorId) return;
    const mod = allUsers.find((u) => u.id === moderatorId);
    let routedCount = 0;

    setContacts((prev) =>
      prev.map((c) => {
        const matches =
          scope === 'all'
            ? true
            : scope === 'unassigned'
            ? !c.assignedModeratorId
            : scope.includes(c.id);
        if (!matches) return c;
        routedCount += 1;
        return { ...c, assignedModeratorId: moderatorId, isArchived: false };
      })
    );

    storageService.logAction(
      'BULK_MODERATOR_ROUTING',
      'Moderator Routing',
      `Routed ${scope === 'all' ? 'all' : scope === 'unassigned' ? 'unassigned' : scope.length} communication thread(s) to ${mod ? mod.name : moderatorId}`,
      currentUser
    );
    setAuditLogs(storageService.getAuditLogs());
    return routedCount;
  };

  const handleDistributeContactsRoundRobin = (scope: 'all' | 'unassigned') => {
    const mods = allUsers.filter((u) => u.role === 'moderator');
    if (mods.length === 0) return 0;

    let rrIdx = moderatorRouting.lastRoundRobinIndex;
    let distributed = 0;

    setContacts((prev) =>
      prev.map((c) => {
        const matches = scope === 'all' ? true : !c.assignedModeratorId;
        if (!matches) return c;
        const mod = mods[rrIdx % mods.length];
        rrIdx += 1;
        distributed += 1;
        return { ...c, assignedModeratorId: mod.id, isArchived: false };
      })
    );

    setModeratorRouting((prev) => ({ ...prev, lastRoundRobinIndex: rrIdx }));
    storageService.logAction(
      'ROUND_ROBIN_MODERATOR_ROUTING',
      'Moderator Routing',
      `Distributed ${scope} conversations evenly across ${mods.length} active moderator(s)`,
      currentUser
    );
    setAuditLogs(storageService.getAuditLogs());
    return distributed;
  };

  // Auto-response / Google Sync / Webhooks / Cloud Files / WP handlers
  const handleAddAutoRule = (rule: Omit<AutoResponseRule, 'id'>) => {
    const newRule: AutoResponseRule = { ...rule, id: `rule_${Date.now()}` };
    setAutoResponses((prev) => [...prev, newRule]);
    if (firebaseUidRef.current) {
      void firestoreSync.saveAutoResponseToFirestore(firebaseUidRef.current, newRule);
    }
  };
  const handleToggleAutoRule = (id: string) => {
    let nextRule: AutoResponseRule | undefined;
    setAutoResponses((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        nextRule = { ...r, isActive: !r.isActive };
        return nextRule;
      })
    );
    if (firebaseUidRef.current && nextRule) {
      void firestoreSync.saveAutoResponseToFirestore(firebaseUidRef.current, nextRule);
    }
  };
  const handleDeleteAutoRule = (id: string) => {
    setAutoResponses((prev) => prev.filter((r) => r.id !== id));
    if (firebaseUidRef.current) {
      void firestoreSync.deleteAutoResponseFromFirestore(firebaseUidRef.current, id);
    }
  };

  const handleTriggerGoogleSync = () => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const nextSync = { ...googleSync, lastSyncedAt: now, syncedContactsCount: contacts.length };
    setGoogleSync(nextSync);
    setContacts((prev) => prev.map((c) => ({ ...c, googleContactSynced: true })));
    if (firebaseUidRef.current) {
      void firestoreSync.saveWorkspaceSettingToFirestore(firebaseUidRef.current, 'googleSync', nextSync);
    }
  };

  const handleDispatchTestWebhook = async (webhookId: string, eventName: string, payload: any): Promise<WebhookLog> => {
    const hook = webhooks.find((w) => w.id === webhookId);
    let responseStatus = 400;
    let responseBody = 'No webhook endpoint selected.';
    let executionTimeMs = 0;

    if (hook?.endpointUrl) {
      try {
        const res = await fetch('/api/webhooks/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpointUrl: hook.endpointUrl,
            secretToken: hook.secretToken,
            eventName,
            payload,
          }),
        });
        const data = await res.json().catch(() => ({}));
        responseStatus = Number(data?.status) || res.status || 200;
        responseBody = typeof data?.body === 'string' ? data.body : JSON.stringify(data);
        executionTimeMs = Number(data?.executionTimeMs) || 25;
      } catch (err: any) {
        responseStatus = 502;
        responseBody = err?.message || 'Webhook dispatch failed';
      }
    }

    const newLog: WebhookLog = {
      id: `log_${Date.now()}`,
      webhookId,
      event: eventName,
      payload: JSON.stringify(payload, null, 2),
      responseStatus,
      responseBody,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      executionTimeMs,
    };
    setWebhookLogs((prev) => [newLog, ...prev].slice(0, 100));
    let updatedHook: WebhookEndpoint | undefined;
    setWebhooks((prev) =>
      prev.map((w) => {
        if (w.id !== webhookId) return w;
        const nextTotal = w.totalCalls + 1;
        const ok = responseStatus >= 200 && responseStatus < 300;
        const nextRate = Math.round(((w.successRate * w.totalCalls + (ok ? 100 : 0)) / nextTotal) * 10) / 10;
        updatedHook = { ...w, totalCalls: nextTotal, successRate: nextRate };
        return updatedHook;
      })
    );
    if (firebaseUidRef.current) {
      void firestoreSync.saveWebhookLogToFirestore(firebaseUidRef.current, newLog);
      if (updatedHook) {
        void firestoreSync.saveWebhookToFirestore(firebaseUidRef.current, updatedHook);
      }
    }
    return newLog;
  };

  const handleCreateWebhook = (hook: any) => {
    const newHook: WebhookEndpoint = { ...hook, id: `wh_${Date.now()}`, totalCalls: 0, successRate: 100 };
    setWebhooks((prev) => [...prev, newHook]);
    if (firebaseUidRef.current) {
      void firestoreSync.saveWebhookToFirestore(firebaseUidRef.current, newHook);
    }
  };
  const handleDeleteWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    if (firebaseUidRef.current) {
      void firestoreSync.deleteWebhookFromFirestore(firebaseUidRef.current, id);
    }
  };

  const handleUploadFile = (fileData: any) => {
    const newFile: CloudFile = { ...fileData, id: `f_${Date.now()}`, uploadedAt: new Date().toISOString().slice(0, 10) };
    setCloudFiles((prev) => [newFile, ...prev]);
    if (firebaseUidRef.current) {
      void firestoreSync.saveCloudFileToFirestore(firebaseUidRef.current, newFile);
    }
  };
  const handleDeleteFile = (id: string) => {
    setCloudFiles((prev) => prev.filter((f) => f.id !== id));
    if (firebaseUidRef.current) {
      void firestoreSync.deleteCloudFileFromFirestore(firebaseUidRef.current, id);
    }
  };

  const handleTestWordPress = async () => {
    const cleanUrl = (wpConfig.siteUrl || '').trim();
    if (!/^https?:\/\/[^/]+/i.test(cleanUrl) || !wpConfig.consumerKey?.trim() || !wpConfig.consumerSecret?.trim()) {
      setWpConfig((prev) => ({ ...prev, connected: false }));
      return false;
    }
    await new Promise((r) => setTimeout(r, 350));
    setWpConfig((prev) => ({ ...prev, connected: true, lastSyncTimestamp: new Date().toISOString() }));
    return true;
  };

  const handleSendTestNotification = () => {
    storageService.logAction('TELEGRAM_ADMIN_ALERT', 'Telegram Bot API', `Test alert sent to ${botConfig.adminChatId}`, currentUser);
    setAuditLogs(storageService.getAuditLogs());
  };

  const canAccessTab = (tab: TabId): boolean => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'editor') return tab !== 'dashboard';
    if (currentUser.role === 'moderator') {
      return ['live_chat', 'campaigns', 'phone_filter'].includes(tab);
    }
    if (currentUser.role === 'viewer') {
      return tab === 'live_chat';
    }
    return false;
  };

  const effectiveTab: TabId = canAccessTab(activeTab)
    ? activeTab
    : currentUser.role === 'moderator'
    ? 'live_chat'
    : currentUser.role === 'editor'
    ? 'campaigns'
    : currentUser.role === 'viewer'
    ? 'live_chat'
    : 'dashboard';

  const allNotifications = useMemo<AppNotification[]>(() => {
    const role = currentUser.role;
    const list: AppNotification[] = [];

    // 1. Live push notifications filtered by RBAC permissions
    for (const ln of liveNotifications) {
      if (!ln.targetTab || canAccessTab(ln.targetTab)) {
        list.push(ln);
      }
    }

    // 2. Pending Signup Approvals (Admin & Editor)
    if (role === 'admin' || role === 'editor') {
      for (const reqItem of signupRequests) {
        if (reqItem.status === 'pending') {
          list.push({
            id: `approval_${reqItem.id}`,
            category: 'approval',
            severity: 'warning',
            title: `Pending Signup Approval: ${reqItem.name}`,
            message: `@${reqItem.username} (${reqItem.email}) requested ${reqItem.requestedRole} role access.`,
            timestamp: reqItem.createdAt,
            targetTab: 'team_rbac',
          });
        }
      }
    }

    // 3. Unread Customer Messages (Admin, Viewer, Moderator-assigned)
    if (canAccessTab('live_chat')) {
      for (const c of contacts) {
        if (c.isArchived) continue;
        if (role === 'moderator' && c.assignedModeratorId !== currentUser.id) continue;
        const thread = chats[c.id] || [];
        const unreadMsgs = thread.filter((m) => m.sender === 'contact' && m.status !== 'read');
        if (unreadMsgs.length > 0) {
          const latest = unreadMsgs[unreadMsgs.length - 1];
          list.push({
            id: `chat_unread_${c.id}_${latest.id}`,
            category: 'chat',
            severity: 'info',
            title: `${unreadMsgs.length} Unread Message${unreadMsgs.length > 1 ? 's' : ''} · ${c.name}`,
            message: latest.text,
            timestamp: latest.timestamp,
            targetTab: 'live_chat',
            targetContactId: c.id,
          });
        }
      }
    }

    // 4. Campaign Alerts & Failover Backups (Admin & Editor)
    if (canAccessTab('campaigns')) {
      for (const camp of campaigns) {
        if (camp.status === 'paused' || camp.status === 'failed') {
          list.push({
            id: `camp_alert_${camp.id}_${camp.status}`,
            category: 'campaign',
            severity: camp.status === 'failed' ? 'critical' : 'warning',
            title: `Campaign ${camp.status === 'failed' ? 'Failed' : 'Paused'}: ${camp.name}`,
            message: camp.pausedReason || 'Broadcast requires review before resuming.',
            timestamp: camp.createdAt,
            targetTab: 'campaigns',
          });
        }
      }
      for (const bkp of campaignBackups) {
        if (!bkp.restoredAt) {
          list.push({
            id: `bkp_ready_${bkp.id}`,
            category: 'campaign',
            severity: 'warning',
            title: `Failover Backup Snapshot: ${bkp.campaignName}`,
            message: `${bkp.pendingCount} pending recipients backed up from ${bkp.triggeredBySessionLabel}.`,
            timestamp: bkp.createdAt,
            targetTab: 'campaigns',
          });
        }
      }
    }

    // 5. Userbot Session Health Alerts (Admin & Editor)
    if (canAccessTab('api_hub')) {
      for (const sess of userbotSessions) {
        if (sess.healthStatus !== 'active') {
          list.push({
            id: `sess_health_${sess.id}_${sess.healthStatus}`,
            category: 'session',
            severity:
              sess.healthStatus === 'flagged_spambot' || sess.healthStatus === 'user_deactivated'
                ? 'critical'
                : 'warning',
            title: `Session ${sess.healthStatus.replace(/_/g, ' ')}: ${sess.label}`,
            message: sess.spambotMessage || `${sess.phone} requires attention in Messaging & API Hub.`,
            timestamp: sess.lastSpambotCheckAt || sess.createdAt,
            targetTab: 'api_hub',
          });
        }
      }

      // Failed Webhook Deliveries
      for (const log of webhookLogs.slice(0, 10)) {
        if (log.responseStatus >= 400 || log.responseStatus === 0) {
          list.push({
            id: `wh_fail_${log.id}`,
            category: 'webhook',
            severity: 'warning',
            title: `Webhook Error (${log.responseStatus || 'Network'}) · ${log.event}`,
            message: log.responseBody.slice(0, 140),
            timestamp: log.timestamp,
            targetTab: 'api_hub',
          });
        }
      }
    }

    // 6. Opt-Out Compliance Events (Admin & Editor)
    if (canAccessTab('contacts')) {
      const optedOutContacts = contacts.filter((c) => c.optInStatus === 'opted_out').slice(0, 6);
      for (const c of optedOutContacts) {
        list.push({
          id: `optout_${c.id}`,
          category: 'compliance',
          severity: 'info',
          title: `Opt-Out Suppressed: ${c.name}`,
          message: c.optOutReason || `${c.phoneNumber} opted out of bulk outreach.`,
          timestamp: c.optOutTimestamp || c.optInDate,
          targetTab: 'contacts',
        });
      }
    }

    // 7. Recent Security & System Audit Events (Admin & Editor)
    if (canAccessTab('audit_logs')) {
      for (const log of auditLogs.slice(0, 6)) {
        list.push({
          id: `audit_${log.id}`,
          category: 'system',
          severity: 'info',
          title: log.action.replace(/_/g, ' '),
          message: `${log.userName}: ${log.details}`,
          timestamp: log.timestamp,
          targetTab: 'audit_logs',
        });
      }
    }

    const deduped = new Map<string, AppNotification>();
    for (const item of list) {
      if (!deduped.has(item.id)) deduped.set(item.id, item);
    }
    return Array.from(deduped.values()).sort((a, b) => {
      const ta = Date.parse(a.timestamp) || 0;
      const tb = Date.parse(b.timestamp) || 0;
      return tb - ta;
    });
  }, [
    currentUser.id,
    currentUser.role,
    liveNotifications,
    signupRequests,
    contacts,
    chats,
    campaigns,
    campaignBackups,
    userbotSessions,
    webhookLogs,
    auditLogs,
  ]);

  if (!isLoggedIn || !authenticatedUser) {
    return (
      <LoginView
        onCredentialLogin={handleCredentialLogin}
        onGoogleAdminSignIn={handleGoogleSignIn}
        onSignupRequest={handleSignupRequest}
        onBootstrapAdmin={handleBootstrapAdmin}
        onGoogleAdminReset={handleGoogleAdminReset}
        adminPasswordConfigured={adminPasswordConfigured}
        firebaseAuthLoading={firebaseAuthLoading}
        firebaseAuthError={firebaseAuthError}
        lang={lang}
        onLanguageChange={handleLanguageChange}
        siteLang={siteLang}
        onSiteLanguageChange={handleSiteLanguageChange}
        isTranslatingSite={isTranslatingSite}
      />
    );
  }

  const handleToggleDesktopAlerts = async () => {
    if (notifDesktopEnabled) {
      setNotifDesktopEnabled(false);
      try {
        localStorage.setItem('telepulse_notif_desktop', 'false');
      } catch {}
      return;
    }
    if (typeof Notification === 'undefined') return;
    try {
      const perm =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      const allowed = perm === 'granted';
      setNotifDesktopEnabled(allowed);
      localStorage.setItem('telepulse_notif_desktop', String(allowed));
    } catch {}
  };

  const handleToggleSoundAlerts = () => {
    setNotifSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('telepulse_notif_sound', String(next));
      } catch {}
      return next;
    });
  };

  const handleSelectNotification = (notif: AppNotification) => {
    setViewMode('portal');
    if (notif.targetContactId) {
      setSelectedChatContactId(notif.targetContactId);
    }
    if (notif.targetTab && canAccessTab(notif.targetTab)) {
      setActiveTab(notif.targetTab);
    }
  };

  const renderNotificationBell = (variant: 'header' | 'dark') => (
    <NotificationBell
      variant={variant}
      notifications={allNotifications}
      readIds={notifReadIds}
      dismissedIds={notifDismissedIds}
      onMarkRead={(id) => setNotifReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
      onMarkAllRead={() =>
        setNotifReadIds((prev) => Array.from(new Set([...prev, ...allNotifications.map((n) => n.id)])))
      }
      onDismiss={(id) => setNotifDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
      onDismissAll={() =>
        setNotifDismissedIds((prev) =>
          Array.from(new Set([...prev, ...allNotifications.map((n) => n.id)]))
        )
      }
      onRestoreDismissed={() => setNotifDismissedIds([])}
      onSelectNotification={handleSelectNotification}
      desktopEnabled={notifDesktopEnabled}
      onToggleDesktopAlerts={() => void handleToggleDesktopAlerts()}
      soundEnabled={notifSoundEnabled}
      onToggleSound={handleToggleSoundAlerts}
    />
  );

  if (viewMode === 'website') {
    return (
      <>
        <LandingPage
          lang={lang}
          onLanguageChange={handleLanguageChange}
          siteLang={siteLang}
          onSiteLanguageChange={handleSiteLanguageChange}
          isTranslatingSite={isTranslatingSite}
          notificationBell={renderNotificationBell('dark')}
          onEnterPortal={() => setViewMode('portal')}
          onOpenQuickFilter={() => {
            setViewMode('portal');
            if (canAccessTab('phone_filter')) setActiveTab('phone_filter');
          }}
        />
        {toastNotification && (
          <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-sky-500/40 bg-neutral-900/95 text-white p-3.5 shadow-2xl backdrop-blur-md flex items-start gap-3">
            <BellRing className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <button
              type="button"
              onClick={() => {
                setNotifReadIds((prev) =>
                  prev.includes(toastNotification.id) ? prev : [...prev, toastNotification.id]
                );
                handleSelectNotification(toastNotification);
                setToastNotification(null);
              }}
              className="text-left flex-1 min-w-0"
            >
              <div className="text-xs font-bold truncate">{toastNotification.title}</div>
              <div className="text-[11px] text-neutral-300 line-clamp-2 mt-0.5">
                {toastNotification.message}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="text-neutral-400 hover:text-white"
              aria-label="Dismiss notification toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </>
    );
  }

  const hasCustomLayoutSize = sidebarWidth !== 256 || moduleWidthPct !== 100 || moduleScale !== 100;
  const isViewerLockedFullScreen = currentUser.role === 'viewer';
  const hideWorkspaceChrome = isFullScreen || isViewerLockedFullScreen;

  return (
    <div className="h-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors">
      {!hideWorkspaceChrome && (
        <Header
          currentUser={currentUser}
          onLogout={handleLogout}
          lang={lang}
          onLanguageChange={handleLanguageChange}
          siteLang={siteLang}
          onSiteLanguageChange={handleSiteLanguageChange}
          isTranslatingSite={isTranslatingSite}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          botConfig={botConfig}
          googleSync={googleSync}
          onTriggerGoogleSync={handleTriggerGoogleSync}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((prev) => (prev === 'portal' ? 'website' : 'portal'))}
          onOpenQuickFilter={() => {
            if (canAccessTab('phone_filter')) setActiveTab('phone_filter');
          }}
          onOpenQuickCampaign={() => {
            if (canAccessTab('campaigns')) setActiveTab('campaigns');
          }}
          onNavigateToCrmInbox={() => {
            if (canAccessTab('live_chat')) setActiveTab('live_chat');
          }}
          firebaseUser={authReady ? firebaseUser : null}
          onGoogleSignIn={currentUser.role === 'admin' ? handleGoogleSignIn : undefined}
          onGoogleSignOut={currentUser.role === 'admin' ? handleGoogleSignOut : undefined}
          notificationBell={renderNotificationBell('header')}
        />
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {!hideWorkspaceChrome && (
          <>
            <Sidebar
              activeTab={effectiveTab}
              onSelectTab={(tab) => {
                if (canAccessTab(tab)) setActiveTab(tab);
              }}
              lang={lang}
              currentUser={currentUser}
              width={sidebarWidth}
              unreadChatCount={
                currentUser.role === 'moderator'
                  ? contacts.filter(
                      (c) =>
                        c.assignedModeratorId === currentUser.id &&
                        !c.isArchived &&
                        (chats[c.id] || []).some((m) => m.sender === 'contact' && m.status !== 'read')
                    ).length
                  : contacts.filter((c) => !c.assignedModeratorId).length
              }
              activeCampaignCount={campaigns.filter((c) => c.status === 'running').length}
              onLogout={handleLogout}
            />

            {/* Sidebar-to-Main Content Vertical Drag Handle */}
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startSidebarResize}
              onDoubleClick={() => setSidebarWidth(256)}
              title="Drag horizontally to resize sidebar & workspace width · Double-click to reset"
              className={`hidden md:flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center border-r border-neutral-200 dark:border-neutral-800 transition-colors group ${
                activeDragHandle === 'sidebar'
                  ? 'bg-sky-500/25'
                  : 'bg-neutral-100/70 dark:bg-neutral-900/60 hover:bg-sky-500/15'
              }`}
            >
              <GripVertical className="w-3 h-4 text-neutral-400 group-hover:text-sky-500 transition-colors" />
            </div>
          </>
        )}

        <main
          ref={mainContentRef}
          className={
            effectiveTab === 'live_chat'
              ? 'flex-1 min-h-0 overflow-hidden flex flex-col bg-neutral-50/60 dark:bg-neutral-950/60 relative'
              : 'flex-1 min-h-0 overflow-y-auto flex flex-col bg-neutral-50/60 dark:bg-neutral-950/60 relative'
          }
        >
          {/* Main Dashboard Workspace Controls: Hidden completely for Viewer locked full-screen chat mode */}
          {!isViewerLockedFullScreen && (
            <div className="shrink-0 px-4 py-1.5 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-sm flex flex-wrap items-center justify-between gap-2 text-xs z-20">
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                <span className="font-semibold text-neutral-800 dark:text-neutral-100 capitalize">
                  {effectiveTab.replace(/_/g, ' ')}
                </span>
                <span className="text-neutral-300 dark:text-neutral-700">|</span>
                <span className="text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                  Width: {moduleWidthPct}%
                </span>

                <div className="hidden sm:flex items-center gap-1 ml-1">
                  <span className="text-[11px] text-neutral-400">Scale:</span>
                  <button
                    type="button"
                    onClick={() => setModuleScale((s) => Math.max(80, s - 5))}
                    title="Decrease module scale"
                    className="px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-[11px] font-semibold"
                  >
                    -
                  </button>
                  <span className="text-[11px] font-mono tabular-nums min-w-[36px] text-center">
                    {moduleScale}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setModuleScale((s) => Math.min(120, s + 5))}
                    title="Increase module scale"
                    className="px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-[11px] font-semibold"
                  >
                    +
                  </button>
                </div>

                {hasCustomLayoutSize && (
                  <button
                    type="button"
                    onClick={resetWorkspaceDimensions}
                    title="Reset workspace width, scale, and sidebar"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsFullScreen((prev) => !prev)}
                aria-pressed={isFullScreen}
                title={
                  isFullScreen
                    ? 'Exit Full Screen Mode (Esc)'
                    : 'Enter Full Screen Mode (hide Sidebar & Header)'
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                  isFullScreen
                    ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-500 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Exit Full Screen (Esc)</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-sky-500" />
                    <span>Full Screen</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div
            className={
              effectiveTab === 'live_chat'
                ? 'flex-1 min-h-0 flex justify-center overflow-hidden relative'
                : 'flex-1 p-4 sm:p-6 lg:p-8 flex justify-center relative'
            }
          >
            <div
              style={{
                width: isViewerLockedFullScreen ? '100%' : `${moduleWidthPct}%`,
                zoom: isViewerLockedFullScreen ? 1 : moduleScale / 100,
              }}
              className={
                effectiveTab === 'live_chat'
                  ? 'h-full min-h-0 flex flex-col relative transition-[width] duration-75'
                  : `${moduleWidthPct === 100 ? 'max-w-7xl ' : ''}w-full relative transition-[width] duration-75`
              }
            >
              {/* Portal View Module Drag Resizer Handle (Right Edge) */}
              {!isViewerLockedFullScreen && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={startModuleResize}
                  onDoubleClick={() => setModuleWidthPct(100)}
                  title="Drag horizontally to resize portal module width · Double-click for 100%"
                  className={`hidden md:flex absolute top-0 bottom-0 right-0 w-3 cursor-ew-resize items-center justify-center z-30 group ${
                    activeDragHandle === 'module' ? 'opacity-100' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <div
                    className={`w-1.5 h-12 rounded-full border shadow-xs flex items-center justify-center transition-colors ${
                      activeDragHandle === 'module'
                        ? 'bg-sky-500 border-sky-400 text-white'
                        : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-400 group-hover:border-sky-500 group-hover:text-sky-500'
                    }`}
                  >
                    <GripVertical className="w-2.5 h-3.5" />
                  </div>
                  {activeDragHandle === 'module' && (
                    <div className="pointer-events-none absolute right-4 top-4 px-2 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow-md">
                      {moduleWidthPct}% width
                    </div>
                  )}
                </div>
              )}
            {effectiveTab === 'dashboard' && currentUser.role === 'admin' && (
              <DashboardOverview
                campaigns={campaigns}
                contacts={contacts}
                botConfig={botConfig}
                wpConfig={wpConfig}
                googleSync={googleSync}
                currentUser={currentUser}
                allUsers={allUsers}
                userbotSessions={userbotSessions}
                campaignBackups={campaignBackups}
                chats={chats}
                lang={lang}
                onNavigateToCampaigns={() => setActiveTab('campaigns')}
                onNavigateToPhoneFilter={() => setActiveTab('phone_filter')}
                onNavigateToContacts={() => setActiveTab('contacts')}
                onNavigateToWordPress={() => setActiveTab('wordpress')}
                onNavigateToMtproto={() => {
                  setApiHubSubTab('gateways');
                  setActiveTab('api_hub');
                }}
              />
            )}

            {effectiveTab === 'api_hub' && canAccessTab('api_hub') && (
              <ApiMessagingHubView
                activeSubTab={apiHubSubTab}
                onSelectSubTab={setApiHubSubTab}
                contacts={contacts}
                botConfig={botConfig}
                onUpdateBotConfig={(updates) => {
                  setBotConfig((prev) => {
                    const next = { ...prev, ...updates };
                    if (firebaseUidRef.current) {
                      void firestoreSync.saveWorkspaceSettingToFirestore(firebaseUidRef.current, 'botConfig', next);
                    }
                    return next;
                  });
                }}
                mtprotoConfig={mtprotoConfig}
                onUpdateMtprotoConfig={(updates) => {
                  setMtprotoConfig((prev) => {
                    const next = { ...prev, ...updates };
                    storageService.setMTProtoConfig(next);
                    if (firebaseUidRef.current) {
                      void firestoreSync.saveWorkspaceSettingToFirestore(firebaseUidRef.current, 'mtprotoConfig', next);
                    }
                    return next;
                  });
                }}
                userbotSessions={userbotSessions}
                onUpdateUserbotSessions={(nextSessions) => {
                  setUserbotSessions(nextSessions);
                  if (firebaseUidRef.current) {
                    const uid = firebaseUidRef.current;
                    for (const sess of nextSessions) {
                      void firestoreSync.saveUserbotSessionToFirestore(uid, sess);
                    }
                  }
                }}
                webhooks={webhooks}
                webhookLogs={webhookLogs}
                onCreateWebhook={handleCreateWebhook}
                onDeleteWebhook={handleDeleteWebhook}
                onDispatchTestWebhook={handleDispatchTestWebhook}
                currentUser={currentUser}
              />
            )}

            {effectiveTab === 'campaigns' && canAccessTab('campaigns') && (
              <CampaignManager
                campaigns={campaigns}
                contacts={contacts}
                cloudFiles={cloudFiles}
                userbotSessions={userbotSessions}
                audienceLists={audienceLists}
                campaignBackups={campaignBackups}
                currentUser={currentUser}
                lang={lang}
                onCreateCampaign={handleCreateCampaign}
                onUpdateCampaignStatus={handleUpdateCampaignStatus}
                onDeleteCampaign={handleDeleteCampaign}
                onTriggerFailover={handleTriggerFailover}
                onResumeFromBackup={handleResumeFromBackup}
                onNavigateToUserbots={
                  canAccessTab('api_hub')
                    ? () => {
                        setApiHubSubTab('gateways');
                        setActiveTab('api_hub');
                      }
                    : undefined
                }
              />
            )}

            {effectiveTab === 'phone_filter' && canAccessTab('phone_filter') && (
              <PhoneFilterView
                currentUser={currentUser}
                lang={lang}
                onAddContactsToCrm={handleBulkAddContacts}
                onOpenGoogleSync={handleTriggerGoogleSync}
              />
            )}

            {effectiveTab === 'contacts' && canAccessTab('contacts') && (
              <ContactManager
                contacts={contacts}
                chats={chats}
                currentUser={currentUser}
                allUsers={allUsers}
                googleSync={googleSync}
                lang={lang}
                audienceLists={audienceLists}
                onSaveAudienceList={(aud) => {
                  setAudienceLists((prev) => [aud, ...prev]);
                  if (firebaseUidRef.current) {
                    void firestoreSync.saveAudienceListToFirestore(firebaseUidRef.current, aud);
                  }
                }}
                onAddContact={handleAddContact}
                onUpdateContact={handleUpdateContact}
                onDeleteContact={handleDeleteContact}
                onBulkAddContacts={handleBulkAddContacts}
                onTriggerGoogleSync={handleTriggerGoogleSync}
                onSendMessage={handleSendMessage}
                onSimulateCustomerReply={handleSimulateInboundMessage}
                onNavigateToLiveChat={(contactId) => {
                  if (contactId) setSelectedChatContactId(contactId);
                  if (canAccessTab('live_chat')) setActiveTab('live_chat');
                }}
                onCreateCampaign={handleCreateCampaign}
                moderatorRouting={moderatorRouting}
                onAssignModerator={handleAssignModerator}
                onRouteContactsToModerator={handleRouteContactsToModerator}
                onDistributeRoundRobin={handleDistributeContactsRoundRobin}
              />
            )}

            {effectiveTab === 'live_chat' && canAccessTab('live_chat') && (
              <LiveChatView
                contacts={contacts}
                chats={chats}
                currentUser={currentUser}
                allUsers={allUsers}
                userbotSessions={userbotSessions}
                lang={lang}
                onSendMessage={handleSendMessage}
                onSimulateCustomerReply={handleSimulateInboundMessage}
                onAssignModerator={handleAssignModerator}
                moderatorRouting={moderatorRouting}
                onUpdateModeratorRouting={handleUpdateModeratorRouting}
                onRouteContactsToModerator={handleRouteContactsToModerator}
                onDistributeRoundRobin={handleDistributeContactsRoundRobin}
                onReactMessage={handleReactMessage}
                onTogglePinMessage={handleTogglePinMessage}
                onUpdateMessageStatus={handleUpdateMessageStatus}
                onMarkThreadRead={handleMarkThreadRead}
                onMarkIncomingRead={handleMarkIncomingRead}
                onMarkIncomingUnread={handleMarkIncomingUnread}
                onToggleArchiveThread={handleToggleArchiveThread}
                onArchiveInactiveThreads={handleArchiveInactiveThreads}
                selectedContactId={selectedChatContactId}
                onSelectContact={setSelectedChatContactId}
                onLogout={handleLogout}
              />
            )}

            {effectiveTab === 'wordpress' && canAccessTab('wordpress') && (
              <WordPressIntegration
                wpConfig={wpConfig}
                currentUser={currentUser}
                onUpdateWpConfig={(updates) => {
                  setWpConfig((prev) => {
                    const next = { ...prev, ...updates };
                    if (firebaseUidRef.current) {
                      void firestoreSync.saveWorkspaceSettingToFirestore(firebaseUidRef.current, 'wordpress', next);
                    }
                    return next;
                  });
                }}
                onTestConnection={handleTestWordPress}
                lang={lang}
              />
            )}

            {effectiveTab === 'cloud_storage' && canAccessTab('cloud_storage') && (
              <CloudStorageView
                cloudFiles={cloudFiles}
                currentUser={currentUser}
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
              />
            )}

            {effectiveTab === 'team_rbac' && canAccessTab('team_rbac') && (
              <RoleManagementView
                allUsers={allUsers}
                signupRequests={signupRequests}
                currentUser={currentUser}
                authorizedAdminEmail={authorizedAdminEmail || currentUser.email}
                adminPasswordConfigured={adminPasswordConfigured}
                contacts={contacts}
                moderatorRouting={moderatorRouting}
                onUpdateModeratorRouting={handleUpdateModeratorRouting}
                onRouteContactsToModerator={handleRouteContactsToModerator}
                onDistributeRoundRobin={handleDistributeContactsRoundRobin}
                onOpenModeratorInbox={(modId) => {
                  const firstAssigned = contacts.find((c) => c.assignedModeratorId === modId && !c.isArchived);
                  if (firstAssigned) setSelectedChatContactId(firstAssigned.id);
                  setActiveTab('live_chat');
                }}
                onCreateUser={handleCreateUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                onApproveSignup={handleApproveSignup}
                onRejectSignup={handleRejectSignup}
                onUpdateAdminCredentials={handleUpdateAdminCredentials}
                onResetAdminCredentials={handleResetAdminCredentials}
                onRefreshUsers={() => fetchAdminUsers()}
              />
            )}

            {effectiveTab === 'audit_logs' && canAccessTab('audit_logs') && <AuditLogsView logs={auditLogs} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
