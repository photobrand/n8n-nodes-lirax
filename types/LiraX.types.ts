import type { IDataObject } from 'n8n-workflow';

// ==================== CREDENTIALS TYPES ====================
export interface LiraXCredentials {
  baseUrl: string;
  secondaryBaseUrl?: string;
  token: string;
  incomingToken: string;
  sslVerify: boolean;
  timeoutMs: number;
  retries: number;
  backoffBaseMs: number;
  fixedDelayMs?: number;
  jitter?: boolean;
  retryPolicy: 'exponential' | 'linear' | 'fixed' | 'none';
}

// ==================== CACHE TYPES ====================
export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  entries: Array<{
    key: string;
    age: number;
    ttl: number;
    expired: boolean;
  }>;
}

export interface IdempotencyOptions {
  enabled: boolean;
  key?: string;
  ttl?: number;
}

// ==================== CACHE PROVIDER TYPES ====================
export type CacheProviderType = 'memory' | 'redis' | 'file';

export interface CacheProviderOptions {
  // Redis
  redisUrl?: string;
  redisTls?: boolean;
  redisPassword?: string;
  redisDb?: number;
  // File
  fileCachePath?: string;
  // Common
  ttl?: number;
  keyPrefix?: string;
}

export interface CacheConfig {
  provider: CacheProviderType;
  options: CacheProviderOptions;
}

// ==================== VALIDATION TYPES ====================
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PhoneValidationResult extends ValidationResult {
  normalized: string;
  original: string;
}

// ==================== WEBHOOK TYPES ====================
export interface LiraXWebhookPayload {
  cmd: string;
  from_LiraX_token?: string;
  [key: string]: any;
}

export interface ContactLookupResponse {
  contact_name: string;
  responsible: string;
  [key: string]: any;
}

export interface WebhookResponsePayload {
  body: any;
  headers?: Record<string, string>;
  statusCode?: number;
}

// ==================== ERROR HANDLING TYPES ====================
export interface ErrorContext {
  node: any;
  operation: string;
  payload?: IDataObject;
  message?: string;
  resource?: string;
}

export interface FailoverErrorContext extends ErrorContext {
  failoverAttempts: number;
  errors: Array<{
    attempt: number;
    message: string;
    code?: string;
  }>;
}

// ==================== TELEPHONY OPERATIONS ====================
export interface MakeCallPayload {
  cmd: 'makeCall';
  from: string;
  to: string;
  idshop?: number;
}

export interface KillCallPayload {
  cmd: 'killCall';
  Call_id: string;
}

export interface Make2CallsPayload {
  cmd: 'make2Calls';
  from: string;
  to1: string;
  to2: string;
  speech?: string;
  atmepo?: string;
  timeout: number;
  successtime: number;
  notbefore: string;
  notafter: string;
  vtime?: string;
  vdate?: string;
  vmoney?: string;
  FirstInternal: number;
  SecondInternal: number;
  SpeechNoWait: number;
  idshop?: number;
}

export interface AskQuestionPayload {
  cmd: 'AskQuestion';
  from: string;
  to1: string;
  hello?: string;
  text1?: string;
  text2?: string;
  text3?: string;
  text4?: string;
  bye?: string;
  ask: string;
  ok: string;
  cburl?: string;
  idshop?: number;
}

export interface SetCallLostPayload {
  cmd: 'set_call_lost';
  phone: string;
  ext: string;
  time_plan: number;
  max_try: number;
  interval: number;
  minutes?: number;
  hours?: number;
  days?: number;
  weeks?: number;
  months?: number;
  info?: string;
}

export interface GetCallsPayload {
  cmd: 'get_calls';
  date_start: string;
  date_finish: string;
  call_type?: number;
  ani?: string;
  dnis?: string;
  offset: number;
}

export interface GetMakeCallDataPayload {
  cmd: 'get_makecall_data';
  id_makecall: string;
}

// ==================== CRM OPERATIONS ====================
export interface CheckContactPayload {
  cmd: 'checkContact';
  ext: string;
  ani: string;
  name: string;
  add_phone?: string;
  emails?: string;
  trackid?: string;
  clientid?: string;
  sitename?: string;
  source?: string;
  stype?: string;
  campain?: string;
  Term?: string;
  tag?: string;
}

export interface GetContactPayload {
  cmd: 'getContact';
  ani?: string;
  email?: string;
}

export interface CreateTaskPayload {
  cmd: 'createTask';
  ext: string;
  ani?: string;
  email?: string;
  text: string;
  department?: string;
  date?: string;
  type?: number;
  webhook?: string;
}

export interface CreateDealPayload {
  cmd: 'createDeal';
  ext: string;
  ani: string;
  name: string;
  sum: number;
  stage: number;
  status?: number;
}

export interface UpdateDealPayload {
  cmd: 'updateDeal';
  id_deal: number;
  ext: string;
  ani: string;
  name: string;
  sum: number;
  stage: number;
  status?: number;
}

export interface CreateNotePayload {
  cmd: 'createNote';
  ext: string;
  ani: string;
  text: string;
}

export interface AddTagPayload {
  cmd: 'AddTag';
  ext: string;
  ani: string;
  tag: string;
}

export interface DelTagPayload {
  cmd: 'DelTag';
  ext: string;
  ani: string;
  tag: string;
}

export interface AddTaskResultPayload {
  cmd: 'AddTaskResult';
  idtask: number;
  result: string;
}

export interface GetStagesPayload {
  cmd: 'getStages';
}

export interface GetShopsPayload {
  cmd: 'getShops';
}

export interface GetStatInfoPayload {
  cmd: 'getStatInfo',
  Start: string;
  Stop?: string;
}

export interface GetUserStatusesPayload {
  cmd: 'getUserStatuses';
}

// ==================== MESSAGING OPERATIONS ====================
export interface SendSMSPayload {
  cmd: 'sendSMS';
  ext: string;
  provider: string;
  phone: string;
  text: string;
}

export interface CheckSMSPayload {
  cmd: 'checkSMS';
  ext: string;
  provider: string;
  id_sms: number;
}

export interface SendMsgPayload {
  cmd: 'sendMsg';
  ext: string;
  ani: string;
  text: string;
}

export interface SendCloudMessagePayload {
  cmd: 'send_cloud_message';
  client?: string;
  ani?: string;
  text: string;
}

// ==================== CAMPAIGNS OPERATIONS ====================
export interface AddCampaignPayload {
  cmd: 'AddCampaign';
  from: string;
  ext?: string;
  days?: string;
  time?: string;
  try?: number;
  type?: number;
  phones: string;
  message?: string;
  pdd?: number;
  preview_timeout?: number;
}

export interface AddPhoneCampaignPayload {
  cmd: 'AddPhoneCampaign';
  from: string;
  phones: string;
}

// ==================== BLACKLIST OPERATIONS ====================
export interface BlacklistPhonePayload {
  cmd: 'addBlackPhone' | 'delBlackPhone' | 'listBlackPhone';
  phone?: string;
}

export interface BlacklistIPPayload {
  cmd: 'addBlackIP' | 'delBlackIP' | 'listBlackIP';
  ip?: string;
}

// ==================== SIP OPERATIONS ====================
export interface GetUserSipsPayload {
  cmd: 'getUserSips';
  ext: string;
}

export interface GetSipRouteInPayload {
  cmd: 'get_sip_route_in';
  ext: string;
}


export interface SetSipRouteInPayload {
  cmd: 'set_sip_route_in';
  ext: string;
  sip_number: string;
  priority: number;
  time_plan: number;
}

// ==================== PRESENCE OPERATIONS ====================
export interface PresencePayload {
  cmd: 'IsFreeUsers' | 'IsCalling';
}

export interface InitStatusesPayload {
  cmd: 'initStatuses';
}

// ==================== UTILITY OPERATIONS ====================
export interface PhoneEncodingPayload {
  cmd: 'EncodePhone' | 'DecodePhone';
  phone: string;
}

// ==================== RESPONSE TYPES ====================
export interface LiraXApiResponse {
  success?: boolean;
  error?: string;
  [key: string]: any;
}

export interface BatchOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  itemIndex: number;
}

export interface OperationMetadata {
  resource: string;
  operation: string;
  timestamp: string;
  idempotencyKey?: string;
  fromCache?: boolean;
  idempotencyHit?: boolean;
  cacheType?: 'new' | 'legacy';
}

// ==================== LOAD OPTIONS TYPES ====================
export interface LoadOptionsItem {
  name: string;
  value: string | number;
  description?: string;
}

export interface UserOption extends LoadOptionsItem {
  ext: string;
  Name: string;
  active?: string;
}

export interface ShopOption extends LoadOptionsItem {
  id: number;
  name: string;
}

export interface StageOption extends LoadOptionsItem {
  stage: number;
  title: string;
}

export interface StatusOption extends LoadOptionsItem {
  id: number;
  name: string;
}

// ==================== WEBHOOK EVENT TYPES ====================
export interface WebhookContactEvent {
  event: 'contact';
  event_type: 'contact_lookup';
  phone: string;
  callid: string;
  diversion?: string;
  timestamp: string;
  metadata: {
    description: string;
    action_required: string;
    requires_response: boolean;
  };
  raw: IDataObject;
}

export interface WebhookCallEvent {
  event: 'call';
  event_type: string;
  call_type: string;
  phone: string;
  diversion?: string;
  ext: string;
  callid: string;
  duration?: string;
  call_duration?: string;
  is_recorded?: string;
  status?: string;
  record_link?: string;
  keys: Array<{ivr_name: string; ivr_entry: string; key: string; timestamp?: string}>;
  utm: {
    tid?: string;
    cid?: string;
    cs?: string;
    cm?: string;
    cc?: string;
    ct?: string;
  };
  timestamp: string;
  metadata: {
    description: string;
    priority: string;
  };
  raw: IDataObject;
}

export interface WebhookRecordEvent {
  event: 'record';
  event_type: 'recording_available';
  callid: string;
  record_link: string;
  timestamp: string;
  metadata: {
    description: string;
    action_required: string;
  };
  raw: IDataObject;
}

export interface WebhookSMSEvent {
  event: 'sms';
  event_type: 'sms_received' | 'sms_delivered';
  id_sms?: number;
  ani?: string;
  provider?: string;
  text?: string;
  timestamp: string;
  metadata: {
    description: string;
    direction: 'inbound' | 'outbound';
  };
  raw: IDataObject;
}

export interface WebhookStatusEvent {
  event: 'presence';
  event_type: 'status_changed';
  ext: string;
  status: string;
  timestamp: string;
  metadata: {
    description: string;
    status_meanings: {
      '1': string;
      '2': string;
      '3': string;
      '4': string;
    };
  };
  raw: IDataObject;
}

export interface WebhookOperationEvent {
  event: 'operation';
  event_type: 'makecall_finished' | 'make2calls_finished';
  id_makecall?: string;
  Call_id?: string;
  success: number;
  id_make2calls?: string;
  duration_success?: string;
  keys: Array<{ivr_name: string; ivr_entry: string; key: string; timestamp?: string}>;
  timestamp: string;
  metadata: {
    description: string;
    success: boolean;
    call_established?: boolean;
    has_ivr_results?: boolean;
    ivr_path?: string;
    ivr_analytics?: IDataObject;
  };
  raw: IDataObject;
}

export interface WebhookUnknownEvent {
  event: 'unknown';
  event_type: string;
  timestamp: string;
  metadata: {
    description: string;
    warning: string;
  };
  raw: IDataObject;
}

// ==================== CIRCUIT BREAKER TYPES ====================
export interface CircuitBreakerStats {
  state: string;
  failures: number;
  lastFailureTime: number;
  halfOpenAttempts: number;
}

// ==================== ADVANCED SETTINGS TYPES ====================
export interface AdvancedSettings {
  customId?: string;
  timeoutOverride?: number;
  disableRetry?: boolean;
  bypassCache?: boolean;
  idempotencyKey?: string;
  batchSize?: number;
  delayBetweenBatchesMs?: number;
  // НОВЫЕ ПОЛЯ ДЛЯ КЭШИРОВАНИЯ
  cacheProvider?: CacheProviderType;
  redisUrl?: string;
  redisTls?: boolean;
  fileCachePath?: string;
  cacheKeyPrefix?: string;
  cacheTTL?: number;
}

// ==================== BATCH PROCESSING TYPES ====================
export interface BatchProcessingOptions {
  batchSize: number;
  delayBetweenBatchesMs: number;
  rateLimits?: Map<string, { interval: number; lastCall: number }>;
}

// ==================== IVR ANALYTICS TYPES ====================
export interface IVRKeyAnalysis {
  total_steps: number;
  full_path: string;
  last_step: {ivr_name: string; ivr_entry: string; key: string; timestamp?: string};
  first_step: {ivr_name: string; ivr_entry: string; key: string; timestamp?: string};
  time_analysis?: {
    total_duration: number;
    average_step_time: number;
  };
}

// ==================== AI TOOL TYPES ====================
export interface AIToolSettings {
  includeSummary?: boolean;
  standardizedOutput?: boolean;
  errorMode?: 'strict' | 'lenient' | 'silent';
  includeRawResponse?: boolean;
  confidenceThreshold?: number;
}

export interface AIStandardizedOutput {
  tool: string;
  operation: string;
  timestamp: string;
  success: boolean;
  data?: any;
  error?: string;
  confidence: number;
  summary?: string;
  _standardized?: {
    type: string;
    operation: string;
    result: string;
    data: any;
    confidence: number;
    actionable: boolean;
    nextSteps: string[];
    context: IDataObject;
    suggestedNextTools?: string[];
  };
  rawResponse?: any;
}

// Union тип для всех payload операций
export type LiraXOperationPayload =
  | MakeCallPayload
  | KillCallPayload
  | Make2CallsPayload
  | AskQuestionPayload
  | SetCallLostPayload
  | GetCallsPayload
  | GetMakeCallDataPayload
  | CheckContactPayload
  | GetContactPayload
  | CreateTaskPayload
  | CreateDealPayload
  | UpdateDealPayload
  | CreateNotePayload
  | AddTagPayload
  | DelTagPayload
  | AddTaskResultPayload
  | GetStagesPayload
  | GetShopsPayload
  | GetStatInfoPayload
  | GetUserStatusesPayload
  | SendSMSPayload
  | CheckSMSPayload
  | SendMsgPayload
  | SendCloudMessagePayload
  | AddCampaignPayload
  | AddPhoneCampaignPayload
  | BlacklistPhonePayload
  | BlacklistIPPayload
  | GetUserSipsPayload
  | GetSipRouteInPayload
  | SetSipRouteInPayload
  | PresencePayload
  | InitStatusesPayload
  | PhoneEncodingPayload;

// Union тип для всех вебхук событий
export type LiraXWebhookEvent =
  | WebhookContactEvent
  | WebhookCallEvent
  | WebhookRecordEvent
  | WebhookSMSEvent
  | WebhookStatusEvent
  | WebhookOperationEvent
  | WebhookUnknownEvent;

// Union тип для всех load options
export type LiraXLoadOptions =
  | UserOption
  | ShopOption
  | StageOption
  | StatusOption;

// Тип для результатов операций
export interface LiraXOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: OperationMetadata;
  _lirax?: {
    resource: string;
    operation: string;
    timestamp: string;
    idempotencyKey?: string;
  };
}

// Тип для результатов с кэшированием
export interface CachedOperationResult extends LiraXOperationResult {
  _meta?: {
    fromCache: boolean;
    idempotencyHit?: boolean;
    cacheType?: 'new' | 'legacy';
  };
}