export type UserRole = 'admin' | 'moderator' | 'editor' | 'viewer';

export type UserAccountStatus = 'approved' | 'suspended';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserAccountStatus;
  googleLinked?: boolean;
  avatar: string;
  department: string;
  assignedPort: number;
  createdAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SignupRequest {
  id: string;
  username: string;
  name: string;
  email: string;
  requestedRole: 'moderator' | 'editor' | 'viewer';
  department: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export type ModeratorRoutingMode = 'specific_moderator' | 'round_robin' | 'manual';

export interface ModeratorRoutingConfig {
  enabled: boolean;
  mode: ModeratorRoutingMode;
  defaultModeratorId: string;
  autoRouteNewContacts: boolean;
  autoRouteInboundMessages: boolean;
  lastRoundRobinIndex: number;
}

export type OptInStatus = 'explicit_opt_in' | 'implicit_opt_in' | 'opted_out' | 'dnc_suppressed';
export type OptInMethod =
  | 'explicit_csv_consent'
  | 'double_opt_in_confirmed'
  | 'telegram_bot_start'
  | 'web_form'
  | 'auto_assigned';

export type LeadStage = 'lead' | 'qualified' | 'contacted' | 'opportunity' | 'customer' | 'churned';

export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
}

export interface AudienceList {
  id: string;
  name: string;
  description?: string;
  contactIds: string[];
  source: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  phoneNumber: string; // E.164 formatted
  telegramUsername?: string;
  telegramUid?: string;
  hasTelegram: boolean;
  telegramStatus: 'active' | 'inactive' | 'unknown';
  lastSeen?: string;
  company?: string;
  email?: string;
  stage: LeadStage;
  tags: string[];
  group?: string;
  optInStatus: OptInStatus;
  optInMethod?: OptInMethod;
  optInDate: string;
  optInSource: string;
  optOutTimestamp?: string;
  optOutReason?: string;
  googleContactSynced: boolean;
  assignedToAgentId: string;
  assignedModeratorId?: string;
  initialSessionId?: string; // Preserves Userbot session thread continuity
  customFields?: Record<string, string>; // Dynamic CSV/Excel columns (Order_Number, Customer_Tier, etc.)
  notes?: string;
  isArchived?: boolean;
  archivedAt?: string;
  createdAt: string;
}

export interface ProxyConfig {
  enabled: boolean;
  type: 'socks5' | 'mtproto';
  host: string;
  port: number;
  username?: string;
  password?: string;
  secret?: string;
}

export type UserbotHealthStatus =
  | 'active'
  | 'flood_wait'
  | 'flagged_spambot'
  | 'user_deactivated'
  | 'auth_key_unregistered'
  | 'disconnected';

export interface MTProtoAccount {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone: string;
  dcId?: number;
  isPremium?: boolean;
}

export interface UserbotSession {
  id: string;
  label: string;
  phone: string;
  apiId: string;
  apiHash: string;
  sessionString: string;
  proxy: ProxyConfig;
  healthStatus: UserbotHealthStatus;
  spambotStatus: 'clean' | 'limited' | 'banned' | 'unchecked';
  spambotMessage?: string;
  lastSpambotCheckAt?: string;
  floodWaitSeconds?: number;
  floodWaitUntil?: string;
  dailyLimit: number;
  messagesSentToday: number;
  messagesSentTotal: number;
  messagesSentBeforeFlag?: number;
  isConnected: boolean;
  isLiveTelegramClient?: boolean;
  account?: MTProtoAccount;
  createdAt: string;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'failed';
export type CampaignSendingEngine = 'bot_api' | 'mtproto';

export type FailureReason =
  | 'FloodWaitError'
  | 'UserDeactivated'
  | 'AuthKeyUnregistered'
  | 'PeerFlood'
  | 'OptedOut'
  | 'NoTelegramAccount'
  | 'NetworkError';

export interface CampaignRecipientCheckpoint {
  contactId: string;
  name: string;
  phoneNumber: string;
  status: 'pending' | 'sent' | 'failed' | 'replied' | 'opted_out';
  assignedSessionId?: string;
  assignedSessionLabel?: string;
  failureReason?: FailureReason;
  failureDetail?: string;
  sentAt?: string;
  repliedAt?: string;
}

export interface CampaignBackupSnapshot {
  id: string;
  campaignId: string;
  campaignName: string;
  tag: string; // e.g., "Backup_Data: Campaign 2 - Pending Customers"
  triggeredBySessionId: string;
  triggeredBySessionLabel: string;
  triggeredReason: string;
  pendingCount: number;
  pendingRecipients: CampaignRecipientCheckpoint[];
  createdAt: string;
  restoredAt?: string;
  restoredWithSessionId?: string;
}

export interface Campaign {
  id: string;
  name: string;
  messageText: string;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'document' | 'none';
  targetSegment: string; // 'all' | 'tag:xxx' | 'stage:xxx' | 'telegram_verified' | 'audience:xxx'
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  clickedCount: number;
  failedCount: number;
  repliedCount?: number;
  unsubscribedCount: number;
  status: CampaignStatus;
  scheduledTime?: string;
  createdAt: string;
  sendRatePerSecond: number;
  buttonText?: string;
  buttonUrl?: string;
  tags: string[];
  sendingEngine?: CampaignSendingEngine;
  antiBanDelaySeconds?: number;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  assignedSessionIds?: string[];
  autoAppendOptOutFooter?: boolean;
  spambotPreFlightCheck?: boolean;
  pausedReason?: string;
  flaggedSessionId?: string;
  checkpoints?: CampaignRecipientCheckpoint[];
  failureBreakdown?: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  contactId: string;
  sender: 'contact' | 'agent' | 'bot';
  senderName: string;
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  sessionId?: string;
  sessionLabel?: string;
  mediaUrl?: string;
  originalText?: string;
  translatedText?: string;
  translatedLang?: string;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  reactions?: Record<string, number>;
  attachment?: {
    type: 'photo' | 'document' | 'voice';
    name: string;
    size?: string;
    url?: string;
    durationSec?: number;
  };
  isPinned?: boolean;
}

export interface AutoResponseRule {
  id: string;
  triggerKeyword: string;
  matchType: 'exact' | 'contains' | 'starts_with';
  replyText: string;
  isActive: boolean;
  priority: number;
  action?: 'assign_agent' | 'tag_contact' | 'opt_out';
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  endpointUrl: string;
  secretToken: string;
  eventSubscriptions: string[];
  isActive: boolean;
  totalCalls: number;
  successRate: number;
  lastTriggered?: string;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  payload: string;
  responseStatus: number;
  responseBody: string;
  timestamp: string;
  executionTimeMs: number;
}

export interface WordPressConfig {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
  connected: boolean;
  syncWooCommerceOrders: boolean;
  syncContactForm7: boolean;
  autoBroadcastNewPosts: boolean;
  selectedPostCategories: string[];
  lastSyncTimestamp?: string;
}

export interface GoogleContactsSync {
  connected: boolean;
  accountEmail: string;
  lastSyncedAt?: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  syncedContactsCount: number;
  conflictResolution: 'telepulse_wins' | 'google_wins';
}

export interface TelegramBotConfig {
  botToken: string;
  botUsername: string;
  botName: string;
  webhookUrl: string;
  gatewayPort: number;
  sslMode: 'custom_cert' | 'letsencrypt' | 'strict_ca';
  adminChatId: string;
  notifyOnBroadcastFinish: boolean;
  notifyOnFailedDeliveries: boolean;
  notifyOnLeadOptOut: boolean;
  isConnected: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  details: string;
  timestamp: string;
  ipAddress: string;
}

export interface CloudFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  url: string;
  encrypted: boolean;
}

export interface TelegramLookupResult {
  phoneNumber: string;
  formattedNumber: string;
  isValid: boolean;
  countryCode: string;
  hasTelegram: boolean;
  telegramUid?: string;
  telegramUsername?: string;
  profileName?: string;
  status: 'active' | 'inactive' | 'unregistered' | 'invalid_format';
  verificationSource: 'Live Bot Query' | 'Direct Gateway API' | 'MTProto Core Protocol';
}

export interface MTProtoConfig {
  apiId: string;
  apiHash: string;
  phoneNumber: string;
  sessionString: string;
  isConnected: boolean;
  account?: MTProtoAccount;
  antiBanDelaySeconds: number;
  dailyMessageLimit: number;
  messagesSentToday: number;
  lastConnectedAt?: string;
}

export interface ModeratorMetric {
  moderatorId: string;
  name: string;
  assignedConversations: number;
  totalRepliesSent: number;
  avgResponseTimeSeconds: number;
}

export type ApiProviderType =
  | 'bot_api'
  | 'mtproto'
  | 'custom_http'
  | 'sms_twilio'
  | 'sms_http';
export type UnlimitedRoutingStrategy = 'round_robin' | 'failover' | 'least_used';

export interface TelegramApiSlot {
  id: string;
  label: string;
  type: ApiProviderType;
  enabled: boolean;
  status: 'active' | 'rate_limited' | 'error' | 'disabled';
  // Bot API credentials
  botToken?: string;
  botUsername?: string;
  // MTProto credentials
  apiId?: string;
  apiHash?: string;
  phone?: string;
  sessionId?: string;
  sessionString?: string;
  isLiveTelegramClient?: boolean;
  // Custom HTTP / Webhook / SMS HTTP Gateway API
  endpointUrl?: string;
  authHeader?: string;
  httpMethod?: 'GET' | 'POST';
  smsApiKey?: string;
  smsSenderId?: string;
  smsPayloadMode?: 'query_template' | 'json' | 'form';
  // Twilio SMS API
  twilioSid?: string;
  twilioAuthToken?: string;
  twilioFrom?: string;
  // Metrics & Quotas
  dailyLimit: number;
  sentCount: number;
  failedCount: number;
  cooldownUntil?: string;
  lastError?: string;
  lastVerifiedAt?: string;
  createdAt: string;
}

export interface UnlimitedTargetItem {
  id: string;
  target: string; // Numeric ID (e.g. 782910412 / -100123456), @username, or +phone
  targetType: 'numeric_id' | 'channel_id' | 'username' | 'phone';
  preferredProviderTypes?: ApiProviderType[];
  channelLabel?: string;
  name?: string;
  customFields?: Record<string, string>;
  status?: 'pending' | 'sent' | 'failed' | 'skipped_opt_out';
  usedApiId?: string;
  usedApiLabel?: string;
  error?: string;
  sentAt?: string;
}

export interface UnlimitedDispatchJob {
  jobId: string;
  name: string;
  messageText: string;
  routingStrategy: UnlimitedRoutingStrategy;
  apiIds: string[];
  status: 'running' | 'paused' | 'completed' | 'aborted';
  totalTargets: number;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  skippedOptOutCount: number;
  minDelayMs: number;
  maxDelayMs: number;
  apiUsage: Record<string, number>;
  recentLogs: Array<{
    target: string;
    status: 'sent' | 'failed' | 'skipped_opt_out';
    apiLabel: string;
    detail?: string;
    ts: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type NotificationCategory =
  | 'approval'
  | 'chat'
  | 'campaign'
  | 'session'
  | 'compliance'
  | 'webhook'
  | 'system';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  severity: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  targetTab?:
    | 'dashboard'
    | 'campaigns'
    | 'api_hub'
    | 'phone_filter'
    | 'contacts'
    | 'live_chat'
    | 'wordpress'
    | 'cloud_storage'
    | 'team_rbac'
    | 'audit_logs';
  targetContactId?: string;
}

