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
  AuditLog,
  CloudFile,
  UserAccount,
  UserRole,
  MTProtoConfig,
  UserbotSession,
  AudienceList,
  CampaignBackupSnapshot,
  ModeratorRoutingConfig,
} from '../types';
import {
  initialContacts,
  initialCampaigns,
  initialChatMessages,
  initialAutoResponses,
  initialWebhooks,
  initialWebhookLogs,
  initialWordPressConfig,
  initialGoogleSync,
  initialBotConfig,
  initialMTProtoConfig,
  initialCloudFiles,
  initialAuditLogs,
  initialUsers,
  initialUserbotSessions,
  initialAudienceLists,
  initialCampaignBackups,
} from '../data/mockData';

const STORAGE_KEYS = {
  CONTACTS: 'telepulse_contacts',
  CAMPAIGNS: 'telepulse_campaigns',
  CHATS: 'telepulse_chats',
  AUTO_RESPONSES: 'telepulse_auto_responses',
  WEBHOOKS: 'telepulse_webhooks',
  WEBHOOK_LOGS: 'telepulse_webhook_logs',
  WP_CONFIG: 'telepulse_wp_config',
  GOOGLE_SYNC: 'telepulse_google_sync',
  BOT_CONFIG: 'telepulse_bot_config',
  MTPROTO_CONFIG: 'telepulse_mtproto_config',
  USERBOT_SESSIONS: 'telepulse_userbot_sessions',
  AUDIENCE_LISTS: 'telepulse_audience_lists',
  CAMPAIGN_BACKUPS: 'telepulse_campaign_backups',
  CLOUD_FILES: 'telepulse_cloud_files',
  AUDIT_LOGS: 'telepulse_audit_logs',
  USERS: 'telepulse_users',
  IS_LOGGED_IN: 'telepulse_is_logged_in',
  CURRENT_USER_ID: 'telepulse_current_user_id',
  THEME: 'telepulse_theme',
  LANG: 'telepulse_lang',
  MODERATOR_ROUTING: 'telepulse_moderator_routing',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}

export const storageService = {
  getContacts: (): Contact[] => load(STORAGE_KEYS.CONTACTS, initialContacts),
  setContacts: (contacts: Contact[]) => save(STORAGE_KEYS.CONTACTS, contacts),

  getCampaigns: (): Campaign[] => load(STORAGE_KEYS.CAMPAIGNS, initialCampaigns),
  setCampaigns: (campaigns: Campaign[]) => save(STORAGE_KEYS.CAMPAIGNS, campaigns),

  getChats: (): Record<string, ChatMessage[]> => load(STORAGE_KEYS.CHATS, initialChatMessages),
  setChats: (chats: Record<string, ChatMessage[]>) => save(STORAGE_KEYS.CHATS, chats),

  getAutoResponses: (): AutoResponseRule[] => load(STORAGE_KEYS.AUTO_RESPONSES, initialAutoResponses),
  setAutoResponses: (rules: AutoResponseRule[]) => save(STORAGE_KEYS.AUTO_RESPONSES, rules),

  getWebhooks: (): WebhookEndpoint[] => load(STORAGE_KEYS.WEBHOOKS, initialWebhooks),
  setWebhooks: (webhooks: WebhookEndpoint[]) => save(STORAGE_KEYS.WEBHOOKS, webhooks),

  getWebhookLogs: (): WebhookLog[] => load(STORAGE_KEYS.WEBHOOK_LOGS, initialWebhookLogs),
  setWebhookLogs: (logs: WebhookLog[]) => save(STORAGE_KEYS.WEBHOOK_LOGS, logs),

  getWordPressConfig: (): WordPressConfig => load(STORAGE_KEYS.WP_CONFIG, initialWordPressConfig),
  setWordPressConfig: (cfg: WordPressConfig) => save(STORAGE_KEYS.WP_CONFIG, cfg),

  getGoogleSync: (): GoogleContactsSync => load(STORAGE_KEYS.GOOGLE_SYNC, initialGoogleSync),
  setGoogleSync: (sync: GoogleContactsSync) => save(STORAGE_KEYS.GOOGLE_SYNC, sync),

  getBotConfig: (): TelegramBotConfig => {
    const cfg = load<TelegramBotConfig>(STORAGE_KEYS.BOT_CONFIG, initialBotConfig);
    if (cfg.botToken === '7391029481:AAFj90_KlmNopQrsTuvWxyz1234567890') {
      return initialBotConfig;
    }
    return cfg;
  },
  setBotConfig: (cfg: TelegramBotConfig) => save(STORAGE_KEYS.BOT_CONFIG, cfg),

  getMTProtoConfig: (): MTProtoConfig => {
    const cfg = load<MTProtoConfig>(STORAGE_KEYS.MTPROTO_CONFIG, initialMTProtoConfig);
    if (cfg.apiId === '29841024' || cfg.apiId === '37979808') {
      return initialMTProtoConfig;
    }
    return cfg;
  },
  setMTProtoConfig: (cfg: MTProtoConfig) => save(STORAGE_KEYS.MTPROTO_CONFIG, cfg),

  getUserbotSessions: (): UserbotSession[] => load(STORAGE_KEYS.USERBOT_SESSIONS, initialUserbotSessions),
  setUserbotSessions: (sessions: UserbotSession[]) => save(STORAGE_KEYS.USERBOT_SESSIONS, sessions),

  getAudienceLists: (): AudienceList[] => load(STORAGE_KEYS.AUDIENCE_LISTS, initialAudienceLists),
  setAudienceLists: (lists: AudienceList[]) => save(STORAGE_KEYS.AUDIENCE_LISTS, lists),

  getCampaignBackups: (): CampaignBackupSnapshot[] => load(STORAGE_KEYS.CAMPAIGN_BACKUPS, initialCampaignBackups),
  setCampaignBackups: (backups: CampaignBackupSnapshot[]) => save(STORAGE_KEYS.CAMPAIGN_BACKUPS, backups),

  getCloudFiles: (): CloudFile[] => load(STORAGE_KEYS.CLOUD_FILES, initialCloudFiles),
  setCloudFiles: (files: CloudFile[]) => save(STORAGE_KEYS.CLOUD_FILES, files),

  getAuditLogs: (): AuditLog[] => load(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs),
  setAuditLogs: (logs: AuditLog[]) => save(STORAGE_KEYS.AUDIT_LOGS, logs),

  getUsers: (): UserAccount[] => {
    try {
      localStorage.removeItem(STORAGE_KEYS.USERS);
    } catch {}
    return initialUsers;
  },
  setUsers: (_users: UserAccount[]) => {
    try {
      localStorage.removeItem(STORAGE_KEYS.USERS);
    } catch {}
  },

  getIsLoggedIn: (): boolean => false,
  setIsLoggedIn: (_val: boolean) => {
    try {
      localStorage.removeItem(STORAGE_KEYS.IS_LOGGED_IN);
    } catch {}
  },

  getCurrentUserId: (): string => load(STORAGE_KEYS.CURRENT_USER_ID, 'usr_admin'),
  setCurrentUserId: (id: string) => save(STORAGE_KEYS.CURRENT_USER_ID, id),

  getTheme: (): 'dark' | 'light' => load(STORAGE_KEYS.THEME, 'dark'),
  setTheme: (theme: 'dark' | 'light') => save(STORAGE_KEYS.THEME, theme),

  getLanguage: (): string => load(STORAGE_KEYS.LANG, 'en'),
  setLanguage: (lang: string) => save(STORAGE_KEYS.LANG, lang || 'en'),

  getModeratorRouting: (): ModeratorRoutingConfig =>
    load<ModeratorRoutingConfig>(STORAGE_KEYS.MODERATOR_ROUTING, {
      enabled: true,
      mode: 'specific_moderator',
      defaultModeratorId: 'usr_mod_1',
      autoRouteNewContacts: true,
      autoRouteInboundMessages: true,
      lastRoundRobinIndex: 0,
    }),
  setModeratorRouting: (cfg: ModeratorRoutingConfig) => save(STORAGE_KEYS.MODERATOR_ROUTING, cfg),

  logAction: (action: string, entity: string, details: string, user: UserAccount) => {
    const logs = load(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs);
    const newLog: AuditLog = {
      id: `aud_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      action,
      entity,
      details,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      ipAddress: '198.51.100.42',
    };
    save(STORAGE_KEYS.AUDIT_LOGS, [newLog, ...logs.slice(0, 49)]);
  },
};

/**
 * RBAC Permission Checker
 * Admins: Full access including creating administrators & managing Google-linked admin identity
 * Editors: Team/user provisioning (non-admins), live chat, campaigns, multi-API, phone filter, contacts, WordPress, cloud storage, audit logs
 * Moderators: Live customer chats & instant replies, bulk campaigns, phone filtering & Telegram verification
 * Viewers: Full-screen customer live chat only
 */
export type AppAction =
  | 'manage_users'
  | 'manage_webhooks'
  | 'manage_bot_gateway'
  | 'manage_wordpress_config'
  | 'create_campaign'
  | 'edit_contacts'
  | 'delete_contacts'
  | 'send_live_chat'
  | 'assign_conversations'
  | 'run_phone_filter'
  | 'export_data'
  | 'upload_cloud_files'
  | 'view_analytics';

export function canPerform(role: UserRole, action: AppAction): boolean {
  if (role === 'admin') return true;

  if (role === 'moderator') {
    return ['send_live_chat', 'create_campaign', 'run_phone_filter'].includes(action);
  }

  if (role === 'editor') {
    return [
      'manage_users',
      'manage_webhooks',
      'manage_bot_gateway',
      'manage_wordpress_config',
      'create_campaign',
      'edit_contacts',
      'delete_contacts',
      'send_live_chat',
      'assign_conversations',
      'run_phone_filter',
      'export_data',
      'upload_cloud_files',
      'view_analytics',
    ].includes(action);
  }

  if (role === 'viewer') {
    return action === 'send_live_chat';
  }

  return false;
}
