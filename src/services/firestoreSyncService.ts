import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AudienceList,
  AuditLog,
  AutoResponseRule,
  Campaign,
  CampaignBackupSnapshot,
  ChatMessage,
  CloudFile,
  Contact,
  GoogleContactsSync,
  ModeratorRoutingConfig,
  MTProtoConfig,
  TelegramBotConfig,
  UserbotSession,
  WebhookEndpoint,
  WebhookLog,
  WordPressConfig,
} from '../types';

function sanitizeId(raw: string, fallback = 'item'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || `${fallback}_${Date.now()}`;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val : val == null ? fallback : String(val);
  return s.slice(0, maxLen);
}

function nonEmptyStr(val: unknown, maxLen: number, fallback: string): string {
  const s = clampStr(val, maxLen).trim();
  return s.length > 0 ? s : fallback.slice(0, maxLen);
}

function clampStrArray(arr: unknown, maxItems: number, maxItemLen = 128): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .slice(0, maxItems)
    .map((v) => v.slice(0, maxItemLen));
}

function clampStringMap(obj: unknown, maxEntries: number, maxValLen = 256): Record<string, string> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj).slice(0, maxEntries)) {
    const cleanKey = clampStr(k, 64).trim();
    if (cleanKey) out[cleanKey] = clampStr(v, maxValLen);
  }
  return out;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function buildContactPayload(uid: string, c: Contact) {
  const id = sanitizeId(c.id, 'contact');
  return stripUndefined({
    id,
    ownerId: uid,
    name: nonEmptyStr(c.name, 160, 'Unnamed Lead'),
    phoneNumber: nonEmptyStr(c.phoneNumber, 40, '+0000000000'),
    telegramUsername: c.telegramUsername ? clampStr(c.telegramUsername, 80) : undefined,
    telegramUid: c.telegramUid ? clampStr(c.telegramUid, 80) : undefined,
    hasTelegram: Boolean(c.hasTelegram),
    telegramStatus: (['active', 'inactive', 'unknown'].includes(c.telegramStatus)
      ? c.telegramStatus
      : 'unknown') as Contact['telegramStatus'],
    lastSeen: c.lastSeen ? clampStr(c.lastSeen, 100) : undefined,
    company: c.company ? clampStr(c.company, 160) : undefined,
    email: c.email ? clampStr(c.email, 254) : undefined,
    stage: (['lead', 'qualified', 'contacted', 'opportunity', 'customer', 'churned'].includes(c.stage)
      ? c.stage
      : 'lead') as Contact['stage'],
    tags: clampStrArray(c.tags, 25),
    group: c.group ? clampStr(c.group, 100) : undefined,
    optInStatus: (['explicit_opt_in', 'implicit_opt_in', 'opted_out', 'dnc_suppressed'].includes(c.optInStatus)
      ? c.optInStatus
      : 'explicit_opt_in') as Contact['optInStatus'],
    optInMethod: c.optInMethod ? clampStr(c.optInMethod, 64) : undefined,
    optInDate: nonEmptyStr(c.optInDate, 40, new Date().toISOString().slice(0, 10)),
    optInSource: nonEmptyStr(c.optInSource, 160, 'TelePulse CRM'),
    optOutTimestamp: c.optOutTimestamp ? clampStr(c.optOutTimestamp, 64) : undefined,
    optOutReason: c.optOutReason ? clampStr(c.optOutReason, 256) : undefined,
    googleContactSynced: Boolean(c.googleContactSynced),
    assignedToAgentId: nonEmptyStr(c.assignedToAgentId, 128, 'usr_admin'),
    assignedModeratorId: c.assignedModeratorId ? clampStr(c.assignedModeratorId, 128) : undefined,
    initialSessionId: c.initialSessionId ? clampStr(c.initialSessionId, 128) : undefined,
    customFields: c.customFields ? clampStringMap(c.customFields, 30) : undefined,
    notes: c.notes ? clampStr(c.notes, 2000) : undefined,
    isArchived: typeof c.isArchived === 'boolean' ? c.isArchived : undefined,
    archivedAt: c.archivedAt ? clampStr(c.archivedAt, 64) : undefined,
  });
}

function buildCampaignPayload(uid: string, c: Campaign) {
  const id = sanitizeId(c.id, 'cmp');
  const failureBreakdown =
    c.failureBreakdown && typeof c.failureBreakdown === 'object'
      ? Object.fromEntries(
          Object.entries(c.failureBreakdown)
            .slice(0, 20)
            .map(([k, v]) => [clampStr(k, 64), Math.max(0, Math.floor(Number(v) || 0))])
        )
      : undefined;

  return stripUndefined({
    id,
    ownerId: uid,
    name: nonEmptyStr(c.name, 200, 'Untitled Campaign'),
    messageText: clampStr(c.messageText, 4096),
    mediaUrl: c.mediaUrl ? clampStr(c.mediaUrl, 1000) : undefined,
    mediaType: c.mediaType ? clampStr(c.mediaType, 32) : undefined,
    targetSegment: nonEmptyStr(c.targetSegment, 128, 'all'),
    recipientCount: Math.max(0, Math.floor(Number(c.recipientCount) || 0)),
    sentCount: Math.max(0, Math.floor(Number(c.sentCount) || 0)),
    deliveredCount: Math.max(0, Math.floor(Number(c.deliveredCount) || 0)),
    readCount: Math.max(0, Math.floor(Number(c.readCount) || 0)),
    clickedCount: Math.max(0, Math.floor(Number(c.clickedCount) || 0)),
    failedCount: Math.max(0, Math.floor(Number(c.failedCount) || 0)),
    repliedCount:
      typeof c.repliedCount === 'number' ? Math.max(0, Math.floor(c.repliedCount)) : undefined,
    unsubscribedCount: Math.max(0, Math.floor(Number(c.unsubscribedCount) || 0)),
    status: (['draft', 'scheduled', 'running', 'completed', 'paused', 'failed'].includes(c.status)
      ? c.status
      : 'draft') as Campaign['status'],
    scheduledTime: c.scheduledTime ? clampStr(c.scheduledTime, 64) : undefined,
    sendRatePerSecond: Math.max(0, Number(c.sendRatePerSecond) || 1),
    buttonText: c.buttonText ? clampStr(c.buttonText, 100) : undefined,
    buttonUrl: c.buttonUrl ? clampStr(c.buttonUrl, 1000) : undefined,
    tags: clampStrArray(c.tags, 20),
    sendingEngine: c.sendingEngine ? clampStr(c.sendingEngine, 32) : undefined,
    antiBanDelaySeconds:
      typeof c.antiBanDelaySeconds === 'number' ? Number(c.antiBanDelaySeconds) : undefined,
    minDelaySeconds: typeof c.minDelaySeconds === 'number' ? Number(c.minDelaySeconds) : undefined,
    maxDelaySeconds: typeof c.maxDelaySeconds === 'number' ? Number(c.maxDelaySeconds) : undefined,
    assignedSessionIds: c.assignedSessionIds
      ? clampStrArray(c.assignedSessionIds, 50)
      : undefined,
    autoAppendOptOutFooter:
      typeof c.autoAppendOptOutFooter === 'boolean' ? c.autoAppendOptOutFooter : undefined,
    spambotPreFlightCheck:
      typeof c.spambotPreFlightCheck === 'boolean' ? c.spambotPreFlightCheck : undefined,
    pausedReason: c.pausedReason ? clampStr(c.pausedReason, 500) : undefined,
    flaggedSessionId: c.flaggedSessionId ? clampStr(c.flaggedSessionId, 128) : undefined,
    failureBreakdown,
  });
}

function buildChatMessagePayload(uid: string, m: ChatMessage) {
  const id = sanitizeId(m.id, 'msg');
  const contactId = sanitizeId(m.contactId, 'contact');
  return stripUndefined({
    id,
    ownerId: uid,
    contactId,
    sender: (['contact', 'agent', 'bot'].includes(m.sender) ? m.sender : 'agent') as ChatMessage['sender'],
    senderName: nonEmptyStr(m.senderName, 160, 'Agent'),
    text: clampStr(m.text, 4096),
    timestamp: nonEmptyStr(m.timestamp, 40, new Date().toTimeString().slice(0, 8)),
    status: (['sent', 'delivered', 'read'].includes(m.status) ? m.status : 'sent') as ChatMessage['status'],
    sessionId: m.sessionId ? clampStr(m.sessionId, 128) : undefined,
    sessionLabel: m.sessionLabel ? clampStr(m.sessionLabel, 160) : undefined,
    mediaUrl: m.mediaUrl ? clampStr(m.mediaUrl, 1000) : undefined,
    originalText: m.originalText ? clampStr(m.originalText, 4096) : undefined,
    translatedText: m.translatedText ? clampStr(m.translatedText, 4096) : undefined,
    translatedLang: m.translatedLang ? clampStr(m.translatedLang, 24) : undefined,
    replyTo: m.replyTo
      ? {
          id: clampStr(m.replyTo.id, 128),
          senderName: clampStr(m.replyTo.senderName, 160),
          text: clampStr(m.replyTo.text, 500),
        }
      : undefined,
    reactions: m.reactions
      ? Object.fromEntries(
          Object.entries(m.reactions)
            .slice(0, 20)
            .map(([k, v]) => [clampStr(k, 16), Math.max(1, Math.floor(Number(v) || 1))])
        )
      : undefined,
    attachment: m.attachment
      ? stripUndefined({
          type: m.attachment.type,
          name: clampStr(m.attachment.name, 255),
          size: m.attachment.size ? clampStr(m.attachment.size, 64) : undefined,
          url: m.attachment.url ? clampStr(m.attachment.url, 1000) : undefined,
          durationSec:
            typeof m.attachment.durationSec === 'number'
              ? Math.max(0, Math.floor(m.attachment.durationSec))
              : undefined,
        })
      : undefined,
    isPinned: typeof m.isPinned === 'boolean' ? m.isPinned : undefined,
  });
}

export async function ensureFirebaseUserProfile(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;

  const displayName = nonEmptyStr(
    user.displayName || user.email?.split('@')[0],
    120,
    'Workspace Operator'
  );
  const isBootstrappedAdmin =
    user.emailVerified && user.email?.toLowerCase() === 'hidden25soul@gmail.com';

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName,
        role: isBootstrappedAdmin ? 'admin' : 'editor',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  if (user.email) {
    try {
      const privateRef = doc(db, 'users', uid, 'private', 'info');
      const pSnap = await getDoc(privateRef);
      if (!pSnap.exists()) {
        await setDoc(privateRef, {
          uid,
          email: clampStr(user.email, 254),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(privateRef, {
          email: clampStr(user.email, 254),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }
}

export interface InitialSeedData {
  contacts: Contact[];
  campaigns: Campaign[];
  chats: Record<string, ChatMessage[]>;
  autoResponses: AutoResponseRule[];
  webhooks: WebhookEndpoint[];
  userbotSessions: UserbotSession[];
  audienceLists: AudienceList[];
  cloudFiles: CloudFile[];
  wpConfig: WordPressConfig;
  googleSync: GoogleContactsSync;
  botConfig: TelegramBotConfig;
  mtprotoConfig: MTProtoConfig;
  moderatorRouting: ModeratorRoutingConfig;
}

export async function seedWorkspaceIfEmpty(uid: string, seed: InitialSeedData): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const contactsPath = `users/${cleanUid}/contacts`;
  let existingContactsEmpty = false;

  try {
    const existing = await getDocs(
      query(collection(db, contactsPath), where('ownerId', '==', cleanUid))
    );
    existingContactsEmpty = existing.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, contactsPath);
  }

  if (!existingContactsEmpty) return;

  // Contacts must be created BEFORE chatMessages to satisfy relational existence rule
  for (const contact of seed.contacts.slice(0, 50)) {
    await saveContactToFirestore(cleanUid, contact);
  }

  for (const camp of seed.campaigns.slice(0, 20)) {
    await saveCampaignToFirestore(cleanUid, camp);
  }

  for (const [contactId, list] of Object.entries(seed.chats)) {
    const contactExists = seed.contacts.some((c) => sanitizeId(c.id) === sanitizeId(contactId));
    if (!contactExists) continue;
    for (const msg of list.slice(0, 40)) {
      await saveChatMessageToFirestore(cleanUid, { ...msg, contactId });
    }
  }

  for (const rule of seed.autoResponses.slice(0, 20)) {
    await saveAutoResponseToFirestore(cleanUid, rule);
  }

  for (const hook of seed.webhooks.slice(0, 20)) {
    await saveWebhookToFirestore(cleanUid, hook);
  }

  for (const sess of seed.userbotSessions.slice(0, 20)) {
    await saveUserbotSessionToFirestore(cleanUid, sess);
  }

  for (const aud of seed.audienceLists.slice(0, 20)) {
    await saveAudienceListToFirestore(cleanUid, aud);
  }

  for (const file of seed.cloudFiles.slice(0, 20)) {
    await saveCloudFileToFirestore(cleanUid, file);
  }

  await saveWorkspaceSettingToFirestore(cleanUid, 'wordpress', seed.wpConfig);
  await saveWorkspaceSettingToFirestore(cleanUid, 'googleSync', seed.googleSync);
  await saveWorkspaceSettingToFirestore(cleanUid, 'botConfig', seed.botConfig);
  await saveWorkspaceSettingToFirestore(cleanUid, 'mtprotoConfig', seed.mtprotoConfig);
  await saveWorkspaceSettingToFirestore(cleanUid, 'moderatorRouting', seed.moderatorRouting);
}

export async function saveContactToFirestore(uid: string, contact: Contact): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const payload = buildContactPayload(cleanUid, contact);
  const path = `users/${cleanUid}/contacts/${payload.id}`;
  try {
    const ref = doc(db, 'users', cleanUid, 'contacts', payload.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { id: _id, ownerId: _ownerId, ...mutable } = payload;
      await updateDoc(ref, {
        ...mutable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteContactFromFirestore(uid: string, contactId: string): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(contactId);
  const path = `users/${cleanUid}/contacts/${id}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUid, 'contacts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCampaignToFirestore(uid: string, campaign: Campaign): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const payload = buildCampaignPayload(cleanUid, campaign);
  const path = `users/${cleanUid}/campaigns/${payload.id}`;
  try {
    const ref = doc(db, 'users', cleanUid, 'campaigns', payload.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data();
      if (existingData?.status === 'completed') return;
      await updateDoc(
        ref,
        stripUndefined({
          sentCount: payload.sentCount,
          deliveredCount: payload.deliveredCount,
          readCount: payload.readCount,
          clickedCount: payload.clickedCount,
          failedCount: payload.failedCount,
          repliedCount: payload.repliedCount,
          unsubscribedCount: payload.unsubscribedCount,
          failureBreakdown: payload.failureBreakdown,
          status: payload.status,
          assignedSessionIds: payload.assignedSessionIds,
          updatedAt: serverTimestamp(),
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCampaignFromFirestore(uid: string, campaignId: string): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(campaignId);
  const path = `users/${cleanUid}/campaigns/${id}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUid, 'campaigns', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveChatMessageToFirestore(uid: string, msg: ChatMessage): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const payload = buildChatMessagePayload(cleanUid, msg);
  const path = `users/${cleanUid}/chatMessages/${payload.id}`;
  try {
    const ref = doc(db, 'users', cleanUid, 'chatMessages', payload.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(
        ref,
        stripUndefined({
          status: payload.status,
          reactions: payload.reactions,
          isPinned: payload.isPinned,
          translatedText: payload.translatedText,
          translatedLang: payload.translatedLang,
          updatedAt: serverTimestamp(),
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAutoResponseToFirestore(
  uid: string,
  rule: AutoResponseRule
): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(rule.id, 'rule');
  const path = `users/${cleanUid}/autoResponses/${id}`;
  const mutable = stripUndefined({
    triggerKeyword: nonEmptyStr(rule.triggerKeyword, 120, 'hello'),
    matchType: (['exact', 'contains', 'starts_with'].includes(rule.matchType)
      ? rule.matchType
      : 'contains') as AutoResponseRule['matchType'],
    replyText: nonEmptyStr(rule.replyText, 2000, 'Thank you for contacting us.'),
    isActive: Boolean(rule.isActive),
    priority: Math.max(0, Math.min(1000, Math.floor(Number(rule.priority) || 1))),
    action: rule.action ? clampStr(rule.action, 40) : undefined,
  });
  try {
    const ref = doc(db, 'users', cleanUid, 'autoResponses', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        ownerId: cleanUid,
        ...mutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, { ...mutable, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAutoResponseFromFirestore(uid: string, ruleId: string): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(ruleId);
  const path = `users/${cleanUid}/autoResponses/${id}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUid, 'autoResponses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveWebhookToFirestore(uid: string, hook: WebhookEndpoint): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(hook.id, 'wh');
  const path = `users/${cleanUid}/webhooks/${id}`;
  const mutable = stripUndefined({
    name: nonEmptyStr(hook.name, 160, 'Webhook'),
    endpointUrl: nonEmptyStr(hook.endpointUrl, 500, 'https://example.com/webhook'),
    secretToken: clampStr(hook.secretToken, 256),
    eventSubscriptions: clampStrArray(hook.eventSubscriptions, 30),
    isActive: Boolean(hook.isActive),
    totalCalls: Math.max(0, Math.floor(Number(hook.totalCalls) || 0)),
    successRate: Math.max(0, Math.min(100, Number(hook.successRate) || 100)),
    lastTriggered: hook.lastTriggered ? clampStr(hook.lastTriggered, 64) : undefined,
  });
  try {
    const ref = doc(db, 'users', cleanUid, 'webhooks', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        ownerId: cleanUid,
        ...mutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, { ...mutable, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteWebhookFromFirestore(uid: string, webhookId: string): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(webhookId);
  const path = `users/${cleanUid}/webhooks/${id}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUid, 'webhooks', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveWebhookLogToFirestore(uid: string, log: WebhookLog): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(log.id, 'log');
  const path = `users/${cleanUid}/webhookLogs/${id}`;
  try {
    const ref = doc(db, 'users', cleanUid, 'webhookLogs', id);
    await setDoc(ref, {
      id,
      ownerId: cleanUid,
      webhookId: sanitizeId(log.webhookId, 'wh'),
      event: nonEmptyStr(log.event, 120, 'event'),
      payload: clampStr(log.payload, 8000),
      responseStatus: Math.floor(Number(log.responseStatus) || 200),
      responseBody: clampStr(log.responseBody, 2000),
      timestamp: nonEmptyStr(log.timestamp, 40, new Date().toISOString()),
      executionTimeMs: Math.max(0, Math.floor(Number(log.executionTimeMs) || 0)),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveUserbotSessionToFirestore(
  uid: string,
  sess: UserbotSession
): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(sess.id, 'ub');
  const path = `users/${cleanUid}/userbotSessions/${id}`;
  const payload = stripUndefined({
    id,
    ownerId: cleanUid,
    label: nonEmptyStr(sess.label, 160, 'Userbot Session'),
    phone: nonEmptyStr(sess.phone, 40, '+0000000000'),
    apiId: sess.apiId ? clampStr(sess.apiId, 64) : undefined,
    apiHash: sess.apiHash ? clampStr(sess.apiHash, 128) : undefined,
    sessionString: sess.sessionString ? clampStr(sess.sessionString, 4096) : undefined,
    proxy: sess.proxy
      ? stripUndefined({
          enabled: Boolean(sess.proxy.enabled),
          type: sess.proxy.type,
          host: clampStr(sess.proxy.host, 128),
          port: Number(sess.proxy.port) || 1080,
        })
      : undefined,
    healthStatus: sess.healthStatus,
    spambotStatus: sess.spambotStatus,
    spambotMessage: sess.spambotMessage ? clampStr(sess.spambotMessage, 500) : undefined,
    lastSpambotCheckAt: sess.lastSpambotCheckAt
      ? clampStr(sess.lastSpambotCheckAt, 64)
      : undefined,
    floodWaitSeconds:
      typeof sess.floodWaitSeconds === 'number'
        ? Math.floor(sess.floodWaitSeconds)
        : undefined,
    floodWaitUntil: sess.floodWaitUntil ? clampStr(sess.floodWaitUntil, 64) : undefined,
    dailyLimit: Math.max(0, Math.floor(Number(sess.dailyLimit) || 50)),
    messagesSentToday: Math.max(0, Math.floor(Number(sess.messagesSentToday) || 0)),
    messagesSentTotal: Math.max(0, Math.floor(Number(sess.messagesSentTotal) || 0)),
    messagesSentBeforeFlag:
      typeof sess.messagesSentBeforeFlag === 'number'
        ? Math.floor(sess.messagesSentBeforeFlag)
        : undefined,
    isConnected: Boolean(sess.isConnected),
    isLiveTelegramClient:
      typeof sess.isLiveTelegramClient === 'boolean' ? sess.isLiveTelegramClient : undefined,
    account: sess.account
      ? stripUndefined({
          id: clampStr(sess.account.id, 64),
          firstName: clampStr(sess.account.firstName, 120),
          lastName: sess.account.lastName ? clampStr(sess.account.lastName, 120) : undefined,
          username: sess.account.username ? clampStr(sess.account.username, 80) : undefined,
          phone: clampStr(sess.account.phone, 40),
          dcId: typeof sess.account.dcId === 'number' ? Math.floor(sess.account.dcId) : undefined,
          isPremium:
            typeof sess.account.isPremium === 'boolean' ? sess.account.isPremium : undefined,
        })
      : undefined,
  });

  try {
    const ref = doc(db, 'users', cleanUid, 'userbotSessions', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const {
        id: _id,
        ownerId: _ownerId,
        phone: _phone,
        apiId: _apiId,
        apiHash: _apiHash,
        sessionString: _ss,
        ...mutable
      } = payload;
      await updateDoc(ref, {
        ...mutable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAudienceListToFirestore(
  uid: string,
  aud: AudienceList
): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(aud.id, 'aud');
  const path = `users/${cleanUid}/audienceLists/${id}`;
  const mutable = stripUndefined({
    name: nonEmptyStr(aud.name, 160, 'Audience List'),
    description: aud.description ? clampStr(aud.description, 500) : undefined,
    contactIds: clampStrArray(aud.contactIds, 500),
    source: nonEmptyStr(aud.source, 120, 'CRM'),
  });
  try {
    const ref = doc(db, 'users', cleanUid, 'audienceLists', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        ownerId: cleanUid,
        ...mutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, { ...mutable, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCampaignBackupToFirestore(
  uid: string,
  bkp: CampaignBackupSnapshot
): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(bkp.id, 'bkp');
  const path = `users/${cleanUid}/campaignBackups/${id}`;
  try {
    const ref = doc(db, 'users', cleanUid, 'campaignBackups', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(
        ref,
        stripUndefined({
          id,
          ownerId: cleanUid,
          campaignId: sanitizeId(bkp.campaignId, 'cmp'),
          campaignName: nonEmptyStr(bkp.campaignName, 200, 'Campaign'),
          tag: nonEmptyStr(bkp.tag, 250, 'Backup'),
          triggeredBySessionId: nonEmptyStr(bkp.triggeredBySessionId, 128, 'session'),
          triggeredBySessionLabel: nonEmptyStr(bkp.triggeredBySessionLabel, 160, 'Userbot'),
          triggeredReason: nonEmptyStr(bkp.triggeredReason, 500, 'Failover'),
          pendingCount: Math.max(0, Math.floor(Number(bkp.pendingCount) || 0)),
          pendingRecipients: (bkp.pendingRecipients || []).slice(0, 500).map((r) => ({
            contactId: sanitizeId(r.contactId, 'c'),
            name: nonEmptyStr(r.name, 160, 'Customer'),
            phoneNumber: nonEmptyStr(r.phoneNumber, 40, '+0000000000'),
            status: r.status || 'pending',
          })),
          restoredAt: bkp.restoredAt ? clampStr(bkp.restoredAt, 64) : undefined,
          restoredWithSessionId: bkp.restoredWithSessionId
            ? clampStr(bkp.restoredWithSessionId, 128)
            : undefined,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      await updateDoc(
        ref,
        stripUndefined({
          restoredAt: bkp.restoredAt ? clampStr(bkp.restoredAt, 64) : undefined,
          restoredWithSessionId: bkp.restoredWithSessionId
            ? clampStr(bkp.restoredWithSessionId, 128)
            : undefined,
          updatedAt: serverTimestamp(),
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCloudFileToFirestore(uid: string, file: CloudFile): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(file.id, 'file');
  const path = `users/${cleanUid}/cloudFiles/${id}`;
  try {
    const ref = doc(db, 'users', cleanUid, 'cloudFiles', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        ownerId: cleanUid,
        name: nonEmptyStr(file.name, 255, 'file'),
        size: Math.max(0, Math.floor(Number(file.size) || 0)),
        type: nonEmptyStr(file.type, 120, 'application/octet-stream'),
        uploadedAt: nonEmptyStr(file.uploadedAt, 40, new Date().toISOString().slice(0, 10)),
        url: clampStr(file.url, 1000),
        encrypted: Boolean(file.encrypted),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCloudFileFromFirestore(uid: string, fileId: string): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(fileId);
  const path = `users/${cleanUid}/cloudFiles/${id}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUid, 'cloudFiles', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveAuditLogToFirestore(uid: string, log: AuditLog): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const id = sanitizeId(log.id, 'aud');
  const path = `users/${cleanUid}/auditLogs/${id}`;
  try {
    const ref = doc(db, 'users', cleanUid, 'auditLogs', id);
    await setDoc(ref, {
      id,
      ownerId: cleanUid,
      userId: nonEmptyStr(log.userId, 128, cleanUid),
      userName: nonEmptyStr(log.userName, 160, 'Operator'),
      action: nonEmptyStr(log.action, 120, 'ACTION'),
      entity: nonEmptyStr(log.entity, 120, 'System'),
      details: nonEmptyStr(log.details, 1000, 'Action logged'),
      timestamp: nonEmptyStr(log.timestamp, 40, new Date().toISOString()),
      ipAddress: nonEmptyStr(log.ipAddress, 64, '0.0.0.0'),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export type WorkspaceSettingKey =
  | 'wordpress'
  | 'googleSync'
  | 'botConfig'
  | 'mtprotoConfig'
  | 'moderatorRouting';

export async function saveWorkspaceSettingToFirestore(
  uid: string,
  key: WorkspaceSettingKey,
  payloadObj: object
): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const path = `users/${cleanUid}/settings/${key}`;
  const cleanPayload = Object.fromEntries(
    Object.entries(payloadObj).slice(0, 30).filter(([, v]) => v !== undefined)
  );
  try {
    const ref = doc(db, 'users', cleanUid, 'settings', key);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        key,
        ownerId: cleanUid,
        payload: cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        payload: cleanPayload,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface WorkspaceSnapshotCallbacks {
  onContacts: (contacts: Contact[]) => void;
  onCampaigns: (campaigns: Campaign[]) => void;
  onChats: (chats: Record<string, ChatMessage[]>) => void;
  onAutoResponses: (rules: AutoResponseRule[]) => void;
  onWebhooks: (webhooks: WebhookEndpoint[]) => void;
  onWebhookLogs: (logs: WebhookLog[]) => void;
  onUserbotSessions: (sessions: UserbotSession[]) => void;
  onAudienceLists: (lists: AudienceList[]) => void;
  onCampaignBackups: (backups: CampaignBackupSnapshot[]) => void;
  onCloudFiles: (files: CloudFile[]) => void;
  onAuditLogs: (logs: AuditLog[]) => void;
  onSetting: (key: WorkspaceSettingKey, payload: any) => void;
}

export function subscribeWorkspaceCollections(
  uid: string,
  cb: WorkspaceSnapshotCallbacks
): Unsubscribe {
  const cleanUid = sanitizeId(uid);
  const unsubs: Unsubscribe[] = [];

  const sub = <T>(
    colName: string,
    handler: (items: T[]) => void
  ) => {
    const colPath = `users/${cleanUid}/${colName}`;
    const q = query(collection(db, colPath), where('ownerId', '==', cleanUid));
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => {
            const data = d.data() as Record<string, any>;
            return {
              ...data,
              createdAt:
                typeof data.createdAt === 'string'
                  ? data.createdAt
                  : data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
            } as T;
          });
          handler(items);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, colPath);
        }
      )
    );
  };

  sub<Contact>('contacts', (items) => {
    if (items.length > 0) cb.onContacts(items);
  });
  sub<Campaign>('campaigns', (items) => {
    if (items.length > 0) cb.onCampaigns(items);
  });
  sub<ChatMessage>('chatMessages', (items) => {
    if (items.length > 0) {
      const grouped: Record<string, ChatMessage[]> = {};
      for (const m of items) {
        if (!grouped[m.contactId]) grouped[m.contactId] = [];
        grouped[m.contactId].push(m);
      }
      for (const list of Object.values(grouped)) {
        list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      }
      cb.onChats(grouped);
    }
  });
  sub<AutoResponseRule>('autoResponses', (items) => {
    if (items.length > 0) cb.onAutoResponses(items);
  });
  sub<WebhookEndpoint>('webhooks', (items) => {
    if (items.length > 0) cb.onWebhooks(items);
  });
  sub<WebhookLog>('webhookLogs', (items) => {
    if (items.length > 0) cb.onWebhookLogs(items);
  });
  sub<UserbotSession>('userbotSessions', (items) => {
    if (items.length > 0) cb.onUserbotSessions(items);
  });
  sub<AudienceList>('audienceLists', (items) => {
    if (items.length > 0) cb.onAudienceLists(items);
  });
  sub<CampaignBackupSnapshot>('campaignBackups', (items) => {
    if (items.length > 0) cb.onCampaignBackups(items);
  });
  sub<CloudFile>('cloudFiles', (items) => {
    if (items.length > 0) cb.onCloudFiles(items);
  });
  sub<AuditLog>('auditLogs', (items) => {
    if (items.length > 0) cb.onAuditLogs(items);
  });

  const settingsPath = `users/${cleanUid}/settings`;
  unsubs.push(
    onSnapshot(
      query(collection(db, settingsPath), where('ownerId', '==', cleanUid)),
      (snap) => {
        for (const d of snap.docs) {
          const data = d.data();
          if (data?.key && data?.payload) {
            cb.onSetting(data.key as WorkspaceSettingKey, data.payload);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, settingsPath);
      }
    )
  );

  return () => {
    for (const u of unsubs) u();
  };
}
