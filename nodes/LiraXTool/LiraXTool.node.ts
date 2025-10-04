import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeApiError,
  IDataObject,
  INodePropertyOptions,
} from 'n8n-workflow';

import type { LiraXCredentials } from '../../types/LiraX.types';
import {
  liraxRequest,
  normalizePhoneDigits,
  validatePhoneNumber,
  validateEmail,
  formatDateTimeSQL,
  validateTimeWindow48h,
  LiraXErrorHandler,
  sanitizePhoneForLog,
} from '../../shared/LiraX.utils';
import { SchemaRegistry } from '../../shared/schemas';

let zodToJsonSchema: any = null;

export class LiraXTool implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'LiraX Tool',
    name: 'liraXTool',
    icon: 'file:lirax.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'AI Agent Tool for LiraX Telephony',
    description: 'Provides LiraX telephony operations as tools for AI Agent with standardized output format',
    defaults: {
      name: 'LiraX Tool',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'liraXApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: '📞 Make Phone Call',
            value: 'makeCall',
            description: 'Initiate a phone call to a contact',
            action: 'Make a phone call',
          },
          {
            name: '💬 Send SMS Message',
            value: 'sendSMS',
            description: 'Send SMS to a phone number',
            action: 'Send an SMS',
          },
          {
            name: '👤 Lookup Contact Info',
            value: 'getContact',
            description: 'Retrieve contact information by phone number or email',
            action: 'Lookup contact',
          },
          {
            name: '📊 Get Call History',
            value: 'get_calls', // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
            description: 'Retrieve recent call history for analysis',
            action: 'Get call history',
          },
          {
            name: '📝 Create Contact',
            value: 'checkContact',
            description: 'Create or update contact information',
            action: 'Create or update contact',
          },
          {
            name: '✅ Check SMS Status',
            value: 'checkSMS',
            description: 'Check delivery status of sent SMS',
            action: 'Check SMS status',
          },
          {
            name: '🎯 Create Task',
            value: 'createTask',
            description: 'Create a new task for follow-up',
            action: 'Create a task',
          },
          {
            name: '💰 Create Deal',
            value: 'createDeal',
            description: 'Create a new sales deal',
            action: 'Create a deal',
          },
          {
            name: '📋 Create Note',
            value: 'createNote',
            description: 'Add note to contact record',
            action: 'Create a note',
          },
          {
            name: '🔍 Get Available Users',
            value: 'getUsers',
            description: 'Get list of available LiraX users',
            action: 'Get users',
          },
          {
            name: '🏪 Get Shops',
            value: 'getShops',
            description: 'Get list of available shops',
            action: 'Get shops',
          },
        ],
        default: 'makeCall',
        description: 'The telephony operation to perform as AI tool',
      },
      {
        displayName: 'Phone Number',
        name: 'phone',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['makeCall', 'sendSMS', 'getContact', 'checkContact', 'checkSMS'],
          },
        },
        default: '',
        placeholder: '380501234567',
        description: 'Phone number for the operation. Will be automatically normalized.',
        hint: 'Include country code for international numbers',
      },
      {
        displayName: 'From (Internal Number)',
        name: 'from',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['makeCall'],
          },
        },
        default: '101',
        description: 'Internal extension number to make the call from',
      },
      {
        displayName: 'SMS Text',
        name: 'text',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['sendSMS'],
          },
        },
        default: '',
        typeOptions: {
          rows: 3,
        },
        description: 'Content of the SMS message to send',
        placeholder: 'Hello! This is an automated message from our AI assistant.',
      },
      {
        displayName: 'Employee Extension',
        name: 'ext',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['sendSMS', 'checkSMS', 'createTask', 'createDeal', 'createNote'],
          },
        },
        default: '101',
        description: 'Internal extension number for operations',
      },
      {
        displayName: 'Contact Name',
        name: 'name',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['checkContact', 'createDeal'],
          },
        },
        default: '',
        description: 'Full name of the contact',
        placeholder: 'John Smith',
      },
      {
        displayName: 'Responsible Employee',
        name: 'ext_contact',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['checkContact'],
          },
        },
        default: '101',
        description: 'Internal number of employee responsible for this contact',
      },
      {
        displayName: 'Email Address',
        name: 'email',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['getContact', 'checkContact'],
          },
        },
        default: '',
        description: 'Email address for contact lookup or creation',
        placeholder: 'john.smith@example.com',
      },
      {
        displayName: 'Task Text',
        name: 'text_task',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['createTask'],
          },
        },
        default: '',
        description: 'Description of the task',
        typeOptions: {
          rows: 3,
        },
        placeholder: 'Follow up with customer about product demo',
      },
      {
        displayName: 'Task Due Date',
        name: 'date',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['createTask'],
          },
        },
        default: '={{ $now.plus({ days: 1 }).toFormat("yyyy-MM-dd HH:mm:ss") }}',
        description: 'Due date for the task',
      },
      {
        displayName: 'Task Type',
        name: 'type',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['createTask'],
          },
        },
        options: [
          { name: 'Follow-up', value: 1 },
          { name: 'Meeting', value: 2 },
          { name: 'Call', value: 3 },
        ],
        default: 1,
        description: 'Type of task',
      },
      {
        displayName: 'Deal Name',
        name: 'deal_name',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['createDeal'],
          },
        },
        default: '',
        description: 'Name of the deal',
        placeholder: 'New Customer Acquisition',
      },
      {
        displayName: 'Deal Amount',
        name: 'sum',
        type: 'number',
        required: true,
        displayOptions: {
          show: {
            operation: ['createDeal'],
          },
        },
        default: 0,
        description: 'Monetary value of the deal',
      },
      {
        displayName: 'Deal Stage',
        name: 'stage',
        type: 'number',
        required: true,
        displayOptions: {
          show: {
            operation: ['createDeal'],
          },
        },
        default: 1,
        description: 'Stage of the deal in sales pipeline',
        hint: 'Use Get Stages operation to see available stages',
      },
      {
        displayName: 'Note Text',
        name: 'text_note',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['createNote'],
          },
        },
        default: '',
        description: 'Content of the note',
        typeOptions: {
          rows: 4,
        },
        placeholder: 'Customer expressed interest in premium features during call.',
      },
      {
        displayName: 'Start Date/Time',
        name: 'date_start',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['get_calls'], // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
          },
        },
        default: '={{ $now.minus({ hours: 24 }).toFormat("yyyy-MM-dd HH:mm:ss") }}',
        placeholder: '={{ $now.minus({ hours: 24 }).toFormat("yyyy-MM-dd HH:mm:ss") }}',
        description: 'Start of time period for call history analysis',
      },
      {
        displayName: 'End Date/Time',
        name: 'date_finish',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['get_calls'], // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
          },
        },
        default: '={{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}',
        placeholder: '={{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}',
        description: 'End of time period for call history analysis',
      },
      {
        displayName: 'SMS ID',
        name: 'id_sms',
        type: 'number',
        required: true,
        displayOptions: {
          show: {
            operation: ['checkSMS'],
          },
        },
        default: 0,
        description: 'ID of the SMS message to check status for',
      },
      {
        displayName: '🦄 AI Agent Settings',
        name: 'aiSettings',
        type: 'collection',
        placeholder: 'Add AI Setting',
        default: {},
        options: [
          {
            displayName: 'Include Execution Summary',
            name: 'includeSummary',
            type: 'boolean',
            default: true,
            description: 'Whether to include AI-friendly operation summary in output',
          },
          {
            displayName: 'Standardized Output Format',
            name: 'standardizedOutput',
            type: 'boolean',
            default: true,
            description: 'Use standardized output format for AI Agent consumption',
          },
          {
            displayName: 'Error Handling Mode',
            name: 'errorMode',
            type: 'options',
            options: [
              { name: 'Strict', value: 'strict', description: 'Throw errors immediately' },
              { name: 'Lenient', value: 'lenient', description: 'Return errors in standardized format' },
              { name: 'Silent', value: 'silent', description: 'Suppress errors and return empty data' },
            ],
            default: 'lenient',
            description: 'How to handle errors for AI Agent workflows',
          },
          {
            displayName: 'Include Raw API Response',
            name: 'includeRawResponse',
            type: 'boolean',
            default: false,
            description: 'Whether to include the raw LiraX API response in output',
          },
          {
            displayName: 'Confidence Threshold',
            name: 'confidenceThreshold',
            type: 'number',
            default: 0.7,
            description: 'Minimum confidence level for successful operations (0.0-1.0)',
            typeOptions: {
              minValue: 0,
              maxValue: 1,
              numberPrecision: 2,
            },
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      async getUsers(this: IExecuteFunctions): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
          const response = await liraxRequest(this, credentials, { cmd: 'getUsers' }, { useCache: true, cacheKey: 'users' });

          if (response && typeof response === 'object' && 'users' in response) {
            const users = (response as any).users;
            return Array.isArray(users) ? users.map((user: any) => ({
              name: `${user.Name} (${user.ext})`,
              value: user.ext,
            })) : [];
          }
          return [];
        } catch (error) {
          throw LiraXErrorHandler.handle(error, {
            node: this.getNode(),
            operation: 'getUsers',
            resource: 'loadOptions',
          });
        }
      },

      async getShops(this: IExecuteFunctions): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
          const response = await liraxRequest(this, credentials, { cmd: 'getShops' }, { useCache: true, cacheKey: 'shops' });

          if (response && typeof response === 'object' && 'shops' in response) {
            const shops = (response as any).shops;
            return Array.isArray(shops) ? shops.map((shop: any) => ({
              name: `${shop.name} (ID: ${shop.id})`,
              value: shop.id,
            })) : [];
          }
          return [];
        } catch (error) {
          throw LiraXErrorHandler.handle(error, {
            node: this.getNode(),
            operation: 'getShops',
            resource: 'loadOptions',
          });
        }
      },
    },

    async getToolSchema(this: IExecuteFunctions, operation: string): Promise<IDataObject> {
      try {
        if (!zodToJsonSchema) {
          const module = await import('zod-to-json-schema');
          zodToJsonSchema = module.zodToJsonSchema;
        }

        const zodSchema = SchemaRegistry.getSchema(operation);
        const jsonSchema = zodToJsonSchema(zodSchema, {
          $refStrategy: 'none',
          target: 'jsonSchema7',
        });

        if (jsonSchema.properties && jsonSchema.properties.cmd) {
          delete jsonSchema.properties.cmd;
        }
        if (jsonSchema.required) {
          jsonSchema.required = jsonSchema.required.filter((req: string) => req !== 'cmd');
        }

        return {
          name: this.getOperationName(operation),
          description: this.getOperationDescription(operation),
          parameters: jsonSchema,
        };
      } catch (error) {
        throw new NodeApiError(this.getNode(), error as Error, {
          message: `Failed to generate tool schema for operation: ${operation}`,
        });
      }
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const operation = this.getNodeParameter('operation', 0) as string;
    const aiSettings = this.getNodeParameter('aiSettings', {}) as IDataObject;

    const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;

    for (let i = 0; i < items.length; i++) {
      try {
        let result: unknown;
        const inputData = items[i].json;

        switch (operation) {
          case 'makeCall':
            result = await this.executeMakeCall(i, credentials, inputData);
            break;
          case 'sendSMS':
            result = await this.executeSendSMS(i, credentials, inputData);
            break;
          case 'getContact':
            result = await this.executeGetContact(i, credentials, inputData);
            break;
          case 'get_calls': // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
            result = await this.executeGetCalls(i, credentials, inputData);
            break;
          case 'checkContact':
            result = await this.executeCheckContact(i, credentials, inputData);
            break;
          case 'checkSMS':
            result = await this.executeCheckSMS(i, credentials, inputData);
            break;
          case 'createTask':
            result = await this.executeCreateTask(i, credentials, inputData);
            break;
          case 'createDeal':
            result = await this.executeCreateDeal(i, credentials, inputData);
            break;
          case 'createNote':
            result = await this.executeCreateNote(i, credentials, inputData);
            break;
          case 'getUsers':
            result = await this.executeGetUsers(i, credentials, inputData);
            break;
          case 'getShops':
            result = await this.executeGetShops(i, credentials, inputData);
            break;
          default:
            throw new NodeApiError(this.getNode(), {
              message: `Unsupported AI tool operation: ${operation}`,
              description: 'This operation is not supported in LiraX Tool',
            });
        }

        const standardizedOutput = this.standardizeForAI(
          operation,
          result,
          aiSettings,
          inputData
        );

        returnData.push({
          json: standardizedOutput,
          pairedItem: {
            item: i,
          },
        });

      } catch (error) {
        const errorMode = aiSettings.errorMode as string || 'lenient';

        if (errorMode === 'silent') {
          returnData.push({
            json: this.standardizeForAI(operation, null, aiSettings, {}, error.message),
            pairedItem: { item: i },
          });
        } else if (errorMode === 'lenient' || this.continueOnFail()) {
          returnData.push({
            json: this.standardizeForAI(operation, null, aiSettings, {}, error.message),
            pairedItem: { item: i },
          });
        } else {
          throw LiraXErrorHandler.handle(error, {
            node: this.getNode(),
            operation,
            resource: 'ai_tool',
          });
        }
      }
    }

    return [returnData];
  }

  private async executeMakeCall(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const from = this.getNodeParameter('from', i) as string;
    const phone = this.getNodeParameter('phone', i) as string;

    const payload = {
      cmd: 'makeCall' as const,
      from,
      to: phone,
    };

    const validatedPayload = SchemaRegistry.getSchema('makeCall').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    return {
      callInitiated: true,
      callId: (response as IDataObject).id_makecall,
      to: phone,
      from,
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeSendSMS(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const ext = this.getNodeParameter('ext', i) as string;
    const phone = this.getNodeParameter('phone', i) as string;
    const text = this.getNodeParameter('text', i) as string;

    const payload = {
      cmd: 'sendSMS' as const,
      ext,
      phone,
      text,
      provider: 'default',
    };

    const validatedPayload = SchemaRegistry.getSchema('sendSMS').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    return {
      smsSent: true,
      messageId: (response as IDataObject).id_sms,
      to: phone,
      message: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeGetContact(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const phone = this.getNodeParameter('phone', i, '') as string;
    const email = this.getNodeParameter('email', i, '') as string;

    const payload: IDataObject = {
      cmd: 'getContact' as const,
      ani: phone || undefined,
      email: email || undefined,
    };

    const validatedPayload = SchemaRegistry.getSchema('getContact').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    // ИСПРАВЛЕНИЕ: Безопасное извлечение contactData
    const responseData = response as IDataObject;
    const contactData = responseData.result as IDataObject | undefined;

    return {
      contactFound: !!contactData,
      contact: contactData || null,
      searchCriteria: {
        phone: phone || undefined,
        email: email || undefined,
      },
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeGetCalls(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const date_start = this.getNodeParameter('date_start', i) as string;
    const date_finish = this.getNodeParameter('date_finish', i) as string;

    const payload = {
      cmd: 'get_calls' as const,
      date_start: formatDateTimeSQL(date_start),
      date_finish: formatDateTimeSQL(date_finish),
      offset: 0,
    };

    const validatedPayload = SchemaRegistry.getSchema('get_calls').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    // ИСПРАВЛЕНИЕ: Безопасное преобразование response в массив
    const calls = Array.isArray(response) ? response : [];

    return {
      callsRetrieved: calls.length,
      timePeriod: {
        start: date_start,
        end: date_finish,
      },
      calls: calls.slice(0, 50),
      summary: {
        totalCalls: calls.length,
        uniqueCallers: new Set(calls.map(call => (call as IDataObject).ani)).size,
        averageDuration: this.calculateAverageDuration(calls),
        callTypes: this.analyzeCallTypes(calls),
      },
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeCheckContact(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const ext = this.getNodeParameter('ext_contact', i) as string;
    const phone = this.getNodeParameter('phone', i) as string;
    const name = this.getNodeParameter('name', i) as string;
    const email = this.getNodeParameter('email', i, '') as string;

    const payload: IDataObject = {
      cmd: 'checkContact' as const,
      ext,
      ani: phone,
      name,
      emails: email || undefined,
    };

    const validatedPayload = SchemaRegistry.getSchema('checkContact').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    return {
      contactProcessed: true,
      contact: {
        name,
        phone,
        email: email || undefined,
      },
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeCheckSMS(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const ext = this.getNodeParameter('ext', i) as string;
    const id_sms = this.getNodeParameter('id_sms', i) as number;

    const payload = {
      cmd: 'checkSMS' as const,
      ext,
      id_sms,
      provider: 'default',
    };

    const validatedPayload = SchemaRegistry.getSchema('checkSMS').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    return {
      statusChecked: true,
      smsId: id_sms,
      status: response,
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeCreateTask(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const ext = this.getNodeParameter('ext', i) as string;
    const phone = this.getNodeParameter('phone', i) as string;

    // ИСПРАВЛЕНИЕ: Используем правильное имя параметра text_task
    const text = this.getNodeParameter('text_task', i) as string;

    const date = this.getNodeParameter('date', i, '') as string;
    const type = this.getNodeParameter('type', i, 1) as number;

    const payload = {
      cmd: 'createTask' as const,
      ext,
      ani: phone,
      text, // Теперь передается правильное значение
      date: date ? formatDateTimeSQL(date) : undefined,
      type,
    };

    const validatedPayload = SchemaRegistry.getSchema('createTask').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    return {
      taskCreated: true,
      taskId: (response as IDataObject).idtask,
      contact: phone,
      task: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      dueDate: date || 'ASAP',
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeCreateDeal(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const ext = this.getNodeParameter('ext', i) as string;
    const phone = this.getNodeParameter('phone', i) as string;
    const name = this.getNodeParameter('deal_name', i) as string;
    const sum = this.getNodeParameter('sum', i) as number;
    const stage = this.getNodeParameter('stage', i) as number;

    const payload = {
      cmd: 'createDeal' as const,
      ext,
      ani: phone,
      name,
      sum,
      stage,
    };

    const validatedPayload = SchemaRegistry.getSchema('createDeal').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    return {
      dealCreated: true,
      dealId: (response as IDataObject).id_deal,
      contact: phone,
      dealName: name,
      amount: sum,
      stage,
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeCreateNote(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const ext = this.getNodeParameter('ext', i) as string;
    const phone = this.getNodeParameter('phone', i) as string;

    // ИСПРАВЛЕНИЕ: Используем правильное имя параметра text_note
    const text = this.getNodeParameter('text_note', i) as string;

    const payload = {
      cmd: 'createNote' as const,
      ext,
      ani: phone,
      text, // Теперь передается правильное значение
    };

    const validatedPayload = SchemaRegistry.getSchema('createNote').parse(payload);
    const response = await liraxRequest(this, credentials, validatedPayload);

    return {
      noteCreated: true,
      contact: phone,
      note: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeGetUsers(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const response = await liraxRequest(this, credentials, { cmd: 'getUsers' }, { useCache: true, cacheKey: 'users' });

    // ИСПРАВЛЕНИЕ: Безопасное извлечение users
    const responseData = response as IDataObject;
    const users = responseData.users as any[] || [];

    return {
      usersRetrieved: users.length,
      users: users.map((user: any) => ({
        id: user.id,
        name: user.Name,
        extension: user.ext,
        active: user.active === '1',
      })),
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private async executeGetShops(
    i: number,
    credentials: LiraXCredentials,
    inputData: IDataObject
  ): Promise<IDataObject> {
    const response = await liraxRequest(this, credentials, { cmd: 'getShops' }, { useCache: true, cacheKey: 'shops' });

    // ИСПРАВЛЕНИЕ: Безопасное извлечение shops
    const responseData = response as IDataObject;
    const shops = responseData.shops as any[] || [];

    return {
      shopsRetrieved: shops.length,
      shops: shops.map((shop: any) => ({
        id: shop.id,
        name: shop.name,
      })),
      timestamp: new Date().toISOString(),
      rawResponse: response,
    };
  }

  private standardizeForAI(
    operation: string,
    result: unknown,
    aiSettings: IDataObject,
    inputData: IDataObject = {},
    error?: string
  ): IDataObject {
    const includeSummary = aiSettings.includeSummary !== false;
    const standardizedOutput = aiSettings.standardizedOutput !== false;
    const includeRawResponse = aiSettings.includeRawResponse === true;
    const confidenceThreshold = (aiSettings.confidenceThreshold as number) || 0.7;

    const baseOutput: IDataObject = {
      tool: 'lirax_telephony',
      operation,
      timestamp: new Date().toISOString(),
      success: !error,
    };

    if (error) {
      baseOutput.error = error;
      baseOutput.data = null;
      baseOutput.confidence = 0.1;
    } else {
      baseOutput.data = result;
      baseOutput.confidence = this.calculateConfidence(operation, result as IDataObject, confidenceThreshold);
    }

    if (includeSummary) {
      baseOutput.summary = this.generateAISummary(operation, result as IDataObject, error);
    }

    if (standardizedOutput) {
      baseOutput._standardized = {
        type: this.getOperationType(operation),
        operation,
        result: baseOutput.summary || 'Operation completed',
        data: result,
        confidence: baseOutput.confidence as number,
        actionable: !error && (baseOutput.confidence as number) >= confidenceThreshold,
        nextSteps: this.suggestNextSteps(operation, result as IDataObject, error),
        context: this.extractContext(operation, inputData),
      };
    }

    if (includeRawResponse && result && (result as IDataObject).rawResponse) {
      baseOutput.rawResponse = (result as IDataObject).rawResponse;
    } else if (!includeRawResponse && result && (result as IDataObject).rawResponse) {
      const cleanedResult = { ...(result as IDataObject) };
      delete cleanedResult.rawResponse;
      baseOutput.data = cleanedResult;
    }

    return baseOutput;
  }

  private generateAISummary(operation: string, result: IDataObject | null, error?: string): string {
    if (error) {
      return `Operation failed: ${error}`;
    }

    if (!result) {
      return `Operation ${operation} completed with no data`;
    }

    switch (operation) {
      case 'makeCall':
        return `Call initiated successfully to ${result.to}. Call ID: ${result.callId}`;
      case 'sendSMS':
        return `SMS sent to ${result.to}. Message: "${result.message}"`;
      case 'getContact':
        return result.contactFound
          ? `Contact found: ${(result.contact as IDataObject)?.name || 'Unknown'} (${result.searchCriteria?.phone})`
          : `No contact found for ${result.searchCriteria?.phone || result.searchCriteria?.email}`;
      case 'get_calls': // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
        return `Retrieved ${result.callsRetrieved} calls from history. ${result.summary?.totalCalls} total calls, ${result.summary?.uniqueCallers} unique callers`;
      case 'checkContact':
        return `Contact processed: ${result.contact?.name} (${result.contact?.phone})`;
      case 'checkSMS':
        return `SMS status checked for message ID: ${result.smsId}`;
      case 'createTask':
        return `Task created: "${result.task}" for ${result.contact}. Task ID: ${result.taskId}`;
      case 'createDeal':
        return `Deal created: "${result.dealName}" for $${result.amount}. Deal ID: ${result.dealId}`;
      case 'createNote':
        return `Note added to contact ${result.contact}: "${result.note}"`;
      case 'getUsers':
        return `Retrieved ${result.usersRetrieved} users from system`;
      case 'getShops':
        return `Retrieved ${result.shopsRetrieved} shops from system`;
      default:
        return `Operation ${operation} completed successfully`;
    }
  }

  private suggestNextSteps(operation: string, result: IDataObject | null, error?: string): string[] {
    if (error) {
      return [
        'Verify the input parameters are correct',
        'Check API credentials and connectivity',
        'Retry the operation with different parameters',
        'Check LiraX system status',
      ];
    }

    if (!result) {
      return ['No specific next steps available'];
    }

    const steps: string[] = [];

    switch (operation) {
      case 'makeCall':
        steps.push('Monitor call status via webhooks');
        steps.push('Schedule follow-up if call is not answered');
        steps.push('Update CRM with call outcome');
        break;
      case 'sendSMS':
        steps.push('Check SMS delivery status');
        steps.push('Prepare follow-up message if no response');
        steps.push('Log SMS in customer communication history');
        break;
      case 'getContact':
        if (result.contactFound) {
          steps.push('Update contact information if needed');
          steps.push('Schedule call or message to this contact');
          steps.push('Add contact to marketing campaign');
        } else {
          steps.push('Create new contact record');
          steps.push('Add to lead generation campaign');
          steps.push('Schedule initial outreach');
        }
        break;
      case 'get_calls': // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
        steps.push('Analyze call patterns and trends');
        steps.push('Identify frequently calling numbers for follow-up');
        steps.push('Review call durations and outcomes');
        steps.push('Export call data for reporting');
        break;
      case 'checkContact':
        steps.push('Verify contact details are correct');
        steps.push('Add contact to relevant campaigns');
        steps.push('Schedule welcome call or message');
        break;
      case 'createTask':
        steps.push('Set reminder for task deadline');
        steps.push('Assign task to appropriate team member');
        steps.push('Monitor task completion status');
        break;
      case 'createDeal':
        steps.push('Set up deal follow-up schedule');
        steps.push('Assign deal to sales representative');
        steps.push('Monitor deal progression through pipeline');
        break;
      case 'createNote':
        steps.push('Share note with relevant team members');
        steps.push('Use note context for future interactions');
        steps.push('Follow up on any action items from note');
        break;
      case 'getUsers':
        steps.push('Assign tasks to available users');
        steps.push('Update user permissions if needed');
        steps.push('Schedule user training if required');
        break;
      case 'getShops':
        steps.push('Assign leads to appropriate shops');
        steps.push('Analyze shop performance metrics');
        steps.push('Optimize resource allocation across shops');
        break;
    }

    return steps.length > 0 ? steps : ['Proceed with next business process step'];
  }

  private calculateConfidence(operation: string, result: IDataObject, threshold: number): number {
    if (!result) return 0.1;

    let confidence = 0.9;

    switch (operation) {
      case 'getContact':
        if (!result.contactFound) confidence = 0.7;
        break;
      case 'get_calls': // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
        if (result.callsRetrieved === 0) confidence = 0.6;
        break;
      case 'makeCall':
      case 'sendSMS':
        if (!result.callId && !result.messageId) confidence = 0.5;
        break;
      case 'createTask':
      case 'createDeal':
        if (!result.taskId && !result.dealId) confidence = 0.4;
        break;
    }

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  private getOperationType(operation: string): string {
    const telephonyOps = ['makeCall', 'get_calls', 'checkSMS']; // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
    const crmOps = ['getContact', 'checkContact', 'createTask', 'createDeal', 'createNote'];
    const messagingOps = ['sendSMS'];
    const utilityOps = ['getUsers', 'getShops'];

    if (telephonyOps.includes(operation)) return 'telephony';
    if (crmOps.includes(operation)) return 'crm';
    if (messagingOps.includes(operation)) return 'messaging';
    if (utilityOps.includes(operation)) return 'utility';

    return 'general';
  }

  private extractContext(operation: string, inputData: IDataObject): IDataObject {
    const context: IDataObject = {
      operation,
      timestamp: new Date().toISOString(),
    };

    if (inputData.phone) {
      context.phone = sanitizePhoneForLog(inputData.phone as string);
    }
    if (inputData.email) {
      // ИСПРАВЛЕНИЕ: Безопасное разделение email
      const emailParts = (inputData.email as string).split('@');
      context.email = emailParts.length === 2 ? `${emailParts[0]?.substring(0, 2)}***@${emailParts[1]}` : '***@***';
    }
    if (inputData.name) {
      context.hasName = true;
    }

    return context;
  }

  private calculateAverageDuration(calls: IDataObject[]): number {
    if (!calls.length) return 0;

    const totalDuration = calls.reduce((sum, call) => {
      // ИСПРАВЛЕНИЕ: Безопасное преобразование duration
      const durationStr = call.duration as string;
      const duration = parseInt(durationStr) || 0;
      return sum + duration;
    }, 0);

    return Math.round(totalDuration / calls.length);
  }

  private analyzeCallTypes(calls: IDataObject[]): IDataObject {
    const types: { [key: string]: number } = {};

    calls.forEach(call => {
      // ИСПРАВЛЕНИЕ: Безопасное извлечение типа
      const type = (call.type as string) || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });

    return types;
  }

  private getOperationName(operation: string): string {
    const names: { [key: string]: string } = {
      makeCall: 'make_phone_call',
      sendSMS: 'send_sms',
      getContact: 'get_contact',
      get_calls: 'get_call_history', // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
      checkContact: 'create_or_update_contact',
      checkSMS: 'check_sms_status',
      createTask: 'create_task',
      createDeal: 'create_deal',
      createNote: 'create_note',
      getUsers: 'get_users',
      getShops: 'get_shops',
    };
    return names[operation] || operation;
  }

  private getOperationDescription(operation: string): string {
    const descriptions: { [key: string]: string } = {
      makeCall: 'Initiate a phone call to a contact',
      sendSMS: 'Send SMS to a phone number',
      getContact: 'Retrieve contact information by phone number or email',
      get_calls: 'Retrieve recent call history for analysis', // ✅ ИСПРАВЛЕНО: изменено с 'getCalls' на 'get_calls'
      checkContact: 'Create or update contact information',
      checkSMS: 'Check delivery status of sent SMS',
      createTask: 'Create a new task for follow-up',
      createDeal: 'Create a new sales deal',
      createNote: 'Add note to contact record',
      getUsers: 'Get list of available LiraX users',
      getShops: 'Get list of available shops',
    };
    return descriptions[operation] || `Perform ${operation} operation`;
  }
}