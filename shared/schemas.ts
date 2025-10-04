import { z } from 'zod';
import { IDataObject } from 'n8n-workflow';

// ==================== БАЗОВЫЕ СХЕМЫ ВАЛИДАЦИИ ====================

export const phoneSchema = z.string().min(1).max(20).transform((val) =>
  val.replace(/[^\d]/g, '') // Нормализация до только цифр
);

export const extSchema = z.string().min(1).max(10).regex(/^\d+$/);
export const emailSchema = z.string().email();
export const dateTimeSchema = z.string().datetime();
export const sqlDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
export const urlSchema = z.string().url();
export const idSchema = z.number().int().positive();

// Преобразование boolean в строки "0"/"1" согласно спецификации API
export const booleanToStringSchema = z.boolean().transform(val => val ? '1' : '0');
export const optionalBooleanToStringSchema = z.boolean().transform(val => val ? '1' : '0').optional();

// Преобразование чисел в строки согласно спецификации API
export const numberToStringSchema = z.union([
  z.string().min(1),
  z.number().transform(n => n.toString())
]);

export const optionalNumberToStringSchema = z.union([
  z.string().min(1).optional(),
  z.number().transform(n => n.toString()).optional()
]);

// ==================== TELEPHONY SCHEMAS ====================

export const makeCallSchema = z.object({
  cmd: z.literal('makeCall'),
  from: extSchema,
  to: phoneSchema,
  idshop: optionalNumberToStringSchema,
});

export const killCallSchema = z.object({
  cmd: z.literal('killCall'),
  Call_id: z.string().min(1),
});

export const make2CallsSchema = z.object({
  cmd: z.literal('make2Calls'),
  from: extSchema,
  to1: phoneSchema,
  to2: z.union([phoneSchema, urlSchema]),
  speech: z.string().optional(),
  atmepo: z.string().optional(),
  timeout: numberToStringSchema,
  successtime: numberToStringSchema,
  notbefore: optionalNumberToStringSchema,
  notafter: optionalNumberToStringSchema,
  vtime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  vdate: z.string().regex(/^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$|^today$|^tomorrow$/).optional(),
  vmoney: z.string().regex(/^\d+(\.\d{2})?$/).optional(),
  FirstInternal: optionalBooleanToStringSchema,
  SecondInternal: optionalBooleanToStringSchema,
  SpeechNoWait: optionalBooleanToStringSchema,
  idshop: optionalNumberToStringSchema,
});

export const askQuestionSchema = z.object({
  cmd: z.literal('AskQuestion'),
  from: extSchema,
  to1: phoneSchema,
  hello: z.string().optional(),
  text1: z.string().optional(),
  text2: z.string().optional(),
  text3: z.string().optional(),
  text4: z.string().optional(),
  bye: z.string().optional(),
  ask: z.string().min(1),
  ok: z.string().min(1),
  cburl: urlSchema.optional(),
  idshop: optionalNumberToStringSchema,
});

export const setCallLostSchema = z.object({
  cmd: z.literal('set_call_lost'),
  phone: phoneSchema,
  ext: extSchema,
  time_plan: numberToStringSchema, 
  max_try: numberToStringSchema,   
  interval: numberToStringSchema.refine(
    (val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num % 6 === 0;
    },
    {
      message: 'Interval must be a multiple of 6 (e.g., 6, 12, 18, 24, 30, ...)',
    }
  ),
  info: z.string().optional(),
  minutes: optionalNumberToStringSchema,
  hours: optionalNumberToStringSchema,
  days: optionalNumberToStringSchema,
  weeks: optionalNumberToStringSchema,
  months: optionalNumberToStringSchema,
});

export const getMakeCallDataSchema = z.object({
  cmd: z.literal('get_makecall_data'),
  id_makecall: numberToStringSchema,
});

export const getCallsSchema = z.object({
  cmd: z.literal('get_calls'),
  date_start: sqlDateTimeSchema, 
  date_finish: sqlDateTimeSchema,
  call_type: z.union([z.literal('-1'), z.literal('0'), z.literal('1')]).optional(), 
  ani: phoneSchema.optional(),
  dnis: phoneSchema.optional(),
  offset: optionalNumberToStringSchema,
});

// ==================== CRM SCHEMAS ====================

export const checkContactSchema = z.object({
  cmd: z.literal('checkContact'),
  ext: extSchema,
  ani: phoneSchema,
  name: z.string().min(1),
  add_phone: z.string().optional(),
  emails: z.string().optional(),
  trackid: z.string().optional(),
  clientid: z.string().optional(),
  sitename: z.string().optional(),
  source: z.string().optional(),
  stype: z.string().optional(),
  campain: z.string().optional(),
  Term: z.string().optional(),
  tag: z.string().optional(),
});

export const getContactSchema = z.object({
  cmd: z.literal('getContact'),
  ani: phoneSchema.optional(),
  email: emailSchema.optional(),
}).refine(data => data.ani || data.email, {
  message: "Either 'ani' or 'email' must be provided"
});

export const createTaskSchema = z.object({
  cmd: z.literal('createTask'),
  ext: extSchema,
  ani: phoneSchema.optional(),
  email: emailSchema.optional(),
  text: z.string().min(1),
  department: z.string().optional(),
  date: sqlDateTimeSchema.optional(),
  type: z.union([z.literal('1'), z.literal('2'), z.literal('3')]),
  webhook: urlSchema.optional(),
});

export const createDealSchema = z.object({
  cmd: z.literal('createDeal'),
  ext: extSchema,
  ani: phoneSchema,
  name: z.string().min(1),
  sum: numberToStringSchema,
  stage: numberToStringSchema,
  status: z.union([z.literal('0'), z.literal('1'), z.literal('2')]).optional(),
});

export const updateDealSchema = z.object({
  cmd: z.literal('updateDeal'),
  id_deal: numberToStringSchema,
  ext: extSchema,
  ani: phoneSchema,
  name: z.string().min(1),
  sum: numberToStringSchema,
  stage: numberToStringSchema,
  status: z.union([z.literal('0'), z.literal('1'), z.literal('2')]),
});

export const createNoteSchema = z.object({
  cmd: z.literal('createNote'),
  ext: extSchema,
  ani: phoneSchema,
  text: z.string().min(1),
});

export const addTagSchema = z.object({
  cmd: z.literal('AddTag'),
  ani: phoneSchema,
  tag: z.string().min(1),
});

export const delTagSchema = z.object({
  cmd: z.literal('DelTag'),
  ani: phoneSchema,
  tag: z.string().min(1),
});

export const addTaskResultSchema = z.object({
  cmd: z.literal('AddTaskResult'),
  ext: extSchema,
  idtask: numberToStringSchema,
  text: z.string().min(1),
  newext: extSchema.optional(),
  finish: booleanToStringSchema,
});

// ==================== STATISTICS SCHEMAS ====================

export const getStatInfoSchema = z.object({
  cmd: z.literal('getStatInfo'),
  Start: sqlDateTimeSchema,
  Stop: sqlDateTimeSchema.optional(),
});

// ==================== MESSAGING SCHEMAS ====================

export const sendSMSSchema = z.object({
  cmd: z.literal('sendSMS'),
  ext: extSchema,
  provider: z.string().min(1),
  phone: phoneSchema,
  text: z.string().min(1),
});

export const checkSMSSchema = z.object({
  cmd: z.literal('checkSMS'),
  ext: extSchema,
  provider: z.string().min(1),
  id_sms: numberToStringSchema,
});

export const sendMsgSchema = z.object({
  cmd: z.literal('sendMsg'),
  ext: extSchema,
  ani: phoneSchema,
  text: z.string().min(1),
});

export const sendCloudMessageSchema = z.object({
  cmd: z.literal('send_cloud_message'),
  client: z.string().optional(),
  ani: phoneSchema.optional(),
  text: z.string().min(1),
}).refine(data => data.client || data.ani, {
  message: "Either 'client' or 'ani' must be provided"
});

// ==================== PRESENCE SCHEMAS ====================

export const IsFreeUsersSchema = z.object({
    cmd: z.literal('IsFreeUsers'),
    phones: z.string().min(1),
});

export const IsCallingSchema = z.object({ 
    cmd: z.literal('IsCalling'),
    phones: z.string().min(1),
});

export const initStatusesSchema = z.object({
  cmd: z.literal('initStatuses'),
});

// ==================== DIRECTORY SCHEMAS ====================

export const getUsersSchema = z.object({
  cmd: z.literal('getUsers'),
});

export const getShopsSchema = z.object({
  cmd: z.literal('getShops'),
});

export const getStagesSchema = z.object({
  cmd: z.literal('getStages'),
});

export const getUserStatusesSchema = z.object({
  cmd: z.literal('getUserStatuses'),
});

export const getUserSipsSchema = z.object({
  cmd: z.literal('getUserSips'),
  ext: extSchema,
  web: optionalBooleanToStringSchema,
});

// ==================== SIP ROUTING SCHEMAS ====================

export const getSipRouteInSchema = z.object({
  cmd: z.literal('get_sip_route_in'),
  phone: phoneSchema,
});


export const setSipRouteInSchema = z.object({
  cmd: z.literal('set_sip_route_in'),
  phone: phoneSchema,
  sip_number: z.string().min(1),
  priority: numberToStringSchema,
  time_plan: numberToStringSchema,
});

// ==================== BLACKLIST SCHEMAS ====================

export const addBlackPhoneSchema = z.object({
  cmd: z.literal('addBlackPhone'),
  phone: phoneSchema,
});

export const delBlackPhoneSchema = z.object({
  cmd: z.literal('delBlackPhone'),
  phone: phoneSchema,
});

export const listBlackPhoneSchema = z.object({
  cmd: z.literal('listBlackPhone'),
});

export const addBlackIPSchema = z.object({
  cmd: z.literal('addBlackIP'),
  IP: z.string().ip(),
});

export const delBlackIPSchema = z.object({
  cmd: z.literal('delBlackIP'),
  IP: z.string().ip(),
});

export const listBlackIPSchema = z.object({
  cmd: z.literal('listBlackIP'),
});

// ==================== CAMPAIGNS SCHEMAS ====================

export const addCampaignSchema = z.object({
  cmd: z.literal('AddCampaign'),
  from: extSchema,
  ext: extSchema.optional(),
  days: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  try: numberToStringSchema,
  type: z.union([z.literal('1'), z.literal('2')]),
  phones: z.string().min(1),
  message: z.string().optional(),
  pdd: optionalNumberToStringSchema,
  preview_timeout: optionalNumberToStringSchema,
  idshop: optionalNumberToStringSchema,
});

export const addPhoneCampaignSchema = z.object({
  cmd: z.literal('AddPhoneCampaign'),
  from: extSchema,
  phones: z.string().min(1),
});

// ==================== UTILITY SCHEMAS ====================

export const encodePhoneSchema = z.object({
  cmd: z.literal('EncodePhone'),
  phone: phoneSchema,
});

export const decodePhoneSchema = z.object({
  cmd: z.literal('DecodePhone'),
  phone: phoneSchema,
});

// ==================== TYPES ====================

export type MakeCallParams = z.infer<typeof makeCallSchema>;
export type KillCallParams = z.infer<typeof killCallSchema>;
export type Make2CallsParams = z.infer<typeof make2CallsSchema>;
export type AskQuestionParams = z.infer<typeof askQuestionSchema>;
export type SetCallLostParams = z.infer<typeof setCallLostSchema>;
export type GetMakeCallDataParams = z.infer<typeof getMakeCallDataSchema>;
export type GetCallsParams = z.infer<typeof getCallsSchema>;
export type CheckContactParams = z.infer<typeof checkContactSchema>;
export type GetContactParams = z.infer<typeof getContactSchema>;
export type CreateTaskParams = z.infer<typeof createTaskSchema>;
export type CreateDealParams = z.infer<typeof createDealSchema>;
export type UpdateDealParams = z.infer<typeof updateDealSchema>;
export type CreateNoteParams = z.infer<typeof createNoteSchema>;
export type AddTagParams = z.infer<typeof addTagSchema>;
export type DelTagParams = z.infer<typeof delTagSchema>;
export type AddTaskResultParams = z.infer<typeof addTaskResultSchema>;
export type GetUsersParams = z.infer<typeof getUsersSchema>;
export type GetShopsParams = z.infer<typeof getShopsSchema>;
export type GetStagesParams = z.infer<typeof getStagesSchema>;
export type GetUserStatusesParams = z.infer<typeof getUserStatusesSchema>;
export type GetStatInfoParams = z.infer<typeof getStatInfoSchema>;
export type SendSMSParams = z.infer<typeof sendSMSSchema>;
export type CheckSMSParams = z.infer<typeof checkSMSSchema>;
export type SendMsgParams = z.infer<typeof sendMsgSchema>;
export type SendCloudMessageParams = z.infer<typeof sendCloudMessageSchema>;
export type IsFreeUsersParams = z.infer<typeof IsFreeUsersSchema>;
export type IsCallingParams = z.infer<typeof IsCallingSchema>;
export type InitStatusesParams = z.infer<typeof initStatusesSchema>;
export type GetUserSipsParams = z.infer<typeof getUserSipsSchema>;
export type GetSipRouteInParams = z.infer<typeof getSipRouteInSchema>;
export type SetSipRouteInParams = z.infer<typeof setSipRouteInSchema>;
export type AddBlackPhoneParams = z.infer<typeof addBlackPhoneSchema>;
export type DelBlackPhoneParams = z.infer<typeof delBlackPhoneSchema>;
export type ListBlackPhoneParams = z.infer<typeof listBlackPhoneSchema>;
export type AddBlackIPParams = z.infer<typeof addBlackIPSchema>;
export type DelBlackIPParams = z.infer<typeof delBlackIPSchema>;
export type ListBlackIPParams = z.infer<typeof listBlackIPSchema>;
export type AddCampaignParams = z.infer<typeof addCampaignSchema>;
export type AddPhoneCampaignParams = z.infer<typeof addPhoneCampaignSchema>;
export type EncodePhoneParams = z.infer<typeof encodePhoneSchema>;
export type DecodePhoneParams = z.infer<typeof decodePhoneSchema>;

export type LiraXApiParams =
  | MakeCallParams
  | KillCallParams
  | Make2CallsParams
  | AskQuestionParams
  | SetCallLostParams
  | GetMakeCallDataParams
  | GetCallsParams
  | CheckContactParams
  | GetContactParams
  | CreateTaskParams
  | CreateDealParams
  | UpdateDealParams
  | CreateNoteParams
  | AddTagParams
  | DelTagParams
  | AddTaskResultParams
  | GetUsersParams
  | GetShopsParams
  | GetStagesParams
  | GetUserStatusesParams
  | GetStatInfoParams
  | SendSMSParams
  | CheckSMSParams
  | SendMsgParams
  | SendCloudMessageParams
  | IsFreeUsersParams
  | IsCallingParams
  | InitStatusesParams
  | GetUserSipsParams
  | GetSipRouteInParams
  | SetSipRouteInParams
  | AddBlackPhoneParams
  | DelBlackPhoneParams
  | ListBlackPhoneParams
  | AddBlackIPParams
  | DelBlackIPParams
  | ListBlackIPParams
  | AddCampaignParams
  | AddPhoneCampaignParams
  | EncodePhoneParams
  | DecodePhoneParams;

// ==================== SCHEMA REGISTRY ====================

export class SchemaRegistry {
  private static schemas: Map<string, z.ZodSchema<any>> = new Map([
    // Telephony
    ['makeCall', makeCallSchema],
    ['killCall', killCallSchema],
    ['make2Calls', make2CallsSchema],
    ['AskQuestion', askQuestionSchema],
    ['set_call_lost', setCallLostSchema],
    ['get_makecall_data', getMakeCallDataSchema],
    ['get_calls', getCallsSchema],

    // CRM
    ['checkContact', checkContactSchema],
    ['getContact', getContactSchema],
    ['createTask', createTaskSchema],
    ['createDeal', createDealSchema],
    ['updateDeal', updateDealSchema],
    ['createNote', createNoteSchema],
    ['AddTag', addTagSchema],
    ['DelTag', delTagSchema],
    ['AddTaskResult', addTaskResultSchema],

    // Directories
    ['getUsers', getUsersSchema],
    ['getShops', getShopsSchema],
    ['getStages', getStagesSchema],
    ['getUserStatuses', getUserStatusesSchema],
    ['getStatInfo', getStatInfoSchema],

    // Messaging
    ['sendSMS', sendSMSSchema],
    ['checkSMS', checkSMSSchema],
    ['sendMsg', sendMsgSchema],
    ['send_cloud_message', sendCloudMessageSchema],

    // Presence
    ['IsFreeUsers', IsFreeUsersSchema],
    ['IsCalling', IsCallingSchema],
    ['initStatuses', initStatusesSchema],

    // SIP
    ['getUserSips', getUserSipsSchema],
    ['get_sip_route_in', getSipRouteInSchema],
    ['set_sip_route_in', setSipRouteInSchema],

    // Blacklist
    ['addBlackPhone', addBlackPhoneSchema],
    ['delBlackPhone', delBlackPhoneSchema],
    ['listBlackPhone', listBlackPhoneSchema],
    ['addBlackIP', addBlackIPSchema],
    ['delBlackIP', delBlackIPSchema],
    ['listBlackIP', listBlackIPSchema],

    // Campaigns
    ['AddCampaign', addCampaignSchema],
    ['AddPhoneCampaign', addPhoneCampaignSchema],

    // Utility
    ['EncodePhone', encodePhoneSchema],
    ['DecodePhone', decodePhoneSchema],
  ]);

  public static getSchema(operation: string): z.ZodSchema<any> {
    const schema = this.schemas.get(operation);
    if (!schema) {
      throw new Error(`No schema found for operation: ${operation}`);
    }
    return schema;
  }

  public static registerSchema(operation: string, schema: z.ZodSchema<any>): void {
    this.schemas.set(operation, schema);
  }

  public static validate(operation: string, data: IDataObject): LiraXApiParams {
    const schema = this.getSchema(operation);
    return schema.parse(data);
  }

  public static getAllRegisteredOperations(): string[] {
    return Array.from(this.schemas.keys());
  }
}