import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import {
  ApiProviderType,
  MTProtoConfig,
  ProxyConfig,
  TelegramApiSlot,
  TelegramBotConfig,
  UserbotSession,
} from '../types';
import {
  MTProtoDiagnosticResult,
  normalizePhoneNumber,
  runMTProtoHealthDiagnostic,
  sendDirectSmsTest,
} from '../services/telegramService';

interface UnifiedApiSettingsViewProps {
  botConfig: TelegramBotConfig;
  onUpdateBotConfig: (updates: Partial<TelegramBotConfig>) => void;
  mtprotoConfig: MTProtoConfig;
  onUpdateMtprotoConfig: (updates: Partial<MTProtoConfig>) => void;
  userbotSessions: UserbotSession[];
  onUpdateUserbotSessions: (sessions: UserbotSession[]) => void;
  onDiagnosticCompleted?: (result: MTProtoDiagnosticResult) => void;
}

type SmsPreset =
  | 'bulksmsbd'
  | 'greenweb'
  | 'sms_twilio'
  | 'sms_custom_json'
  | 'sms_custom_get';
type PoolFilter = 'all' | 'sms' | 'mtproto' | 'bot_api' | 'custom_http';
type GatewayChannel = 'sms' | 'mtproto' | 'bot' | 'custom_http';

const isSmsType = (t: ApiProviderType) => t === 'sms_http' || t === 'sms_twilio';

export const UnifiedApiSettingsView: React.FC<UnifiedApiSettingsViewProps> = ({
  botConfig,
  onUpdateBotConfig,
  mtprotoConfig,
  onUpdateMtprotoConfig,
  userbotSessions,
  onUpdateUserbotSessions,
  onDiagnosticCompleted,
}) => {
  const [channelType, setChannelType] = useState<GatewayChannel>('mtproto');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; title: string; message: string } | null>(null);

  // Telegram Bot Token State
  const [botLabel, setBotLabel] = useState('Telegram Bot');
  const [botToken, setBotToken] = useState(botConfig.botToken || '');
  const [showBotToken, setShowBotToken] = useState(false);
  const [botLimit, setBotLimit] = useState(5000);
  const [verifyingBot, setVerifyingBot] = useState(false);

  // Telegram MTProto State
  const [ubLabel, setUbLabel] = useState('Primary Telegram Line');
  const [mtApiId, setMtApiId] = useState(mtprotoConfig.apiId || '');
  const [mtApiHash, setMtApiHash] = useState(mtprotoConfig.apiHash || '');
  const [hasServerApiHash, setHasServerApiHash] = useState(false);
  const [serverMaskedHash, setServerMaskedHash] = useState('');
  const [showMtHash, setShowMtHash] = useState(false);
  const [ubPhone, setUbPhone] = useState('');
  const [sessionInput, setSessionInput] = useState('');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyType, setProxyType] = useState<'socks5' | 'mtproto'>('socks5');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState(1080);
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [pendingSessionId, setPendingSessionId] = useState('');
  const [loginStep, setLoginStep] = useState<'idle' | 'code_sent'>('idle');
  const [phoneCode, setPhoneCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const password2FARef = useRef<HTMLInputElement>(null);
  const [submittingMtproto, setSubmittingMtproto] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [checkingSpamId, setCheckingSpamId] = useState<string | null>(null);
  const [editingProxySessionId, setEditingProxySessionId] = useState<string | null>(null);
  const [editProxyData, setEditProxyData] = useState<ProxyConfig>({
    enabled: false,
    type: 'socks5',
    host: '',
    port: 1080,
  });

  // Direct SMS Gateway State
  const [smsPreset, setSmsPreset] = useState<SmsPreset>('bulksmsbd');
  const [smsLabel, setSmsLabel] = useState('BulkSMSBD Direct Gateway');
  const [smsEndpointUrl, setSmsEndpointUrl] = useState(
    'http://bulksmsbd.net/api/smsapi?api_key={apikey}&type=text&number={to_digits}&senderid={senderid}&message={message}'
  );
  const [smsHttpMethod, setSmsHttpMethod] = useState<'GET' | 'POST'>('GET');
  const [smsPayloadMode, setSmsPayloadMode] = useState<'query_template' | 'json' | 'form'>(
    'query_template'
  );
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');
  const [smsAuthHeader, setSmsAuthHeader] = useState('');
  const [smsTwilioSid, setSmsTwilioSid] = useState('');
  const [smsTwilioToken, setSmsTwilioToken] = useState('');
  const [smsTwilioFrom, setSmsTwilioFrom] = useState('');
  const [smsDailyLimit, setSmsDailyLimit] = useState(50000);
  const [savingSms, setSavingSms] = useState(false);

  // Custom HTTP API State
  const [customLabel, setCustomLabel] = useState('Custom HTTP Messaging API');
  const [customUrl, setCustomUrl] = useState('');
  const [customAuth, setCustomAuth] = useState('');
  const [customLimit, setCustomLimit] = useState(25000);
  const [savingCustom, setSavingCustom] = useState(false);

  // Consolidated Gateways Pool & Live Test
  const [apiPool, setApiPool] = useState<TelegramApiSlot[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [poolFilter, setPoolFilter] = useState<PoolFilter>('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [savingBot, setSavingBot] = useState(false);
  const [testSlotId, setTestSlotId] = useState('');
  const [testTarget, setTestTarget] = useState('+8801711000001');
  const [testMessage, setTestMessage] = useState(
    'Hello! Live API & Gateway test message from TelePulse.'
  );
  const [sendingTest, setSendingTest] = useState(false);

  const fetchApiPool = async () => {
    setLoadingPool(true);
    try {
      const res = await fetch('/api/api-pool');
      if (res.ok) {
        const data = await res.json();
        const list: TelegramApiSlot[] = data.apis || [];
        setApiPool(list);
        if (!testSlotId && list.length > 0) {
          const active = list.find((s) => s.enabled && s.status === 'active') || list[0];
          setTestSlotId(active.id);
        }
      }
    } catch {
    } finally {
      setLoadingPool(false);
    }
  };

  const syncSessionsSilently = async () => {
    try {
      const res = await fetch('/api/api-pool/sync-from-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botConfig.botToken,
          botUsername: botConfig.botUsername,
        }),
      });
      const data = await res.json();
      if (res.ok && data.apis) {
        const list: TelegramApiSlot[] = data.apis;
        setApiPool(list);
        setTestSlotId((curr) => {
          if (curr && list.some((s) => s.id === curr)) return curr;
          const active = list.find((s) => s.enabled && s.status === 'active') || list[0];
          return active?.id || '';
        });
      }
    } catch {}
  };

  useEffect(() => {
    fetch('/api/mtproto/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((st) => {
        if (!st) return;
        if (st.apiId) setMtApiId((curr) => curr || String(st.apiId));
        if (st.phone) setUbPhone((curr) => curr || String(st.phone));
        if (st.hasServerApiHash) {
          setHasServerApiHash(true);
          setServerMaskedHash(st.apiHash || '••••••••');
        }
      })
      .catch(() => {});

    fetch('/api/userbots')
      .then((r) => (r.ok ? r.json() : null))
      .then((ubData) => {
        if (ubData?.userbots && Array.isArray(ubData.userbots)) {
          onUpdateUserbotSessions(ubData.userbots);
        }
      })
      .catch(() => {});

    fetchApiPool().then(syncSessionsSilently);
    const es = new EventSource('/api/events');
    const onPoolUpdate = (e: Event) => {
      try {
        const updated: TelegramApiSlot = JSON.parse((e as MessageEvent).data);
        setApiPool((prev) => {
          const exists = prev.some((s) => s.id === updated.id);
          return exists
            ? prev.map((s) => (s.id === updated.id ? updated : s))
            : [updated, ...prev];
        });
      } catch {}
    };
    const onPoolDelete = (e: Event) => {
      try {
        const deleted = JSON.parse((e as MessageEvent).data);
        if (deleted?.id) {
          setApiPool((prev) => {
            const next = prev.filter((s) => s.id !== deleted.id);
            setTestSlotId((curr) => (curr === deleted.id ? next[0]?.id || '' : curr));
            return next;
          });
        }
      } catch {}
    };
    es.addEventListener('api_pool:updated', onPoolUpdate);
    es.addEventListener('api_pool:deleted', onPoolDelete);
    return () => es.close();
  }, []);

  const counts = useMemo(
    () => ({
      sms: apiPool.filter((s) => isSmsType(s.type)).length,
      mtproto: apiPool.filter((s) => s.type === 'mtproto').length,
      bot_api: apiPool.filter((s) => s.type === 'bot_api').length,
      custom_http: apiPool.filter((s) => s.type === 'custom_http').length,
      active: apiPool.filter((s) => s.enabled && s.status === 'active').length,
    }),
    [apiPool]
  );

  const filteredPool = useMemo(() => {
    if (poolFilter === 'all') return apiPool;
    if (poolFilter === 'sms') return apiPool.filter((s) => isSmsType(s.type));
    return apiPool.filter((s) => s.type === poolFilter);
  }, [apiPool, poolFilter]);

  // Bot Handlers (Single unified Bot API flow)
  const handleVerifyBotToken = async () => {
    if (!botToken.trim()) return;
    setVerifyingBot(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/bot/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken.trim() }),
      });
      const data = await res.json();
      if (data.success && data.bot) {
        if (data.botUsername) {
          onUpdateBotConfig({ botToken: botToken.trim(), botUsername: data.botUsername });
          if (!botLabel || botLabel === 'Telegram Bot') setBotLabel(`@${data.botUsername}`);
        }
        setFeedback({
          ok: true,
          text: `Verified Bot: ${data.botName} (@${data.botUsername})`,
        });
      } else {
        setFeedback({ ok: false, text: data.error || 'Failed to verify Bot token.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setVerifyingBot(false);
    }
  };

  const handleSaveBotApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim()) return;
    setSavingBot(true);
    setFeedback(null);
    try {
      onUpdateBotConfig({ botToken: botToken.trim() });
      const res = await fetch('/api/api-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: botLabel.trim() || `Bot API #${counts.bot_api + 1}`,
          type: 'bot_api',
          botToken: botToken.trim(),
          dailyLimit: Number(botLimit) || 5000,
        }),
      });
      const data = await res.json();
      if (data.success && data.api) {
        setApiPool((prev) => [data.api, ...prev.filter((s) => s.id !== data.api.id)]);
        setTestSlotId(data.api.id);
        setFeedback({ ok: true, text: `Bot API "${data.api.label}" saved.` });
      } else {
        setFeedback({ ok: false, text: data.error || 'Failed to save Bot API.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSavingBot(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);

  // MTProto Handlers
  const handleTestConnection = async () => {
    const cleanId = mtApiId.trim();
    const cleanHash = mtApiHash.trim();
    const cleanPhone = ubPhone.trim();

    if (!cleanId || (!cleanHash && !hasServerApiHash)) {
      const msg = 'App API ID and App API Hash are required to test the Telegram connection.';
      setFeedback({ ok: false, text: msg });
      setToast({ ok: false, title: 'Connection Test Failed', message: msg });
      return;
    }

    setTestingConnection(true);
    setFeedback(null);
    try {
      const matchingExisting = userbotSessions.find(
        (u) => cleanPhone && u.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, '')
      );
      const result = await runMTProtoHealthDiagnostic({
        apiId: cleanId,
        ...(cleanHash ? { apiHash: cleanHash } : {}),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(matchingExisting?.id ? { sessionId: matchingExisting.id } : {}),
        source: 'test_connection',
      });
      onDiagnosticCompleted?.(result);

      const isFullSuccess = result.ok && result.sessionAuthorized;
      const dcText = result.dcId ? `DC ${result.dcId}${result.country ? ` (${result.country})` : ''}` : 'Telegram DC';

      if (isFullSuccess) {
        const msg = `Connected & Authorized on ${dcText} · Ping ${result.latencyMs}ms`;
        setFeedback({ ok: true, text: msg });
        setToast({ ok: true, title: 'Connection Successful', message: msg });
      } else if (result.dcReachable && result.pingOk && result.errorCategory === 'otp_required') {
        const msg = `${dcText} Ping OK (${result.latencyMs}ms), but user session is not authorized (401) — complete Phone OTP login.`;
        setFeedback({ ok: false, text: msg });
        setToast({ ok: false, title: 'Authorization Pending (401)', message: msg });
      } else {
        const msg = result.errorMessage || result.statusLabel || 'MTProto connection test failed.';
        setFeedback({ ok: false, text: msg });
        setToast({
          ok: false,
          title: `Connection Failed (${result.statusCode})`,
          message: msg,
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Unexpected error while testing Telegram connection.';
      setFeedback({ ok: false, text: msg });
      setToast({ ok: false, title: 'Connection Test Failed', message: msg });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanId = mtApiId.trim();
    const cleanHash = mtApiHash.trim();
    const cleanPhone = ubPhone.trim();

    if (!cleanId || (!cleanHash && !hasServerApiHash) || !cleanPhone) {
      setFeedback({
        ok: false,
        text: 'Phone number, App API ID, and App API Hash are required.',
      });
      return;
    }

    onUpdateMtprotoConfig({
      apiId: cleanId,
      ...(cleanHash ? { apiHash: cleanHash } : {}),
    });
    setSubmittingMtproto(true);
    setRequires2FA(false);
    setFeedback(null);
    try {
      const matchingExisting = userbotSessions.find(
        (u) => u.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, '')
      );
      const res = await fetch('/api/userbots/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: matchingExisting?.id,
          label: ubLabel.trim() || matchingExisting?.label || `Userbot (${cleanPhone})`,
          apiId: cleanId,
          ...(cleanHash ? { apiHash: cleanHash } : {}),
          phone: cleanPhone,
          proxy: {
            enabled: proxyEnabled,
            type: proxyType,
            host: proxyHost.trim(),
            port: Number(proxyPort) || 1080,
            username: proxyUsername.trim() || undefined,
            password: proxyPassword.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingSessionId(data.sessionId);
        setLoginStep('code_sent');
        setFeedback({ ok: true, text: data.message });
      } else {
        setFeedback({ ok: false, text: data.error || 'Failed to request Telegram OTP.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSubmittingMtproto(false);
    }
  };

  const handleVerifyOtpSignIn = async () => {
    if ((!phoneCode.trim() && !requires2FA) || !pendingSessionId) return;
    setSubmittingMtproto(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/userbots/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: pendingSessionId,
          phoneCode: phoneCode.trim(),
          password: password2FA.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.userbot) {
        onUpdateUserbotSessions([
          data.userbot,
          ...userbotSessions.filter((u) => u.id !== data.userbot.id),
        ]);
        setLoginStep('idle');
        setRequires2FA(false);
        setPhoneCode('');
        setPassword2FA('');
        await syncSessionsSilently();
        if (data.api?.id) {
          setTestSlotId(data.api.id);
        }
        setFeedback({
          ok: true,
          text: `Telegram Phone ${data.userbot.phone} verified & active for bulk dispatch.`,
        });
      } else {
        if (data.requires2FA) {
          setRequires2FA(true);
          setTimeout(() => password2FARef.current?.focus(), 50);
        }
        setFeedback({ ok: false, text: data.error || 'OTP sign-in failed.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSubmittingMtproto(false);
    }
  };

  const handleConnectStringSession = async () => {
    if (!sessionInput.trim()) return;
    const cleanId = mtApiId.trim();
    const cleanHash = mtApiHash.trim();
    if (!cleanId || (!cleanHash && !hasServerApiHash)) {
      setFeedback({
        ok: false,
        text: 'App API ID and App API Hash are required to connect a StringSession.',
      });
      return;
    }
    onUpdateMtprotoConfig({
      apiId: cleanId,
      ...(cleanHash ? { apiHash: cleanHash } : {}),
    });
    setSubmittingMtproto(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/userbots/connect-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: ubLabel.trim() || 'Imported StringSession',
          apiId: cleanId,
          ...(cleanHash ? { apiHash: cleanHash } : {}),
          sessionString: sessionInput.trim(),
          phone: ubPhone.trim(),
          proxy: {
            enabled: proxyEnabled,
            type: proxyType,
            host: proxyHost.trim(),
            port: Number(proxyPort) || 1080,
            username: proxyUsername.trim() || undefined,
            password: proxyPassword.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.userbot) {
        onUpdateUserbotSessions([
          data.userbot,
          ...userbotSessions.filter((u) => u.id !== data.userbot.id),
        ]);
        setSessionInput('');
        await syncSessionsSilently();
        if (data.api?.id) {
          setTestSlotId(data.api.id);
        }
        setFeedback({ ok: true, text: 'StringSession connected to gateway pool.' });
      } else {
        setFeedback({ ok: false, text: data.error || 'Failed to connect StringSession.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSubmittingMtproto(false);
    }
  };

  const handleCheckSpambot = async (sessionId: string) => {
    setCheckingSpamId(sessionId);
    try {
      const res = await fetch(`/api/userbots/${sessionId}/spambot-check`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.userbot) {
        onUpdateUserbotSessions(
          userbotSessions.map((u) => (u.id === sessionId ? data.userbot : u))
        );
        setFeedback({
          ok: data.userbot.spambotStatus === 'clean',
          text: `@SpamBot (${data.userbot.phone}): ${data.userbot.spambotMessage}`,
        });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setCheckingSpamId(null);
    }
  };

  const handleSaveSessionProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProxySessionId) return;
    try {
      const res = await fetch(`/api/userbots/${editingProxySessionId}/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProxyData),
      });
      const data = await res.json();
      if (data.success && data.userbot) {
        onUpdateUserbotSessions(
          userbotSessions.map((u) => (u.id === editingProxySessionId ? data.userbot : u))
        );
        setEditingProxySessionId(null);
        setFeedback({ ok: true, text: `Proxy updated for ${data.userbot.phone}.` });
      }
    } catch {}
  };

  const handleDeleteUserbotSession = async (sessionId: string) => {
    try {
      await fetch(`/api/userbots/${sessionId}`, { method: 'DELETE' });
    } catch {}
    onUpdateUserbotSessions(userbotSessions.filter((u) => u.id !== sessionId));
    await fetchApiPool();
  };

  // SMS Gateway Presets & Save
  const selectSmsPreset = (preset: SmsPreset) => {
    setSmsPreset(preset);
    if (preset === 'bulksmsbd') {
      setSmsLabel('BulkSMSBD Gateway');
      setSmsHttpMethod('GET');
      setSmsPayloadMode('query_template');
      setSmsEndpointUrl(
        'http://bulksmsbd.net/api/smsapi?api_key={apikey}&type=text&number={to_digits}&senderid={senderid}&message={message}'
      );
    } else if (preset === 'greenweb') {
      setSmsLabel('GreenWeb BD SMS');
      setSmsHttpMethod('GET');
      setSmsPayloadMode('query_template');
      setSmsEndpointUrl(
        'http://api.greenweb.com.bd/api.php?token={apikey}&to={to_local}&message={message}'
      );
    } else if (preset === 'sms_twilio') {
      setSmsLabel('Twilio International SMS');
    } else if (preset === 'sms_custom_json') {
      setSmsLabel('Custom REST JSON SMS API');
      setSmsHttpMethod('POST');
      setSmsPayloadMode('json');
      setSmsEndpointUrl('https://api.example.com/v1/sms/send');
    } else {
      setSmsLabel('Custom HTTP GET SMS API');
      setSmsHttpMethod('GET');
      setSmsPayloadMode('query_template');
      setSmsEndpointUrl(
        'https://api.example.com/send?api_key={apikey}&sender={senderid}&to={to}&message={message}'
      );
    }
  };

  const handleSaveSmsGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSms(true);
    setFeedback(null);
    try {
      const payload =
        smsPreset === 'sms_twilio'
          ? {
              label: smsLabel.trim() || `Twilio SMS (${smsTwilioFrom.trim()})`,
              type: 'sms_twilio',
              twilioSid: smsTwilioSid.trim(),
              twilioAuthToken: smsTwilioToken.trim(),
              twilioFrom: smsTwilioFrom.trim(),
              dailyLimit: Number(smsDailyLimit) || 50000,
            }
          : {
              label: smsLabel.trim() || 'HTTP SMS Gateway',
              type: 'sms_http',
              endpointUrl: smsEndpointUrl.trim(),
              httpMethod: smsHttpMethod,
              smsPayloadMode: smsPayloadMode,
              smsApiKey: smsApiKey.trim() || undefined,
              smsSenderId: smsSenderId.trim() || undefined,
              authHeader: smsAuthHeader.trim() || undefined,
              dailyLimit: Number(smsDailyLimit) || 50000,
            };

      const res = await fetch('/api/api-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.api) {
        setApiPool((prev) => [data.api, ...prev.filter((s) => s.id !== data.api.id)]);
        setTestSlotId(data.api.id);
        setFeedback({ ok: true, text: `SMS Gateway "${data.api.label}" saved.` });
      } else {
        setFeedback({ ok: false, text: data.error || 'Failed to save SMS gateway.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSavingSms(false);
    }
  };

  // Custom HTTP API Save
  const handleSaveCustomHttp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    setSavingCustom(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/api-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: customLabel.trim() || 'Custom HTTP API',
          type: 'custom_http',
          endpointUrl: customUrl.trim(),
          authHeader: customAuth.trim() || undefined,
          dailyLimit: Number(customLimit) || 25000,
        }),
      });
      const data = await res.json();
      if (data.success && data.api) {
        setApiPool((prev) => [data.api, ...prev.filter((s) => s.id !== data.api.id)]);
        setCustomUrl('');
        setCustomAuth('');
        setTestSlotId(data.api.id);
        setFeedback({ ok: true, text: `Custom HTTP API "${data.api.label}" added.` });
      } else {
        setFeedback({ ok: false, text: data.error || 'Failed to save Custom HTTP API.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSavingCustom(false);
    }
  };

  // Pool Actions
  const handleVerifyPoolSlot = async (id: string) => {
    setVerifyingId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/api-pool/${id}/verify`, { method: 'POST' });
      const data = await res.json();
      if (data.api) setApiPool((prev) => prev.map((s) => (s.id === id ? data.api : s)));
      setFeedback({
        ok: Boolean(data.success),
        text: data.message || data.error || 'Verification completed.',
      });
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleTogglePoolSlot = async (slot: TelegramApiSlot, resetErrors = false) => {
    try {
      const res = await fetch(`/api/api-pool/${slot.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: resetErrors ? true : !slot.enabled,
          resetErrors,
        }),
      });
      const data = await res.json();
      if (data.api) setApiPool((prev) => prev.map((s) => (s.id === slot.id ? data.api : s)));
    } catch {}
  };

  const handleDeletePoolSlot = async (id: string) => {
    try {
      await fetch(`/api/api-pool/${id}`, { method: 'DELETE' });
      setApiPool((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (testSlotId === id) {
          setTestSlotId(next[0]?.id || '');
        }
        return next;
      });
    } catch {}
  };

  const handleSendUnifiedTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const slot = apiPool.find((s) => s.id === testSlotId);
    if (!slot) {
      setFeedback({ ok: false, text: 'Select any API or Gateway slot to test.' });
      return;
    }
    setSendingTest(true);
    setFeedback(null);
    let targetToSend = testTarget.trim();
    if (!targetToSend.startsWith('@') && isSmsType(slot.type)) {
      const norm = normalizePhoneNumber(targetToSend);
      if (!norm.isValid) {
        setSendingTest(false);
        setFeedback({
          ok: false,
          text: `Invalid phone format "${testTarget}". Use international format e.g. +8801711000001 or +971501234567.`,
        });
        return;
      }
      targetToSend = norm.formatted;
    }
    const res = await sendDirectSmsTest({
      slotId: slot.id,
      to: targetToSend,
      message: testMessage,
    });
    setSendingTest(false);
    setFeedback({
      ok: res.success,
      text: res.success
        ? res.detail || `Test delivered via ${slot.label}`
        : res.error || 'Test dispatch failed.',
    });
  };

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-sky-500" />
          <span>All Gateways &amp; APIs</span>
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
          <span>
            Active Pool:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {counts.active} / {apiPool.length}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>Telegram Phone: {counts.mtproto}</span>
          <span aria-hidden="true">·</span>
          <span>Bot API: {counts.bot_api}</span>
          <span aria-hidden="true">·</span>
          <span>Direct SMS: {counts.sms}</span>
          <span aria-hidden="true">·</span>
          <span>Custom HTTP: {counts.custom_http}</span>
        </div>
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

      {/* Single Add Gateway / API Form with Channel Select */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              Add New Gateway / API
            </h2>
            <p className="text-xs text-neutral-500">
              Choose a channel type below to connect Telegram Phone (MTProto), Telegram Bot API, Direct SMS, or Custom HTTP.
            </p>
          </div>
          <div className="sm:w-64">
            <select
              value={channelType}
              onChange={(e) => setChannelType(e.target.value as GatewayChannel)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white"
            >
              <option value="mtproto">Telegram Phone (MTProto OTP / Session)</option>
              <option value="bot">Telegram Bot API (@BotFather)</option>
              <option value="sms">Direct Phone SMS Gateway</option>
              <option value="custom_http">Custom HTTP API</option>
            </select>
          </div>
        </div>

        {/* Direct SMS Form */}
        {channelType === 'sms' && (
          <form onSubmit={handleSaveSmsGateway} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  SMS Provider Preset
                </label>
                <select
                  value={smsPreset}
                  onChange={(e) => selectSmsPreset(e.target.value as SmsPreset)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                >
                  <option value="bulksmsbd">BulkSMSBD</option>
                  <option value="greenweb">GreenWeb BD</option>
                  <option value="sms_twilio">Twilio International SMS</option>
                  <option value="sms_custom_json">Custom JSON POST</option>
                  <option value="sms_custom_get">Custom HTTP GET</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Gateway Label
                </label>
                <input
                  type="text"
                  required
                  value={smsLabel}
                  onChange={(e) => setSmsLabel(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Daily Quota Limit
                </label>
                <input
                  type="number"
                  min={1}
                  value={smsDailyLimit}
                  onChange={(e) => setSmsDailyLimit(Number(e.target.value))}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {smsPreset === 'sms_twilio' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Twilio Account SID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={smsTwilioSid}
                      onChange={(e) => setSmsTwilioSid(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Twilio Auth Token
                    </label>
                    <input
                      type="password"
                      required
                      value={smsTwilioToken}
                      onChange={(e) => setSmsTwilioToken(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Twilio SMS From Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+14155550100"
                      value={smsTwilioFrom}
                      onChange={(e) => setSmsTwilioFrom(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      SMS API Endpoint URL
                    </label>
                    <input
                      type="url"
                      required
                      value={smsEndpointUrl}
                      onChange={(e) => setSmsEndpointUrl(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      API Key / Token
                    </label>
                    <input
                      type="text"
                      placeholder="SMS provider API key"
                      value={smsApiKey}
                      onChange={(e) => setSmsApiKey(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Sender ID / Masking
                    </label>
                    <input
                      type="text"
                      placeholder="8809617612345 or BrandName"
                      value={smsSenderId}
                      onChange={(e) => setSmsSenderId(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Method &amp; Format
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={smsHttpMethod}
                        onChange={(e) => setSmsHttpMethod(e.target.value as 'GET' | 'POST')}
                        className="text-xs px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                      <select
                        value={smsPayloadMode}
                        onChange={(e) => setSmsPayloadMode(e.target.value as any)}
                        className="flex-1 text-xs px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                      >
                        <option value="query_template">URL Query Tokens</option>
                        <option value="json">JSON Body</option>
                        <option value="form">Form URL-Encoded</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Authorization Header (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Bearer sk_live_..."
                      value={smsAuthHeader}
                      onChange={(e) => setSmsAuthHeader(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSms}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingSms ? 'Saving...' : 'Save SMS Gateway'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Telegram Phone (MTProto) */}
        {channelType === 'mtproto' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* OTP Login */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 space-y-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-sky-500" />
                  <span>Connect via Phone OTP</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Account Label
                    </label>
                    <input
                      type="text"
                      value={ubLabel}
                      onChange={(e) => setUbLabel(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      App API ID
                    </label>
                    <input
                      type="text"
                      value={mtApiId}
                      onChange={(e) => setMtApiId(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      App API Hash
                    </label>
                    <div className="relative">
                      <input
                        type={showMtHash ? 'text' : 'password'}
                        value={mtApiHash}
                        onChange={(e) => setMtApiHash(e.target.value)}
                        placeholder={
                          hasServerApiHash
                            ? `Configured on server (${serverMaskedHash || '••••••••'})`
                            : '32-character hex API hash'
                        }
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMtHash((v) => !v)}
                        className="absolute right-2.5 top-2 text-neutral-400"
                      >
                        {showMtHash ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    {hasServerApiHash && !mtApiHash.trim() && (
                      <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                        Server API Hash active ({serverMaskedHash}) — ready for OTP or override above.
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Telegram Phone Number (E.164)
                    </label>
                    <input
                      type="text"
                      placeholder="+88017XXXXXXXX"
                      value={ubPhone}
                      onChange={(e) => setUbPhone(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
                  <label className="flex items-center justify-between text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer">
                    <span>Use SOCKS5 / MTProto Proxy (Optional)</span>
                    <input
                      type="checkbox"
                      checked={proxyEnabled}
                      onChange={(e) => setProxyEnabled(e.target.checked)}
                      className="accent-sky-600"
                    />
                  </label>
                  {proxyEnabled && (
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={proxyType}
                        onChange={(e) => setProxyType(e.target.value as any)}
                        className="text-xs px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                      >
                        <option value="socks5">SOCKS5</option>
                        <option value="mtproto">MTProto</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Host IP"
                        value={proxyHost}
                        onChange={(e) => setProxyHost(e.target.value)}
                        className="text-xs font-mono px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                      />
                      <input
                        type="number"
                        placeholder="Port"
                        value={proxyPort}
                        onChange={(e) => setProxyPort(Number(e.target.value))}
                        className="text-xs font-mono px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                      />
                      <input
                        type="text"
                        placeholder="Username"
                        value={proxyUsername}
                        onChange={(e) => setProxyUsername(e.target.value)}
                        className="text-xs font-mono px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={proxyPassword}
                        onChange={(e) => setProxyPassword(e.target.value)}
                        className="col-span-2 text-xs font-mono px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                      />
                    </div>
                  )}
                </div>

                {loginStep === 'idle' ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={submittingMtproto || testingConnection}
                      className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
                    >
                      {submittingMtproto ? 'Requesting OTP...' : 'Request Telegram OTP'}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConnection || submittingMtproto}
                      className="flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                      <Wifi className={`w-3.5 h-3.5 text-sky-500 ${testingConnection ? 'animate-pulse' : ''}`} />
                      <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    {requires2FA && (
                      <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        2FA Cloud Password required for this account — enter it on the right and submit.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="OTP Code"
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        className="text-xs font-mono px-3 py-2 rounded-lg border border-sky-500 bg-white dark:bg-neutral-900"
                      />
                      <input
                        ref={password2FARef}
                        type="password"
                        placeholder="2FA Password (if any)"
                        value={password2FA}
                        onChange={(e) => setPassword2FA(e.target.value)}
                        className={`text-xs font-mono px-3 py-2 rounded-lg border bg-white dark:bg-neutral-900 ${
                          requires2FA
                            ? 'border-amber-500 ring-1 ring-amber-500/40'
                            : 'border-neutral-200 dark:border-neutral-700'
                        }`}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleVerifyOtpSignIn}
                        disabled={submittingMtproto || (!phoneCode.trim() && !requires2FA)}
                        className="flex-1 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                      >
                        {submittingMtproto ? 'Verifying...' : 'Verify OTP & Connect'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginStep('idle');
                          setRequires2FA(false);
                        }}
                        className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* StringSession Import */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <span>Or Import StringSession</span>
                  </h3>
                  <textarea
                    rows={7}
                    value={sessionInput}
                    onChange={(e) => setSessionInput(e.target.value)}
                    placeholder="1BVtsOKgBu..."
                    className="w-full text-xs font-mono p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleConnectStringSession}
                  disabled={submittingMtproto || !sessionInput.trim()}
                  className="w-full py-2 text-xs font-semibold rounded-lg bg-neutral-900 dark:bg-sky-600 hover:bg-neutral-800 dark:hover:bg-sky-500 text-white disabled:opacity-40"
                >
                  Connect StringSession
                </button>
              </div>
            </div>

            {userbotSessions.length > 0 && (
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
                {userbotSessions.map((ub) => (
                  <div
                    key={ub.id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {ub.label}
                        </span>
                        <span className="font-mono text-neutral-500">{ub.phone}</span>
                        <span
                          className={`text-[11px] font-medium ${
                            ub.healthStatus === 'active'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {ub.healthStatus === 'active' ? 'Active' : ub.healthStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-2">
                        <Server className="w-3 h-3 text-sky-500" />
                        <span>
                          {ub.proxy?.enabled && ub.proxy.host
                            ? `${ub.proxy.type.toUpperCase()} ${ub.proxy.host}:${ub.proxy.port}`
                            : 'Direct Connection'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCheckSpambot(ub.id)}
                        disabled={checkingSpamId === ub.id}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{checkingSpamId === ub.id ? 'Checking...' : '@SpamBot'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProxySessionId(ub.id);
                          setEditProxyData(
                            ub.proxy || { enabled: false, type: 'socks5', host: '', port: 1080 }
                          );
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        <Lock className="w-3 h-3 text-sky-500" />
                        <span>Proxy</span>
                      </button>
                      {userbotSessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUserbotSession(ub.id)}
                          className="p-1 text-neutral-400 hover:text-rose-500"
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Telegram Bot API (Single Simplified Form) */}
        {channelType === 'bot' && (
          <form onSubmit={handleSaveBotApi} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Bot Label
                </label>
                <input
                  type="text"
                  required
                  value={botLabel}
                  onChange={(e) => setBotLabel(e.target.value)}
                  placeholder="Sales Bot"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Telegram Bot Token (@BotFather)
                </label>
                <div className="relative">
                  <input
                    type={showBotToken ? 'text' : 'password'}
                    required
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="7391029481:AAFj90_..."
                    className="w-full text-xs font-mono pr-9 pl-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBotToken((v) => !v)}
                    className="absolute right-3 top-2.5 text-neutral-400"
                  >
                    {showBotToken ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Daily Limit:</span>
                <input
                  type="number"
                  min={1}
                  value={botLimit}
                  onChange={(e) => setBotLimit(Number(e.target.value))}
                  className="w-24 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleVerifyBotToken}
                  disabled={verifyingBot || !botToken.trim()}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                  {verifyingBot ? 'Verifying...' : 'Verify Token'}
                </button>
                <button
                  type="submit"
                  disabled={savingBot || !botToken.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{savingBot ? 'Saving...' : 'Save Bot API'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Custom HTTP API */}
        {channelType === 'custom_http' && (
          <form onSubmit={handleSaveCustomHttp} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  API Label
                </label>
                <input
                  type="text"
                  required
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Daily Quota Limit
                </label>
                <input
                  type="number"
                  min={1}
                  value={customLimit}
                  onChange={(e) => setCustomLimit(Number(e.target.value))}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  REST Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.example.com/send"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Auth Header (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Bearer sk_live_..."
                  value={customAuth}
                  onChange={(e) => setCustomAuth(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingCustom}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingCustom ? 'Saving...' : 'Add Custom HTTP API'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Connected Gateways Table + Single Live Test */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                Connected Gateways &amp; APIs ({filteredPool.length})
              </h2>
              <p className="text-xs text-neutral-500">
                Verify, pause/resume, or delete any configured channel gateway.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={poolFilter}
                onChange={(e) => setPoolFilter(e.target.value as PoolFilter)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              >
                <option value="all">All Channels</option>
                <option value="mtproto">Telegram MTProto</option>
                <option value="bot_api">Telegram Bot API</option>
                <option value="sms">Direct SMS</option>
                <option value="custom_http">Custom HTTP</option>
              </select>
              <button
                type="button"
                onClick={fetchApiPool}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPool ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="text-[11px] text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="py-2 pr-2 font-medium">Gateway</th>
                  <th className="py-2 px-2 font-medium">Credentials / Endpoint</th>
                  <th className="py-2 px-2 font-medium">Sent</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 pl-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {filteredPool.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-neutral-400">
                      No gateways added in this category yet.
                    </td>
                  </tr>
                ) : (
                  filteredPool.map((slot) => (
                    <tr
                      key={slot.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40"
                    >
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {slot.label}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {slot.type === 'sms_twilio'
                            ? 'Twilio SMS'
                            : slot.type === 'sms_http'
                            ? 'HTTP SMS'
                            : slot.type === 'mtproto'
                            ? 'Telegram MTProto'
                            : slot.type === 'bot_api'
                            ? 'Telegram Bot API'
                            : 'Custom HTTP'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[11px] text-neutral-600 dark:text-neutral-300 max-w-[230px] truncate">
                        {slot.type === 'bot_api'
                          ? slot.botUsername
                            ? `@${slot.botUsername}`
                            : slot.botToken || '—'
                          : slot.type === 'mtproto'
                          ? `${slot.phone || '—'} (API ${slot.apiId || '—'})`
                          : slot.type === 'sms_twilio'
                          ? `From ${slot.twilioFrom || '—'}`
                          : slot.endpointUrl || '—'}
                      </td>
                      <td className="py-2.5 px-2 text-neutral-700 dark:text-neutral-300">
                        {slot.sentCount.toLocaleString()} / {slot.dailyLimit.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2">
                        <div
                          className={`text-[11px] font-medium ${
                            slot.status === 'active'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : slot.status === 'rate_limited'
                              ? 'text-amber-600 dark:text-amber-400'
                              : slot.status === 'error'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {slot.status === 'active'
                            ? 'Active'
                            : slot.type === 'mtproto' && slot.status === 'disabled'
                            ? 'OTP Needed'
                            : slot.status}
                        </div>
                        {slot.lastError && slot.status !== 'active' && (
                          <div
                            title={slot.lastError}
                            className="text-[10px] text-neutral-500 dark:text-neutral-400 max-w-[180px] truncate"
                          >
                            {slot.lastError}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleVerifyPoolSlot(slot.id)}
                            disabled={verifyingId === slot.id}
                            className="px-2 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            {verifyingId === slot.id ? '...' : 'Verify'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleTogglePoolSlot(
                                slot,
                                slot.status === 'error' || slot.status === 'rate_limited'
                              )
                            }
                            title={slot.enabled ? 'Pause' : 'Enable'}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            {slot.enabled ? (
                              <Pause className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Play className="w-3 h-3 text-emerald-500" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePoolSlot(slot.id)}
                            className="p-1 text-neutral-400 hover:text-rose-500"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Test Box */}
        <form
          onSubmit={handleSendUnifiedTest}
          className="lg:col-span-4 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3"
        >
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-500" />
            <span>Live Gateway Test</span>
          </h2>
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">
              Gateway / API Slot
            </label>
            <select
              value={testSlotId}
              onChange={(e) => setTestSlotId(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
            >
              <option value="">-- Select Gateway --</option>
              {apiPool.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.type}] {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">
              Target Phone (+country), Chat ID, or @username
            </label>
            <input
              type="text"
              required
              value={testTarget}
              onChange={(e) => setTestTarget(e.target.value)}
              placeholder="+8801711000001 or @username"
              className="w-full text-xs font-mono px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">
              Test Message
            </label>
            <textarea
              rows={3}
              required
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
            />
          </div>
          <button
            type="submit"
            disabled={sendingTest || !testSlotId}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sendingTest ? 'Dispatching...' : 'Send Live Test'}</span>
          </button>
        </form>
      </div>

      {/* Inline Proxy Modal */}
      {editingProxySessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveSessionProxy}
            className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Configure Telegram Phone Proxy
            </h3>
            <label className="flex items-center justify-between text-xs font-medium">
              <span>Enable Dedicated Proxy</span>
              <input
                type="checkbox"
                checked={editProxyData.enabled}
                onChange={(e) => setEditProxyData({ ...editProxyData, enabled: e.target.checked })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={editProxyData.type}
                onChange={(e) => setEditProxyData({ ...editProxyData, type: e.target.value as any })}
                className="text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              >
                <option value="socks5">SOCKS5</option>
                <option value="mtproto">MTProto Proxy</option>
              </select>
              <input
                type="number"
                placeholder="Port"
                value={editProxyData.port}
                onChange={(e) =>
                  setEditProxyData({ ...editProxyData, port: Number(e.target.value) })
                }
                className="text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <input
              type="text"
              placeholder="Proxy Host IP"
              value={editProxyData.host}
              onChange={(e) => setEditProxyData({ ...editProxyData, host: e.target.value })}
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Username"
                value={editProxyData.username || ''}
                onChange={(e) => setEditProxyData({ ...editProxyData, username: e.target.value })}
                className="text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              />
              <input
                type="password"
                placeholder="Password"
                value={editProxyData.password || ''}
                onChange={(e) => setEditProxyData({ ...editProxyData, password: e.target.value })}
                className="text-xs font-mono px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProxySessionId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-500"
              >
                Save Proxy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Toast Notification for Connection Test Outcome */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm w-full p-4 rounded-xl border shadow-xl backdrop-blur-md flex items-start gap-3 transition-all ${
            toast.ok
              ? 'bg-emerald-950/95 border-emerald-700 text-emerald-100'
              : 'bg-rose-950/95 border-rose-700 text-rose-100'
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="text-xs font-bold">{toast.title}</div>
            <div className="text-[11px] opacity-90 break-words">{toast.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-neutral-300 hover:text-white shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
