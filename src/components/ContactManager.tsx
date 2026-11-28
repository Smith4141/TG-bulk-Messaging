import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Tag,
  Phone,
  Mail,
  Building,
  UserCheck,
  AlertTriangle,
  ArrowUpDown,
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  PhoneCall,
  FolderPlus,
  Layers,
  Zap,
  Check,
  Copy,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import {
  Contact,
  LeadStage,
  OptInStatus,
  UserAccount,
  GoogleContactsSync,
  ChatMessage,
  ContactGroup,
  TelegramLookupResult,
  AudienceList,
  ModeratorRoutingConfig,
} from '../types';
import { exportToExcel, exportToCSV, parseUploadedSpreadsheet, normalizePhoneNumber, batchFilterPhoneNumbers, batchFilterWithMTProto } from '../services/telegramService';
import { translations, SupportedLanguage } from '../translations';

interface ContactManagerProps {
  contacts: Contact[];
  chats: Record<string, ChatMessage[]>;
  currentUser: UserAccount;
  allUsers: UserAccount[];
  googleSync: GoogleContactsSync;
  lang: SupportedLanguage;
  audienceLists?: AudienceList[];
  onSaveAudienceList?: (audience: AudienceList) => void;
  onAddContact: (contact: Omit<Contact, 'id' | 'createdAt'>) => void;
  onUpdateContact: (id: string, updates: Partial<Contact>) => void;
  onDeleteContact: (id: string) => void;
  onBulkAddContacts: (newContacts: Partial<Contact>[]) => void;
  onTriggerGoogleSync: () => void;
  onSendMessage: (contactId: string, text: string) => void;
  onSimulateCustomerReply: (contactId: string, text: string) => void;
  onNavigateToLiveChat?: (contactId?: string) => void;
  onCreateCampaign?: (campaignData: any) => void;
  moderatorRouting?: ModeratorRoutingConfig;
  onAssignModerator?: (contactId: string, moderatorId: string) => void;
  onRouteContactsToModerator?: (moderatorId: string, scope: 'all' | 'unassigned' | string[]) => number | void;
  onDistributeRoundRobin?: (scope: 'all' | 'unassigned') => number | void;
}

export const ContactManager: React.FC<ContactManagerProps> = ({
  contacts,
  chats,
  currentUser,
  allUsers,
  googleSync,
  lang,
  audienceLists = [],
  onSaveAudienceList,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onBulkAddContacts,
  onTriggerGoogleSync,
  onNavigateToLiveChat,
  onCreateCampaign,
  moderatorRouting,
  onAssignModerator,
  onRouteContactsToModerator,
  onDistributeRoundRobin,
}) => {
  const t = translations.en;
  const moderators = allUsers.filter((u) => u.role === 'moderator');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [bulkTargetModId, setBulkTargetModId] = useState<string>(
    moderatorRouting?.defaultModeratorId || moderators[0]?.id || ''
  );

  // Sub-tabs in Contact Management module:
  // 1. 'directory': Contact List & Table
  // 2. 'groups': Contact Groups (Create & Manage)
  // 3. 'checker': Phone Filter & Telegram Checker
  // 4. 'campaign': Campaign Dispatch
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'groups' | 'checker' | 'campaign'>('directory');

  // Groups state
  const [groups, setGroups] = useState<ContactGroup[]>([
    { id: 'grp_01', name: 'VIP Enterprise Clients', description: 'Priority accounts with high volume Telegram broadcasts', color: '#10b981', createdAt: '2026-03-01' },
    { id: 'grp_02', name: 'Bangladesh E-Commerce', description: 'Dhaka & Chittagong online stores for SMS tracking', color: '#3b82f6', createdAt: '2026-03-05' },
    { id: 'grp_03', name: 'Telegram Verified Active', description: 'Filter-verified numbers with active Telegram profiles', color: '#06b6d4', createdAt: '2026-03-10' },
    { id: 'grp_04', name: 'Wholesale B2B Buyers', description: 'Direct distributors and bulk shipment clients', color: '#8b5cf6', createdAt: '2026-03-12' },
  ]);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedOptIn, setSelectedOptIn] = useState<string>('all');
  const [selectedTelegramFilter, setSelectedTelegramFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState<Contact | null>(null);

  // Form States for Add/Edit
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelegram, setFormTelegram] = useState('');
  const [formStage, setFormStage] = useState<LeadStage>('lead');
  const [formOptIn, setFormOptIn] = useState<OptInStatus>('explicit_opt_in');
  const [formTags, setFormTags] = useState('New Lead');
  const [formGroup, setFormGroup] = useState<string>('VIP Enterprise Clients');
  const [formAgent, setFormAgent] = useState<string>(currentUser.id);

  // CSV/Excel Import & Opt-In/Opt-Out Automation State
  const [importFileName, setImportFileName] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDefaultOptIn, setImportDefaultOptIn] = useState<OptInStatus>('explicit_opt_in');
  const [importRunMtprotoCheck, setImportRunMtprotoCheck] = useState(true);
  const [importAudienceName, setImportAudienceName] = useState('');
  const [importSummary, setImportSummary] = useState<{
    totalRows: number;
    validNew: number;
    mergedExisting: number;
    duplicatesSkipped: number;
    optOutPreserved: number;
    detectedVariables: string[];
  } | null>(null);
  const [audienceNameInput, setAudienceNameInput] = useState('');
  const [audienceSavedToast, setAudienceSavedToast] = useState<string | null>(null);

  // Phone Filter & Telegram Checker sub-module state
  const [checkerRawInput, setCheckerRawInput] = useState(
    `+880 1712 345678\n+880 1819 876543\n+1 (415) 555-2671\n+33 6 12 34 56 78\n+971 50 123 4567\n+880 1911 223344\n+44 7911 123456\nINVALID-NUMBER-00`
  );
  const [checkerIsProcessing, setCheckerIsProcessing] = useState(false);
  const [checkerResults, setCheckerResults] = useState<TelegramLookupResult[]>([]);
  const [checkerFilterTab, setCheckerFilterTab] = useState<'all' | 'telegram' | 'unregistered' | 'invalid'>('all');
  const [checkerTargetGroup, setCheckerTargetGroup] = useState('Telegram Verified Active');
  const [checkerAddSuccess, setCheckerAddSuccess] = useState(false);

  // Campaign launcher sub-module state
  const [campaignName, setCampaignName] = useState('New Contact Group Broadcast');
  const [campaignTargetGroup, setCampaignTargetGroup] = useState('all');
  const [campaignMessage, setCampaignMessage] = useState(
    'Hello {{name}}, welcome to TelePulse Enterprise! Reply directly here if you need any assistance from our team.'
  );
  const [campaignRate, setCampaignRate] = useState(25);
  const [campaignLaunchedSuccess, setCampaignLaunchedSuccess] = useState(false);

  // Filtered Contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phoneNumber.includes(searchQuery) ||
      (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.telegramUsername && c.telegramUsername.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStage = selectedStage === 'all' || c.stage === selectedStage;
    const matchesOptIn = selectedOptIn === 'all' || c.optInStatus === selectedOptIn;
    const matchesTelegram =
      selectedTelegramFilter === 'all' ||
      (selectedTelegramFilter === 'verified' && c.hasTelegram) ||
      (selectedTelegramFilter === 'unverified' && !c.hasTelegram);
    const matchesGroup =
      selectedGroupFilter === 'all' ||
      c.group === selectedGroupFilter ||
      (c.tags && c.tags.includes(selectedGroupFilter));

    return matchesSearch && matchesStage && matchesOptIn && matchesTelegram && matchesGroup;
  });

  // Export handlers
  const handleExportExcel = () => {
    const exportRows = filteredContacts.map((c) => ({
      ID: c.id,
      Name: c.name,
      'Phone Number': c.phoneNumber,
      Group: c.group || 'Unassigned',
      'Has Telegram': c.hasTelegram ? 'Yes' : 'No',
      'Telegram Handle': c.telegramUsername ? `@${c.telegramUsername}` : '',
      Company: c.company || '',
      Email: c.email || '',
      'Lead Stage': c.stage,
      Tags: c.tags.join(', '),
      'Opt-In Status': c.optInStatus,
    }));
    exportToExcel(exportRows, `TelePulse_Contacts_${Date.now()}.xlsx`, 'Contacts');
  };

  const handleExportCSV = () => {
    const exportRows = filteredContacts.map((c) => ({
      name: c.name,
      phone: c.phoneNumber,
      group: c.group || '',
      telegram: c.telegramUsername || '',
      company: c.company || '',
      email: c.email || '',
      stage: c.stage,
      tags: c.tags.join(';'),
    }));
    exportToCSV(exportRows, `TelePulse_Contacts_${Date.now()}.csv`);
  };

  // Add Contact Form Submit
  const handleCreateContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { formatted } = normalizePhoneNumber(formPhone);

    onAddContact({
      name: formName,
      phoneNumber: formatted || formPhone,
      company: formCompany,
      email: formEmail,
      telegramUsername: formTelegram ? formTelegram.replace('@', '') : undefined,
      telegramUid: `tg_${Date.now().toString().slice(-8)}`,
      hasTelegram: true,
      telegramStatus: 'active',
      stage: formStage,
      tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
      group: formGroup,
      optInStatus: formOptIn,
      optInDate: new Date().toISOString().slice(0, 10),
      optInSource: 'Contact Module',
      googleContactSynced: true,
      assignedToAgentId: formAgent,
      notes: 'Added via Contact Management Module.',
    });

    setIsAddModalOpen(false);
    setFormName('');
    setFormPhone('');
    setFormCompany('');
    setFormEmail('');
  };

  // Create Group Submit
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const newG: ContactGroup = {
      id: `grp_${Date.now()}`,
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || 'Custom Contact Group',
      color: newGroupColor,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setGroups((prev) => [...prev, newG]);
    setNewGroupName('');
    setNewGroupDesc('');
    setIsNewGroupModalOpen(false);
  };

  // Parse CSV/Excel File with E.164 normalization, merge into existing CRM contacts, Opt-In/Opt-Out compliance & dynamic variable detection
  const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportError(null);
    setImporting(true);
    try {
      const rows = await parseUploadedSpreadsheet(file);
      if (!rows || rows.length === 0) {
        setCsvPreviewRows([]);
        setImportSummary(null);
        setImportError('The uploaded CSV/Excel file has no data rows. Please check the file and try again.');
        return;
      }

      const existingByPhone = new Map<string, Contact>();
      for (const c of contacts) {
        const key = c.phoneNumber.replace(/\D/g, '');
        if (key) existingByPhone.set(key, c);
      }
      const seenInBatch = new Set<string>();
      const detectedVars = new Set<string>();
      let validNew = 0;
      let mergedExisting = 0;
      let duplicatesSkipped = 0;
      let optOutPreserved = 0;
      const normalizedRows: any[] = [];

      const parseCsvConsentValue = (rawVal: string): OptInStatus | null => {
        const v = rawVal.trim().toLowerCase();
        if (!v) return null;
        if (/(dnc|do_not_contact|do not contact|suppress)/i.test(v)) return 'dnc_suppressed';
        if (
          v === 'false' ||
          v === 'no' ||
          v === '0' ||
          /(opt.?out|unsub|stop|reject|blocked|declined)/i.test(v)
        ) {
          return 'opted_out';
        }
        if (/(implicit|pending|soft)/i.test(v)) return 'implicit_opt_in';
        if (
          v === 'true' ||
          v === 'yes' ||
          v === '1' ||
          /(opt.?in|explicit|subscrib|active|consented|verified)/i.test(v)
        ) {
          return 'explicit_opt_in';
        }
        return null;
      };

      for (const row of rows) {
        const keys = Object.keys(row);
        const phoneKey = keys.find((k) => /phone|mobile|tel|contact|number/i.test(k)) || keys[0];
        const nameKey = keys.find((k) => /name|first_name|customer|full_name/i.test(k));
        const companyKey = keys.find((k) => /company|org|business/i.test(k));
        const emailKey = keys.find((k) => /email|mail/i.test(k));
        const groupKey = keys.find((k) => /^(group|segment|list|category)$/i.test(k.trim()));
        const tagsKey = keys.find((k) => /^(tags?|labels?)$/i.test(k.trim()));
        const telegramKey = keys.find((k) => /telegram|tg_user|handle/i.test(k));
        const optKey = keys.find((k) => /opt|consent|subscribe|unsub|dnc|status/i.test(k));

        const rawPhone = String(row[phoneKey] ?? '').trim();
        const { formatted, isValid, countryCode } = normalizePhoneNumber(rawPhone);
        if (!isValid || !formatted) continue;

        const digits = formatted.replace(/\D/g, '');
        if (seenInBatch.has(digits)) {
          duplicatesSkipped++;
          continue;
        }
        seenInBatch.add(digits);

        const existing = existingByPhone.get(digits);

        // Dynamic custom variables from all other columns (Order_Number, Customer_Tier, etc.)
        const customFields: Record<string, string> = {};
        for (const k of keys) {
          if (
            k !== phoneKey &&
            k !== emailKey &&
            k !== companyKey &&
            k !== groupKey &&
            k !== tagsKey &&
            k !== optKey
          ) {
            const cleanKey = k.trim().replace(/\s+/g, '_');
            const val = String(row[k] ?? '').trim();
            if (val) {
              customFields[cleanKey] = val;
              detectedVars.add(cleanKey);
            }
          }
        }

        const rawOpt = optKey ? String(row[optKey] ?? '') : '';
        const parsedRowOpt = parseCsvConsentValue(rawOpt);
        const csvOptStatus: OptInStatus = parsedRowOpt ?? importDefaultOptIn;

        let effectiveOptStatus: OptInStatus = csvOptStatus;
        let complianceAction: 'new_opt_in' | 'new_opt_out' | 'merged' | 'opt_out_preserved' | 'opt_out_applied' =
          csvOptStatus === 'opted_out' || csvOptStatus === 'dnc_suppressed' ? 'new_opt_out' : 'new_opt_in';

        if (existing) {
          const existingSuppressed =
            existing.optInStatus === 'opted_out' || existing.optInStatus === 'dnc_suppressed';
          const incomingSuppressed =
            csvOptStatus === 'opted_out' || csvOptStatus === 'dnc_suppressed';

          if (existingSuppressed) {
            // Strict compliance: never override existing Opt-Out / DNC status via CSV import
            effectiveOptStatus = existing.optInStatus;
            optOutPreserved++;
            complianceAction = 'opt_out_preserved';
          } else if (incomingSuppressed) {
            // Incoming CSV explicitly flags Opt-Out / Unsubscribe / DNC
            effectiveOptStatus = csvOptStatus;
            optOutPreserved++;
            complianceAction = 'opt_out_applied';
          } else {
            effectiveOptStatus =
              csvOptStatus === 'explicit_opt_in'
                ? 'explicit_opt_in'
                : existing.optInStatus;
            complianceAction = 'merged';
          }
          mergedExisting++;
        } else {
          if (csvOptStatus === 'opted_out' || csvOptStatus === 'dnc_suppressed') {
            optOutPreserved++;
          }
          validNew++;
        }

        const parsedTags = tagsKey
          ? String(row[tagsKey] ?? '')
              .split(/[;,]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const rawTgHandle = telegramKey ? String(row[telegramKey] ?? '').trim().replace(/^@/, '') : '';

        normalizedRows.push({
          existingId: existing?.id,
          isExistingMerge: Boolean(existing),
          complianceAction,
          name:
            (nameKey ? String(row[nameKey] ?? '').trim() : '') ||
            existing?.name ||
            `Lead ${formatted.slice(-4)}`,
          phoneNumber: formatted,
          countryCode,
          company: companyKey ? String(row[companyKey] ?? '').trim() : '',
          email: emailKey ? String(row[emailKey] ?? '').trim() : '',
          group: groupKey ? String(row[groupKey] ?? '').trim() : '',
          tags: parsedTags,
          telegramUsername: rawTgHandle || undefined,
          optInStatus: effectiveOptStatus,
          customFields,
        });
      }

      if (normalizedRows.length === 0) {
        setCsvPreviewRows([]);
        setImportSummary(null);
        setImportError(
          'No valid international phone numbers were detected. Ensure your CSV includes a Phone/Mobile column with valid numbers.'
        );
        return;
      }

      setCsvPreviewRows(normalizedRows);
      setImportAudienceName(file.name.replace(/\.(xlsx|xls|csv)$/i, ''));
      setImportSummary({
        totalRows: rows.length,
        validNew,
        mergedExisting,
        duplicatesSkipped,
        optOutPreserved,
        detectedVariables: Array.from(detectedVars),
      });
    } catch (err: any) {
      setCsvPreviewRows([]);
      setImportSummary(null);
      setImportError(err?.message || 'Failed to parse uploaded CSV/Excel file.');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (csvPreviewRows.length === 0) return;
    setImporting(true);
    try {
      let tgLookupMap = new Map<string, TelegramLookupResult>();
      if (importRunMtprotoCheck) {
        const checked = await batchFilterWithMTProto(csvPreviewRows.map((r) => r.phoneNumber));
        for (const res of checked) {
          tgLookupMap.set(res.formattedNumber, res);
        }
      }

      const batchSeed = Date.now();
      const prepared: Partial<Contact>[] = csvPreviewRows.map((row, idx) => {
        const tg = tgLookupMap.get(row.phoneNumber);
        const resolvedId = row.existingId || `c_${batchSeed}_${idx}`;
        const isSuppressed =
          row.optInStatus === 'opted_out' || row.optInStatus === 'dnc_suppressed';
        return {
          id: resolvedId,
          name: row.name,
          phoneNumber: row.phoneNumber,
          company: row.company,
          email: row.email,
          hasTelegram: tg ? tg.hasTelegram : true,
          telegramUid: tg?.telegramUid,
          telegramUsername: row.telegramUsername || tg?.telegramUsername,
          telegramStatus: tg ? (tg.hasTelegram ? 'active' : 'unknown') : 'active',
          stage: 'lead',
          group: row.group || importAudienceName || 'CSV Import Audience',
          tags: Array.from(
            new Set([
              'CSV/Excel Import',
              ...(importAudienceName ? [importAudienceName] : []),
              ...(row.tags || []),
            ])
          ),
          optInStatus: row.optInStatus || importDefaultOptIn,
          optInMethod:
            importDefaultOptIn === 'explicit_opt_in' ? 'explicit_csv_consent' : 'auto_assigned',
          optInDate: new Date().toISOString().slice(0, 10),
          optInSource: `File: ${importFileName} (CSV Compliance Gate)`,
          optOutTimestamp: isSuppressed ? new Date().toISOString() : undefined,
          optOutReason: isSuppressed ? 'Opt-Out / DNC enforced during CSV import' : undefined,
          customFields: row.customFields,
          assignedToAgentId: currentUser.id,
        };
      });

      onBulkAddContacts(prepared);

      if (onSaveAudienceList && importAudienceName.trim()) {
        const eligibleIds = prepared
          .filter((c) => c.optInStatus !== 'opted_out' && c.optInStatus !== 'dnc_suppressed')
          .map((c) => c.id!)
          .filter(Boolean);
        onSaveAudienceList({
          id: `aud_${batchSeed}`,
          name: importAudienceName.trim(),
          description: `Imported from ${importFileName} (${importSummary?.validNew ?? 0} new, ${importSummary?.mergedExisting ?? 0} merged, ${importSummary?.optOutPreserved ?? 0} opt-out enforced/preserved).`,
          contactIds: eligibleIds,
          source: importFileName,
          createdAt: new Date().toISOString().slice(0, 10),
        });
      }

      const newCount = importSummary?.validNew ?? prepared.length;
      const mergedCount = importSummary?.mergedExisting ?? 0;
      const suppressedCount = importSummary?.optOutPreserved ?? 0;

      setIsImportModalOpen(false);
      setCsvPreviewRows([]);
      setImportSummary(null);
      setImportError(null);
      setAudienceSavedToast(
        `CSV processed: ${newCount} new added, ${mergedCount} existing merged, ${suppressedCount} opt-out compliance preserved/enforced.`
      );
      setTimeout(() => setAudienceSavedToast(null), 6000);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadSampleExcel = () => {
    exportToExcel(
      [
        { First_Name: 'Ariful Islam', Phone: '+8801712345678', Company: 'Dhaka Mart', Order_Number: 'ORD-5501', Customer_Tier: 'VIP', Opt_In_Consent: 'opt_in' },
        { First_Name: 'Sumaiya Akter', Phone: '+8801819876543', Company: 'StyleBD', Order_Number: 'ORD-5502', Customer_Tier: 'Gold', Opt_In_Consent: 'opt_in' },
        { First_Name: 'Tariq Hassan', Phone: '+966509876543', Company: 'Red Sea Commerce', Order_Number: 'ORD-5503', Customer_Tier: 'Standard', Opt_In_Consent: 'opt_out' },
      ],
      'TelePulse_Sample_Contacts.xlsx',
      'Contacts'
    );
  };

  const handleDownloadSampleCSV = () => {
    exportToCSV(
      [
        { First_Name: 'Ariful Islam', Phone: '+8801712345678', Company: 'Dhaka Mart', Email: 'ariful@dhakamart.com', Order_Number: 'ORD-5501', Customer_Tier: 'VIP', Opt_In_Consent: 'opt_in' },
        { First_Name: 'Sumaiya Akter', Phone: '+8801819876543', Company: 'StyleBD', Email: 'sumaiya@stylebd.com', Order_Number: 'ORD-5502', Customer_Tier: 'Gold', Opt_In_Consent: 'opt_in' },
        { First_Name: 'Tariq Hassan', Phone: '+966509876543', Company: 'Red Sea Commerce', Email: 'tariq@redsea.sa', Order_Number: 'ORD-5503', Customer_Tier: 'Standard', Opt_In_Consent: 'opt_out' },
      ],
      'TelePulse_Sample_Contacts.csv'
    );
  };

  const handleSaveCurrentFilterAsAudience = () => {
    if (!audienceNameInput.trim() || !onSaveAudienceList) return;
    const eligible = filteredContacts.filter((c) => c.optInStatus !== 'opted_out' && c.optInStatus !== 'dnc_suppressed');
    onSaveAudienceList({
      id: `aud_${Date.now()}`,
      name: audienceNameInput.trim(),
      description: `Saved segment (${eligible.length} opted-in contacts)`,
      contactIds: eligible.map((c) => c.id),
      source: 'Filtered CRM Directory',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setAudienceNameInput('');
    setAudienceSavedToast(`Audience list saved (${eligible.length} opted-in contacts).`);
    setTimeout(() => setAudienceSavedToast(null), 4000);
  };

  // Run Phone Filter & Telegram Checker
  const handleRunChecker = async () => {
    setCheckerIsProcessing(true);
    setCheckerAddSuccess(false);
    try {
      const lines = checkerRawInput.split('\n');
      const results = await batchFilterWithMTProto(lines);
      setCheckerResults(results);
    } catch {
      const lines = checkerRawInput.split('\n');
      setCheckerResults(batchFilterPhoneNumbers(lines));
    } finally {
      setCheckerIsProcessing(false);
    }
  };

  // Add Verified Numbers to Contact Group
  const handleAddVerifiedToGroup = () => {
    const verified = checkerResults.filter((r) => r.isValid && r.hasTelegram);
    if (verified.length === 0) return;

    const newContacts: Partial<Contact>[] = verified.map((v, i) => ({
      name: v.profileName || `Contact ${v.countryCode} ${i + 1}`,
      phoneNumber: v.formattedNumber,
      telegramUsername: v.telegramUsername,
      telegramUid: v.telegramUid,
      hasTelegram: true,
      telegramStatus: 'active',
      stage: 'lead',
      group: checkerTargetGroup,
      tags: ['Telegram Filtered', checkerTargetGroup],
      optInStatus: 'explicit_opt_in',
      optInDate: new Date().toISOString().slice(0, 10),
      optInSource: 'Phone Filter & Telegram Checker',
      assignedToAgentId: currentUser.id,
    }));

    onBulkAddContacts(newContacts);
    setCheckerAddSuccess(true);
    setTimeout(() => setCheckerAddSuccess(false), 4000);
  };

  // Launch Campaign from Contacts
  const handleLaunchCampaignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const recipients =
      campaignTargetGroup === 'all'
        ? contacts
        : contacts.filter((c) => c.group === campaignTargetGroup || c.tags.includes(campaignTargetGroup));

    const newCamp = {
      id: `camp_${Date.now()}`,
      name: campaignName,
      messageText: campaignMessage,
      targetSegment: campaignTargetGroup,
      recipientCount: recipients.length || 1,
      sentCount: recipients.length || 1,
      deliveredCount: recipients.length || 1,
      readCount: Math.round((recipients.length || 1) * 0.85),
      clickedCount: Math.round((recipients.length || 1) * 0.4),
      failedCount: 0,
      unsubscribedCount: 0,
      status: 'running',
      sendRatePerSecond: campaignRate,
      tags: [campaignTargetGroup, 'SMS & Telegram'],
    };

    if (onCreateCampaign) {
      onCreateCampaign(newCamp);
    }
    setCampaignLaunchedSuccess(true);
    setTimeout(() => setCampaignLaunchedSuccess(false), 4500);
  };

  return (
    <div className="space-y-5">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-500" />
              <span>Contact Management Module</span>
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
              Groups, Filter &amp; Campaigns Integrated
            </span>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
              currentUser.role === 'admin'
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                : currentUser.role === 'editor'
                ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
            }`}>
              {currentUser.role === 'admin'
                ? 'Admin Mode'
                : currentUser.role === 'editor'
                ? 'Editor Mode'
                : 'Viewer Mode'}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Manage your contact directory, organize contact groups, route leads to moderators, verify Telegram numbers, and launch broadcast campaigns.
          </p>
        </div>

        {/* Live Chat Direct Navigation Link Button */}
        {onNavigateToLiveChat && (
          <button
            onClick={() => onNavigateToLiveChat()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors shadow-sm shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
            <span>Open Live Chat Menu</span>
            <ExternalLink className="w-3 h-3 text-emerald-400 ml-0.5" />
          </button>
        )}
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('directory')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'directory'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>1. Contacts Directory</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-700/50 text-sky-100">
            {contacts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('groups')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'groups'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>2. Contact Groups</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {groups.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('checker')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'checker'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>3. Phone Filter &amp; Telegram Checker</span>
        </button>

        <button
          onClick={() => setActiveSubTab('campaign')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'campaign'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>4. Campaign Dispatch</span>
        </button>
      </div>

      {/* ==================== SUB-TAB 1: CONTACTS DIRECTORY ==================== */}
      {activeSubTab === 'directory' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search contacts, phone, group..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 w-56 sm:w-64"
                />
              </div>

              {/* Group Filter */}
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">All Groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>

              {/* Stage Filter */}
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">All Stages</option>
                <option value="lead">Lead</option>
                <option value="qualified">Qualified</option>
                <option value="opportunity">Opportunity</option>
                <option value="customer">Customer</option>
              </select>

              {/* Telegram Status Filter */}
              <select
                value={selectedTelegramFilter}
                onChange={(e) => setSelectedTelegramFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">All Telegram</option>
                <option value="verified">Verified Active</option>
                <option value="unverified">No Telegram</option>
              </select>
            </div>

            {/* Buttons: Add Contact, Import, Export */}
            <div className="flex items-center gap-2 flex-wrap">
              {currentUser.role !== 'viewer' && (
                <>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 shadow-sm whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Contact</span>
                  </button>

                  <button
                    onClick={() => {
                      setImportError(null);
                      setIsImportModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-500" />
                    <span>Import CSV</span>
                  </button>
                </>
              )}

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-sky-500" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Bulk Moderator Routing Bar */}
          {currentUser.role !== 'viewer' && moderators.length > 0 && onRouteContactsToModerator && (
            <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="font-semibold text-neutral-800 dark:text-neutral-100">
                  Moderator Delivery Routing:
                </span>
                <select
                  value={bulkTargetModId || moderators[0]?.id || ''}
                  onChange={(e) => setBulkTargetModId(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-medium"
                >
                  {moderators.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (@{m.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedContactIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = bulkTargetModId || moderators[0]?.id;
                      if (!targetId) return;
                      const modName = moderators.find((m) => m.id === targetId)?.name || 'Moderator';
                      onRouteContactsToModerator(targetId, selectedContactIds);
                      setAudienceSavedToast(`Routed ${selectedContactIds.length} selected contact(s) to ${modName}.`);
                      setSelectedContactIds([]);
                      setTimeout(() => setAudienceSavedToast(null), 4000);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                  >
                    Route Selected ({selectedContactIds.length})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const targetId = bulkTargetModId || moderators[0]?.id;
                    if (!targetId) return;
                    const modName = moderators.find((m) => m.id === targetId)?.name || 'Moderator';
                    onRouteContactsToModerator(targetId, 'unassigned');
                    setAudienceSavedToast(`All unassigned communications routed to ${modName}.`);
                    setTimeout(() => setAudienceSavedToast(null), 4000);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-neutral-900 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                >
                  Route Unassigned
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetId = bulkTargetModId || moderators[0]?.id;
                    if (!targetId) return;
                    const modName = moderators.find((m) => m.id === targetId)?.name || 'Moderator';
                    onRouteContactsToModerator(targetId, 'all');
                    setAudienceSavedToast(`All ${contacts.length} communications routed to ${modName} for immediate reply.`);
                    setTimeout(() => setAudienceSavedToast(null), 4000);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-900 dark:bg-purple-600 text-white hover:opacity-90 transition-colors"
                >
                  Route All Contacts ({contacts.length})
                </button>

                {onDistributeRoundRobin && (
                  <button
                    type="button"
                    onClick={() => {
                      onDistributeRoundRobin('all');
                      setAudienceSavedToast(`Evenly distributed all contacts across ${moderators.length} active moderators.`);
                      setTimeout(() => setAudienceSavedToast(null), 4000);
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Round-Robin Split
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Opt-In / Opt-Out & Audience Save Strip */}
          {audienceSavedToast && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{audienceSavedToast}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                Opt-In / Opt-Out Compliance:
              </span>
              <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                {contacts.filter((c) => c.optInStatus === 'explicit_opt_in' || c.optInStatus === 'implicit_opt_in').length} Opted-In
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <span className="tabular-nums text-rose-600 dark:text-rose-400 font-medium">
                {contacts.filter((c) => c.optInStatus === 'opted_out' || c.optInStatus === 'dnc_suppressed').length} Opted-Out (Auto-Suppressed)
              </span>
              {audienceLists.length > 0 && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">·</span>
                  <span className="tabular-nums text-sky-600 dark:text-sky-400 font-medium">
                    {audienceLists.length} Saved Audiences
                  </span>
                </>
              )}
            </div>

            {onSaveAudienceList && currentUser.role !== 'viewer' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Save filtered as Audience..."
                  value={audienceNameInput}
                  onChange={(e) => setAudienceNameInput(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 w-48"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentFilterAsAudience}
                  disabled={!audienceNameInput.trim()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 dark:bg-sky-600 text-white hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                >
                  Save Audience
                </button>
              </div>
            )}
          </div>

          {/* Contacts Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-950/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-8">
                      <input
                        type="checkbox"
                        checked={filteredContacts.length > 0 && filteredContacts.every((c) => selectedContactIds.includes(c.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContactIds(filteredContacts.map((c) => c.id));
                          } else {
                            setSelectedContactIds([]);
                          }
                        }}
                        aria-label="Select all filtered contacts"
                        className="rounded border-neutral-300 dark:border-neutral-700"
                      />
                    </th>
                    <th className="py-3 px-4 font-semibold">Name &amp; Custom Fields</th>
                    <th className="py-3 px-4 font-semibold">Phone Number</th>
                    <th className="py-3 px-4 font-semibold">Telegram</th>
                    <th className="py-3 px-4 font-semibold">Assigned Moderator</th>
                    <th className="py-3 px-4 font-semibold">Opt-In / Opt-Out</th>
                    <th className="py-3 px-4 font-semibold">Stage</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-neutral-400">
                        No contacts match the active filters.
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact) => {
                      const isOptedOut = contact.optInStatus === 'opted_out' || contact.optInStatus === 'dnc_suppressed';
                      const isChecked = selectedContactIds.includes(contact.id);
                      return (
                        <tr key={contact.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition-colors">
                          <td className="py-3 pl-4 pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedContactIds((prev) => [...prev, contact.id]);
                                } else {
                                  setSelectedContactIds((prev) => prev.filter((id) => id !== contact.id));
                                }
                              }}
                              aria-label={`Select ${contact.name}`}
                              className="rounded border-neutral-300 dark:border-neutral-700"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-neutral-900 dark:text-white">{contact.name}</div>
                            {contact.company && (
                              <div className="text-[11px] text-neutral-400">{contact.company}</div>
                            )}
                            {contact.customFields && Object.keys(contact.customFields).length > 0 && (
                              <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 mt-0.5 truncate max-w-xs">
                                {Object.entries(contact.customFields)
                                  .slice(0, 3)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(' · ')}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                            {contact.phoneNumber}
                          </td>
                          <td className="py-3 px-4">
                            {contact.hasTelegram ? (
                              <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-mono text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{contact.telegramUsername ? `@${contact.telegramUsername}` : 'Active UID'}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-neutral-400">Unregistered</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {currentUser.role !== 'viewer' ? (
                              <select
                                value={contact.assignedModeratorId || ''}
                                onChange={(e) => {
                                  if (onAssignModerator) {
                                    onAssignModerator(contact.id, e.target.value);
                                  } else {
                                    onUpdateContact(contact.id, { assignedModeratorId: e.target.value || undefined });
                                  }
                                }}
                                className="px-2 py-1 text-[11px] rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200"
                              >
                                <option value="">Unassigned</option>
                                {moderators.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[11px] text-neutral-500">
                                {moderators.find((m) => m.id === contact.assignedModeratorId)?.name || 'Unassigned'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                                  isOptedOut
                                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                    : contact.optInStatus === 'explicit_opt_in'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {isOptedOut
                                  ? 'Opted-Out'
                                  : contact.optInStatus === 'explicit_opt_in'
                                  ? 'Opted-In'
                                  : 'Implicit'}
                              </span>
                              {currentUser.role !== 'viewer' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateContact(contact.id, {
                                      optInStatus: isOptedOut ? 'explicit_opt_in' : 'opted_out',
                                      optOutTimestamp: isOptedOut ? undefined : new Date().toISOString(),
                                      optOutReason: isOptedOut ? undefined : 'Manual Opt-Out Toggle',
                                    })
                                  }
                                  className="text-[10px] text-neutral-400 hover:text-sky-500 underline"
                                >
                                  {isOptedOut ? 'Re-Opt' : 'Opt-Out'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                              {contact.stage}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {onNavigateToLiveChat && (
                                <button
                                  onClick={() => onNavigateToLiveChat(contact.id)}
                                  title="Open Live Chat with this contact"
                                  className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {currentUser.role !== 'viewer' && (
                                <button
                                  onClick={() => onDeleteContact(contact.id)}
                                  className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                                  title="Delete Contact"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 2: CONTACT GROUPS ==================== */}
      {activeSubTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Contact Groups Management
              </h2>
              <p className="text-xs text-neutral-500">
                Organize leads into dedicated groups and launch targeted broadcasts with one click.
              </p>
            </div>

            {currentUser.role !== 'viewer' && (
              <button
                onClick={() => setIsNewGroupModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 shadow-sm"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create New Group</span>
              </button>
            )}
          </div>

          {/* Group Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {groups.map((grp) => {
              const memberCount = contacts.filter(
                (c) => c.group === grp.name || (c.tags && c.tags.includes(grp.name))
              ).length;

              return (
                <div
                  key={grp.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: grp.color }}
                      />
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                        {grp.name}
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {memberCount} members
                    </span>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                    {grp.description}
                  </p>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        setSelectedGroupFilter(grp.name);
                        setActiveSubTab('directory');
                      }}
                      className="text-sky-600 dark:text-sky-400 font-medium hover:underline"
                    >
                      View Contacts
                    </button>

                    <button
                      onClick={() => {
                        setCampaignTargetGroup(grp.name);
                        setActiveSubTab('campaign');
                      }}
                      className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Launch Broadcast</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: PHONE FILTER & TELEGRAM CHECKER ==================== */}
      {activeSubTab === 'checker' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-sky-500" />
                <span>Phone Number Filter &amp; Telegram Checker</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Batch validate numbers, verify Telegram registration, and save verified contacts straight into your groups.
              </p>
            </div>

            {/* Input Box */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Enter Phone Numbers (One per line):
              </label>
              <textarea
                rows={5}
                value={checkerRawInput}
                onChange={(e) => setCheckerRawInput(e.target.value)}
                placeholder="+880 1712 345678&#10;+1 415 555 2671&#10;+44 7911 123456"
                className="w-full p-3 font-mono text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunChecker}
                  disabled={checkerIsProcessing || !checkerRawInput.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkerIsProcessing ? 'animate-spin' : ''}`} />
                  <span>{checkerIsProcessing ? 'Checking...' : 'Run Telegram Checker'}</span>
                </button>
              </div>

              {checkerResults.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-neutral-500">Target Group:</span>
                  <select
                    value={checkerTargetGroup}
                    onChange={(e) => setCheckerTargetGroup(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleAddVerifiedToGroup}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1.5 shadow-sm"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Save Verified to Group</span>
                  </button>
                </div>
              )}
            </div>

            {checkerAddSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>
                  Verified contacts successfully added to group &quot;{checkerTargetGroup}&quot;!
                </span>
              </div>
            )}

            {/* Results Table */}
            {checkerResults.length > 0 && (
              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    Lookup Results: ({checkerResults.length} numbers)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-semibold">
                      {checkerResults.filter((r) => r.hasTelegram).length} Active Telegram
                    </span>
                    <span>•</span>
                    <span className="text-neutral-400">
                      {checkerResults.filter((r) => !r.hasTelegram).length} Unregistered
                    </span>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
                      <tr>
                        <th className="py-2.5 px-3">Number</th>
                        <th className="py-2.5 px-3">Country</th>
                        <th className="py-2.5 px-3">Telegram Status</th>
                        <th className="py-2.5 px-3">Telegram Handle / UID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                      {checkerResults.map((r, i) => (
                        <tr key={i} className="hover:bg-neutral-50/50">
                          <td className="py-2 px-3 font-mono font-medium">{r.formattedNumber}</td>
                          <td className="py-2 px-3 uppercase text-neutral-500">{r.countryCode || 'N/A'}</td>
                          <td className="py-2 px-3">
                            {r.hasTelegram ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 w-max">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
                                Unregistered
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-sky-600">
                            {r.telegramUsername ? `@${r.telegramUsername}` : r.telegramUid || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 4: CAMPAIGN DISPATCH ==================== */}
      {activeSubTab === 'campaign' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-500" />
                <span>Launch Campaign to Contacts</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Select target group, customize message template with dynamic variables, and launch your campaign.
              </p>
            </div>

            <form onSubmit={handleLaunchCampaignSubmit} className="space-y-4 max-w-2xl">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Campaign Name:
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Target Contact Group:
                </label>
                <select
                  value={campaignTargetGroup}
                  onChange={(e) => setCampaignTargetGroup(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="all">All Contacts</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span>Message Body:</span>
                  <span className="text-[10px] text-sky-600 font-mono">
                    Tags: {'{{name}}'}, {'{{phone}}'}, {'{{company}}'}
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  className="w-full mt-1 p-3 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Speed (msg/sec):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={campaignRate}
                    onChange={(e) => setCampaignRate(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="text-[11px] text-neutral-500 bg-sky-50 dark:bg-sky-950/40 p-2 rounded-lg border border-sky-200 dark:border-sky-800">
                    Dedicated Port 200 Gateway Active.
                  </div>
                </div>
              </div>

              {campaignLaunchedSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>
                    Campaign launched successfully! Live progress tracking active in Campaigns tab.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={currentUser.role === 'viewer'}
                className="px-5 py-2.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40 flex items-center gap-2 shadow-sm shadow-sky-600/20"
              >
                <Zap className="w-4 h-4" />
                <span>Launch Broadcast Now</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD CONTACT MODAL ==================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Add New Contact
            </h3>

            <form onSubmit={handleCreateContactSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Phone Number:
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+8801712345678"
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Group:
                </label>
                <select
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Telegram Handle:
                </label>
                <input
                  type="text"
                  value={formTelegram}
                  onChange={(e) => setFormTelegram(e.target.value)}
                  placeholder="@username"
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== CREATE GROUP MODAL ==================== */}
      {isNewGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Create Contact Group
            </h3>

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Group Name:
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Wholesale Enterprise Clients"
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Description:
                </label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Regular buyers for bulk updates"
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Color:
                </label>
                <div className="flex items-center gap-3 mt-1">
                  {['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewGroupColor(col)}
                      className={`w-6 h-6 rounded-full border-2 ${newGroupColor === col ? 'border-black dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsNewGroupModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SMART CSV / EXCEL INGESTION & OPT-IN COMPLIANCE MODAL ==================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>CSV / Excel Import &amp; Compliance Merge</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  E.164 normalization, merge into existing CRM contacts, and strict Opt-In / Opt-Out enforcement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Default Consent Policy (when CSV omits consent column):
                </label>
                <select
                  value={importDefaultOptIn}
                  onChange={(e) => setImportDefaultOptIn(e.target.value as OptInStatus)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950"
                >
                  <option value="explicit_opt_in">Explicit Opt-In (Verified Consent Lead)</option>
                  <option value="implicit_opt_in">Implicit Opt-In (Send Opt-Out Notice)</option>
                  <option value="opted_out">Opted-Out (Suppress Broadcasts)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSampleCSV}
                    className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-500" />
                    <span>Sample .csv</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSampleExcel}
                    className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Sample .xlsx</span>
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
              <input
                type="checkbox"
                checked={importRunMtprotoCheck}
                onChange={(e) => setImportRunMtprotoCheck(e.target.checked)}
                className="accent-sky-600"
              />
              <span>
                Run silent MTProto Contact Filtering to verify active Telegram accounts during import
              </span>
            </label>

            <div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleSpreadsheetUpload}
                className="w-full text-xs p-3 rounded-lg border border-dashed border-sky-400 bg-sky-50/40 dark:bg-sky-950/20 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Supports <span className="font-mono">.csv</span>, <span className="font-mono">.xlsx</span>, and <span className="font-mono">.xls</span>. Existing opted-out/DNC contacts are never re-opted-in by CSV re-imports.
              </p>
            </div>

            {importError && (
              <div className="p-3 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importSummary && (
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">Total Rows</div>
                    <div className="font-bold tabular-nums">{importSummary.totalRows}</div>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">Valid New</div>
                    <div className="font-bold tabular-nums text-emerald-600">{importSummary.validNew}</div>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">Existing Merge</div>
                    <div className="font-bold tabular-nums text-sky-600">{importSummary.mergedExisting}</div>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">Opt-Out Enforced</div>
                    <div className="font-bold tabular-nums text-rose-600">{importSummary.optOutPreserved}</div>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[10px] text-neutral-400">CSV Duplicates</div>
                    <div className="font-bold tabular-nums text-amber-600">{importSummary.duplicatesSkipped}</div>
                  </div>
                </div>

                {csvPreviewRows.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-500">
                        <tr>
                          <th className="py-1.5 px-2.5">Name</th>
                          <th className="py-1.5 px-2.5">Phone (E.164)</th>
                          <th className="py-1.5 px-2.5">Action</th>
                          <th className="py-1.5 px-2.5">Compliance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                        {csvPreviewRows.slice(0, 6).map((r, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-2.5 font-medium truncate max-w-[130px]">{r.name}</td>
                            <td className="py-1.5 px-2.5 font-mono tabular-nums">{r.phoneNumber}</td>
                            <td className="py-1.5 px-2.5">
                              <span className={r.isExistingMerge ? 'text-sky-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                                {r.isExistingMerge ? 'Merge Existing' : 'New Contact'}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5">
                              <span
                                className={
                                  r.optInStatus === 'opted_out' || r.optInStatus === 'dnc_suppressed'
                                    ? 'text-rose-600 font-semibold'
                                    : r.optInStatus === 'implicit_opt_in'
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }
                              >
                                {r.complianceAction === 'opt_out_preserved'
                                  ? 'Opt-Out Preserved'
                                  : r.complianceAction === 'opt_out_applied'
                                  ? 'Opt-Out Applied'
                                  : r.optInStatus === 'opted_out'
                                  ? 'Opted-Out'
                                  : r.optInStatus === 'dnc_suppressed'
                                  ? 'DNC Suppressed'
                                  : r.optInStatus === 'implicit_opt_in'
                                  ? 'Implicit Opt-In'
                                  : 'Explicit Opt-In'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {importSummary.detectedVariables.length > 0 && (
                  <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
                    Detected Campaign Variables:{' '}
                    <span className="font-mono text-sky-600 dark:text-sky-400">
                      {importSummary.detectedVariables.map((v) => `{{${v}}}`).join(', ')}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Save as Reusable Audience List Name:
                  </label>
                  <input
                    type="text"
                    value={importAudienceName}
                    onChange={(e) => setImportAudienceName(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing || csvPreviewRows.length === 0}
                onClick={handleConfirmImport}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 whitespace-nowrap"
              >
                {importing ? 'Processing...' : `Import & Merge ${csvPreviewRows.length} Contacts`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
