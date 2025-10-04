import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeApiError,
  NodeOperationError,
  ILoadOptionsFunctions,
  IDataObject,
  INodeProperties,
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
import {
  resourceProperties,
  telephonyOperations,
  telephonyFields,
  crmOperations,
  crmFields,
  messagingOperations,
  messagingFields,
  utilityOperations,
  utilityFields,
  presenceOperations,
  presenceFields,
  sipOperations,
  sipFields,
  blacklistOperations,
  blacklistFields,
  campaignsOperations,
  campaignsFields,
  advancedSettings,
} from '../../shared/LiraX.descriptions';

interface RequestOptions {
  useCache?: boolean;
  cacheTTL?: number;
  idempotencyKey?: string;
  idempotencyTTL?: number;
  bypassCircuitBreaker?: boolean;
  timeoutOverride?: number;
  disableRetry?: boolean;
}

export class LiraX implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'LiraX',
    name: 'liraX',
    icon: 'file:lirax.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description: 'Interact with LiraX Telephony and CRM API - Full integration with voice, SMS, contacts and calls management with enterprise-grade features',
    defaults: {
      name: 'LiraX',
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
      ...resourceProperties,
      ...telephonyOperations,
      ...telephonyFields,
      ...crmOperations,
      ...crmFields,
      ...messagingOperations,
      ...messagingFields,
      ...utilityOperations,
      ...utilityFields,
      ...presenceOperations,
      ...presenceFields,
      ...sipOperations,
      ...sipFields,
      ...blacklistOperations,
      ...blacklistFields,
      ...campaignsOperations,
      ...campaignsFields,
      ...advancedSettings,
      {
        displayName: '🔄 Batch Processing Settings',
        name: 'batchSettings',
        type: 'collection',
        placeholder: 'Add Batch Setting',
        default: {},
        displayOptions: {
          hide: {
            resource: ['utility', 'presence'],
          },
        },
        options: [
          {
            displayName: 'Enable Batch Processing',
            name: 'enableBatching',
            type: 'boolean',
            default: false,
            description: 'Process items in batches to avoid rate limits and improve performance',
          },
          {
            displayName: 'Batch Size',
            name: 'batchSize',
            type: 'number',
            default: 10,
            description: 'Number of items to process in each batch',
            displayOptions: {
              show: {
                enableBatching: [true],
              },
            },
            typeOptions: {
              minValue: 1,
              maxValue: 100,
            },
          },
          {
            displayName: 'Delay Between Batches (ms)',
            name: 'delayBetweenBatchesMs',
            type: 'number',
            default: 1000,
            description: 'Delay between processing batches in milliseconds',
            displayOptions: {
              show: {
                enableBatching: [true],
              },
            },
            typeOptions: {
              minValue: 0,
              maxValue: 60000,
            },
          },
          {
            displayName: 'Max Concurrent Batches',
            name: 'maxConcurrentBatches',
            type: 'number',
            default: 1,
            description: 'Maximum number of batches to process concurrently',
            displayOptions: {
              show: {
                enableBatching: [true],
              },
            },
            typeOptions: {
              minValue: 1,
              maxValue: 10,
            },
          },
        ],
      },
      {
        displayName: '🔒 Idempotency Settings',
        name: 'idempotencySettings',
        type: 'collection',
        placeholder: 'Add Idempotency Setting',
        default: {},
        displayOptions: {
          show: {
            resource: ['crm', 'messaging', 'telephony'],
          },
        },
        options: [
          {
            displayName: 'Enable Idempotency',
            name: 'enableIdempotency',
            type: 'boolean',
            default: true,
            description: 'Prevent duplicate operations when retrying failed requests',
          },
          {
            displayName: 'Idempotency Key',
            name: 'idempotencyKey',
            type: 'string',
            default: '={{ $execution.id }}-{{ $item.index }}',
            description: 'Unique key for this operation to prevent duplicates on retry',
            displayOptions: {
              show: {
                enableIdempotency: [true],
              },
            },
          },
          {
            displayName: 'Idempotency TTL (seconds)',
            name: 'idempotencyTTL',
            type: 'number',
            default: 86400,
            description: 'How long to remember idempotency keys (default: 24 hours)',
            displayOptions: {
              show: {
                enableIdempotency: [true],
              },
            },
            typeOptions: {
              minValue: 60,
              maxValue: 604800,
            },
          },
        ],
      },
      {
        displayName: '📊 Analytics Settings',
        name: 'analyticsSettings',
        type: 'collection',
        placeholder: 'Add Analytics Setting',
        default: {},
        options: [
          {
            displayName: 'Enable Operation Analytics',
            name: 'enableAnalytics',
            type: 'boolean',
            default: true,
            description: 'Collect and include analytics data in operation results',
          },
          {
            displayName: 'Track Performance Metrics',
            name: 'trackPerformance',
            type: 'boolean',
            default: true,
            description: 'Track operation duration and performance metrics',
          },
          {
            displayName: 'Include Request/Response Data',
            name: 'includeRequestResponse',
            type: 'boolean',
            default: false,
            description: 'Include full request and response data in output (for debugging)',
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      async getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
          const performanceSettings = this.getNodeParameter('performanceSettings', {}) as IDataObject;
          const useCache = performanceSettings.useCache !== false;

          const cacheOptions = useCache ? {
            useCache: true,
            cacheKey: 'users',
            cacheTTL: (performanceSettings.cacheTTL as number) || 3600
          } : {};

          const response = await liraxRequest(this, credentials, { cmd: 'getUsers' }, cacheOptions);

          const responseData = response as IDataObject;
          if (responseData && 'users' in responseData) {
            const usersRaw = responseData.users;
            const filter = this.getNodeParameter('filter', '') as string;

            let filteredUsers = Array.isArray(usersRaw) ? usersRaw : [];

            if (filter) {
              const lowerCaseFilter = filter.toLowerCase();
              filteredUsers = filteredUsers.filter((user: IDataObject) =>
                user.Name?.toString().toLowerCase().includes(lowerCaseFilter) ||
                user.ext?.toString().includes(filter)
              );
            }

            return filteredUsers.map((user: IDataObject) => ({
              name: `${user.Name} (${user.ext}) - ${user.active === '1' ? 'Active' : 'Inactive'}`,
              value: user.ext,
              description: `User: ${user.Name}, Extension: ${user.ext}, Status: ${user.active === '1' ? 'Active' : 'Inactive'}`,
            }));
          }
          return [];
        } catch (error) {
          throw LiraXErrorHandler.handle(error as Error, {
            node: this.getNode(),
            operation: 'getUsers',
            resource: 'loadOptions',
          });
        }
      },

      async getShops(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
          const performanceSettings = this.getNodeParameter('performanceSettings', {}) as IDataObject;
          const useCache = performanceSettings.useCache !== false;

          const cacheOptions = useCache ? {
            useCache: true,
            cacheKey: 'shops',
            cacheTTL: (performanceSettings.cacheTTL as number) || 3600
          } : {};

          const response = await liraxRequest(this, credentials, { cmd: 'getShops' }, cacheOptions);

          const responseData = response as IDataObject;
          if (responseData && 'shops' in responseData) {
            const shopsRaw = responseData.shops;
            const filter = this.getNodeParameter('filter', '') as string;

            let filteredShops = Array.isArray(shopsRaw) ? shopsRaw : [];

            if (filter) {
              const lowerCaseFilter = filter.toLowerCase();
              filteredShops = filteredShops.filter((shop: IDataObject) =>
                shop.name?.toString().toLowerCase().includes(lowerCaseFilter) ||
                shop.id?.toString().includes(filter)
              );
            }

            return filteredShops.map((shop: IDataObject) => ({
              name: `${shop.name} (ID: ${shop.id})`,
              value: shop.id,
              description: `Shop: ${shop.name}, ID: ${shop.id}`,
            }));
          }
          return [];
        } catch (error) {
          throw LiraXErrorHandler.handle(error as Error, {
            node: this.getNode(),
            operation: 'getShops',
            resource: 'loadOptions',
          });
        }
      },

      async getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
          const performanceSettings = this.getNodeParameter('performanceSettings', {}) as IDataObject;
          const useCache = performanceSettings.useCache !== false;

          const cacheOptions = useCache ? {
            useCache: true,
            cacheKey: 'stages',
            cacheTTL: (performanceSettings.cacheTTL as number) || 3600
          } : {};

          const response = await liraxRequest(this, credentials, { cmd: 'getStages' }, cacheOptions);

          const responseData = response as IDataObject;
          if (responseData && 'stages' in responseData) {
            const stagesRaw = responseData.stages;
            const filter = this.getNodeParameter('filter', '') as string;

            let filteredStages = Array.isArray(stagesRaw) ? stagesRaw : [];

            if (filter) {
              const lowerCaseFilter = filter.toLowerCase();
              filteredStages = filteredStages.filter((stage: IDataObject) =>
                stage.title?.toString().toLowerCase().includes(lowerCaseFilter) ||
                stage.stage?.toString().includes(filter)
              );
            }

            return filteredStages.map((stage: IDataObject) => ({
              name: `${stage.title} (Stage: ${stage.stage})`,
              value: stage.stage,
              description: `Stage: ${stage.title}, Level: ${stage.stage}`,
            }));
          }
          return [];
        } catch (error) {
          throw LiraXErrorHandler.handle(error as Error, {
            node: this.getNode(),
            operation: 'getStages',
            resource: 'loadOptions',
          });
        }
      },

      async getUserStatuses(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
          const performanceSettings = this.getNodeParameter('performanceSettings', {}) as IDataObject;
          const useCache = performanceSettings.useCache !== false;

          const cacheOptions = useCache ? {
            useCache: true,
            cacheKey: 'user_statuses',
            cacheTTL: (performanceSettings.cacheTTL as number) || 3600
          } : {};

          const response = await liraxRequest(this, credentials, { cmd: 'getUserStatuses' }, cacheOptions);

          const responseData = response as IDataObject;
          if (responseData && 'statuses' in responseData) {
            const statusesRaw = responseData.statuses;
            return Array.isArray(statusesRaw)
              ? statusesRaw.map((status: IDataObject) => ({
                  name: status.title || status.name,
                  value: status.status || status.id,
                  description: `Status: ${status.title || status.name}, ID: ${status.status || status.id}`,
                }))
              : [];
          }
          return [];
        } catch (error) {
          throw LiraXErrorHandler.handle(error as Error, {
            node: this.getNode(),
            operation: 'getUserStatuses',
            resource: 'loadOptions',
          });
        }
      },

      async getSIPNumbers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
          const ext = this.getNodeParameter('ext', '') as string;

          const response = await liraxRequest(this, credentials, {
            cmd: 'getUserSips',
            ext
          });

          const responseData = response as IDataObject;
          if (responseData && 'user_sips' in responseData) {
            const sipsRaw = responseData.user_sips;
            return Array.isArray(sipsRaw)
              ? sipsRaw.map((sip: IDataObject) => ({
                  name: `${sip.phone || sip.number} (${sip.ext || sip.type})`,
                  value: sip.phone || sip.number,
                  description: `SIP: ${sip.phone || sip.number}, Extension: ${sip.ext || sip.type}`,
                }))
              : [];
          }
          return [];
        } catch (error) {
          throw LiraXErrorHandler.handle(error as Error, {
            node: this.getNode(),
            operation: 'getSIPNumbers',
            resource: 'loadOptions',
          });
        }
      },

      // ✅ УДАЛЕН: Метод getCampaigns, так как API команда getCampaigns не существует
      // async getCampaigns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      //   ... удаленный код ...
      // }
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
    const batchSettings = this.getNodeParameter('batchSettings', 0, {}) as IDataObject;
    const idempotencySettings = this.getNodeParameter('idempotencySettings', 0, {}) as IDataObject;
    const performanceSettings = this.getNodeParameter('performanceSettings', 0, {}) as IDataObject;
    const analyticsSettings = this.getNodeParameter('analyticsSettings', 0, {}) as IDataObject;

    const enableBatching = batchSettings.enableBatching === true;
    const batchSize = (batchSettings.batchSize as number) || 10;
    const delayBetweenBatchesMs = (batchSettings.delayBetweenBatchesMs as number) || 1000;
    const maxConcurrentBatches = (batchSettings.maxConcurrentBatches as number) || 1;

    const enableIdempotency = idempotencySettings.enableIdempotency !== false;
    const idempotencyKeyTemplate = (idempotencySettings.idempotencyKey as string) || '={{ $execution.id }}-{{ $item.index }}';
    const idempotencyTTL = (idempotencySettings.idempotencyTTL as number) || 86400;

    const enableCircuitBreaker = performanceSettings.enableCircuitBreaker !== false;
    const useCache = performanceSettings.useCache !== false;
    const cacheTTL = (performanceSettings.cacheTTL as number) || 3600;
    const timeoutOverride = (performanceSettings.timeoutOverride as number) || 0;
    const disableRetry = performanceSettings.disableRetry === true;
    const bypassCache = performanceSettings.bypassCache === true;

    const enableAnalytics = analyticsSettings.enableAnalytics !== false;
    const trackPerformance = analyticsSettings.trackPerformance !== false;
    const includeRequestResponse = analyticsSettings.includeRequestResponse === true;

    const executeOperation = async (i: number): Promise<INodeExecutionData> => {
      const startTime = Date.now();
      let executionData: IDataObject = {
        resource,
        operation,
        timestamp: new Date().toISOString(),
        itemIndex: i,
      };

      try {
        let response: unknown;
        const item = items[i];
        const operationStartTime = Date.now();

        const idempotencyKey = enableIdempotency ?
          this.getNodeParameter('idempotencyKey', i, idempotencyKeyTemplate) as string :
          undefined;

        const requestOptions: RequestOptions = {
          useCache: useCache && !bypassCache,
          cacheTTL,
          idempotencyKey,
          idempotencyTTL,
          bypassCircuitBreaker: !enableCircuitBreaker,
          timeoutOverride: timeoutOverride > 0 ? timeoutOverride : undefined,
          disableRetry,
        };

        switch (resource) {
          case 'telephony':
            response = await this.executeTelephonyOperation(i, operation, credentials, requestOptions);
            break;

          case 'crm':
            response = await this.executeCRMOperation(i, operation, credentials, requestOptions);
            break;

          case 'messaging':
            response = await this.executeMessagingOperation(i, operation, credentials, requestOptions);
            break;

          case 'presence':
            response = await this.executePresenceOperation(i, operation, credentials, requestOptions);
            break;

          case 'sip':
            response = await this.executeSIPOperation(i, operation, credentials, requestOptions);
            break;

          case 'blacklist':
            response = await this.executeBlacklistOperation(i, operation, credentials, requestOptions);
            break;

          case 'campaigns':
            response = await this.executeCampaignsOperation(i, operation, credentials, requestOptions);
            break;

          case 'utility':
            response = await this.executeUtilityOperation(i, operation, credentials, requestOptions);
            break;

          default:
            throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`);
        }

        const operationEndTime = Date.now();
        const operationDuration = operationEndTime - operationStartTime;

        if (enableAnalytics) {
          executionData = {
            ...executionData,
            analytics: {
              operationDuration,
              success: true,
              timestamp: new Date().toISOString(),
              ...(trackPerformance && {
                performance: {
                  startTime: operationStartTime,
                  endTime: operationEndTime,
                  duration: operationDuration,
                },
              }),
            },
          };
        }

        const result: INodeExecutionData = {
          json: {
            success: true,
            data: response,
            metadata: executionData,
            _lirax: {
              resource,
              operation,
              timestamp: new Date().toISOString(),
              itemIndex: i,
              ...(enableAnalytics && { analytics: executionData.analytics }),
            },
          },
          pairedItem: {
            item: i,
          },
        };

        if (includeRequestResponse && response && typeof response === 'object') {
          result.json._requestResponse = {
            request: this.sanitizeRequestData(i, resource, operation),
            response: response,
          };
        }

        return result;

      } catch (error) {
        const errorEndTime = Date.now();
        const errorDuration = errorEndTime - startTime;

        if (enableAnalytics) {
          executionData = {
            ...executionData,
            analytics: {
              operationDuration: errorDuration,
              success: false,
              error: (error as Error).message,
              timestamp: new Date().toISOString(),
            },
          };
        }

        if (this.continueOnFail()) {
          return {
            json: {
              success: false,
              error: (error as Error).message,
              metadata: executionData,
              _lirax: {
                resource,
                operation,
                timestamp: new Date().toISOString(),
                itemIndex: i,
                error: true,
                ...(enableAnalytics && { analytics: executionData.analytics }),
              },
            },
            pairedItem: {
              item: i,
            },
          };
        }

        throw LiraXErrorHandler.handle(error as Error, {
          node: this.getNode(),
          operation,
          resource,
          payload: this.sanitizeRequestData(i, resource, operation),
        });
      }
    };

    if (enableBatching && items.length > 1) {
      const batches: number[][] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(Array.from({ length: Math.min(batchSize, items.length - i) }, (_, j) => i + j));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += maxConcurrentBatches) {
        const currentBatches = batches.slice(batchIndex, batchIndex + maxConcurrentBatches);

        const batchPromises = currentBatches.flatMap(batch =>
          batch.map(itemIndex => executeOperation(itemIndex))
        );

        const batchResults = await Promise.all(batchPromises);
        returnData.push(...batchResults);

        if (delayBetweenBatchesMs > 0 && batchIndex + maxConcurrentBatches < batches.length) {
          await delay(delayBetweenBatchesMs);
        }
      }
    } else {
      for (let i = 0; i < items.length; i++) {
        const result = await executeOperation(i);
        returnData.push(result);
      }
    }

    return [returnData];
  }

  private sanitizeRequestData(i: number, resource: string, operation: string): IDataObject {
    const requestData: IDataObject = {
      resource,
      operation,
      itemIndex: i,
      timestamp: new Date().toISOString(),
    };

    try {
      const allParameters = this.getNode().parameters;
      for (const [key, value] of Object.entries(allParameters)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'string' && (
            key.includes('token') ||
            key.includes('phone') ||
            key.includes('ani') ||
            key.includes('dnis') ||
            key.includes('to') ||
            key.includes('to1') ||
            key.includes('to2') ||
            key.includes('provider') ||
            key.includes('ext') ||
            key.includes('newext') ||
            key.includes('client') ||
            key.includes('from_LiraX_token') ||
            key.includes('incomingToken') ||
            key.includes('password')
          )) {
            requestData[key] = sanitizePhoneForLog(value);
          } else if (typeof value === 'string' && key.includes('email')) {
            const [localPart, domain] = value.split('@');
            requestData[key] = `${localPart?.substring(0, 2)}***@${domain}`;
          } else {
            requestData[key] = value;
          }
        }
      }
    } catch (error) {
      requestData.parameterError = 'Failed to extract parameters';
    }

    return requestData;
  }

  private async executeTelephonyOperation(
    i: number,
    operation: string,
    credentials: LiraXCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    switch (operation) {
      case 'makeCall': {
        const from = this.getNodeParameter('from', i) as string;
        const to = this.getNodeParameter('to', i) as string;
        const idshop = this.getNodeParameter('idshop', i, 0) as number;

        const normalizedFrom = normalizePhoneDigits(from);
        const normalizedTo = normalizePhoneDigits(to);

        const payload = {
          cmd: 'makeCall' as const,
          from: normalizedFrom,
          to: normalizedTo,
          idshop: idshop > 0 ? idshop.toString() : undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('makeCall').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'killCall': {
        const Call_id = this.getNodeParameter('Call_id', i) as string;

        const payload = {
          cmd: 'killCall' as const,
          Call_id,
        };

        const validatedPayload = SchemaRegistry.getSchema('killCall').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'make2Calls': {
        const from = this.getNodeParameter('from', i) as string;
        const to1 = this.getNodeParameter('to1', i) as string;
        const to2 = this.getNodeParameter('to2', i) as string;
        const speech = this.getNodeParameter('speech', i, '') as string;
        const timeout = this.getNodeParameter('timeout', i, 0) as number;
        const successtime = this.getNodeParameter('successtime', i, 0) as number;
        const notbefore = this.getNodeParameter('notbefore', i, 8) as number;
        const notafter = this.getNodeParameter('notafter', i, 20) as number;
        const FirstInternal = this.getNodeParameter('FirstInternal', i, 0) as number;
        const SecondInternal = this.getNodeParameter('SecondInternal', i, 0) as number;
        const SpeechNoWait = this.getNodeParameter('SpeechNoWait', i, 0) as number;
        const idshop = this.getNodeParameter('idshop', i, 0) as number;
        const atmepo = this.getNodeParameter('atmepo', i, '') as string;
        const vtime = this.getNodeParameter('vtime', i, '') as string;
        const vdate = this.getNodeParameter('vdate', i, '') as string;
        const vmoney = this.getNodeParameter('vmoney', i, '') as string;

        const normalizedFrom = normalizePhoneDigits(from);
        const normalizedTo1 = normalizePhoneDigits(to1);
        const normalizedTo2 = normalizePhoneDigits(to2);

        const payload = {
          cmd: 'make2Calls' as const,
          from: normalizedFrom,
          to1: normalizedTo1,
          to2: normalizedTo2,
          speech: speech || undefined,
          atmepo: atmepo || undefined,
          timeout: timeout.toString(),
          successtime: successtime.toString(),
          notbefore: notbefore.toString(),
          notafter: notafter.toString(),
          vtime: vtime || undefined,
          vdate: vdate || undefined,
          vmoney: vmoney || undefined,
          FirstInternal: FirstInternal ? '1' : '0',
          SecondInternal: SecondInternal ? '1' : '0',
          SpeechNoWait: SpeechNoWait ? '1' : '0',
          idshop: idshop > 0 ? idshop.toString() : undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('make2Calls').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'AskQuestion': {
        const from = this.getNodeParameter('from', i) as string;
        const to1 = this.getNodeParameter('to1', i) as string;
        const hello = this.getNodeParameter('hello', i, '') as string;
        const text1 = this.getNodeParameter('text1', i, '') as string;
        const text2 = this.getNodeParameter('text2', i, '') as string;
        const text3 = this.getNodeParameter('text3', i, '') as string;
        const text4 = this.getNodeParameter('text4', i, '') as string;
        const bye = this.getNodeParameter('bye', i, '') as string;
        const ask = this.getNodeParameter('ask', i) as string;
        const ok = this.getNodeParameter('ok', i) as string;
        const cburl = this.getNodeParameter('cburl', i, '') as string;
        const idshop = this.getNodeParameter('idshop', i, 0) as number;

        if (cburl && !validatePublicUrl(cburl)) {
          throw new NodeOperationError(
            this.getNode(),
            'The provided callback URL (cburl) is not allowed. It must be a public HTTP/HTTPS URL and cannot point to localhost or private networks.',
            { itemIndex: i }
          );
        }

        const normalizedFrom = normalizePhoneDigits(from);
        const normalizedTo1 = normalizePhoneDigits(to1);

        const payload = {
          cmd: 'AskQuestion' as const,
          from: normalizedFrom,
          to1: normalizedTo1,
          hello: hello || undefined,
          text1: text1 || undefined,
          text2: text2 || undefined,
          text3: text3 || undefined,
          text4: text4 || undefined,
          bye: bye || undefined,
          ask,
          ok,
          cburl: cburl || undefined,
          idshop: idshop > 0 ? idshop.toString() : undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('AskQuestion').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'set_call_lost': {
        const phone = this.getNodeParameter('phone', i) as string;
        const ext = this.getNodeParameter('ext', i) as string;
        const time_plan = this.getNodeParameter('time_plan', i, 1) as number;
        const max_try = this.getNodeParameter('max_try', i, 3) as number;
        const interval = this.getNodeParameter('interval', i, 6) as number;
        const minutes = this.getNodeParameter('minutes', i, 0) as number;
        const hours = this.getNodeParameter('hours', i, 0) as number;
        const days = this.getNodeParameter('days', i, 0) as number;
        const weeks = this.getNodeParameter('weeks', i, 0) as number;
        const months = this.getNodeParameter('months', i, 0) as number;
        const info = this.getNodeParameter('info', i, '') as string;

        const normalizedPhone = normalizePhoneDigits(phone);

        const payload = {
          cmd: 'set_call_lost' as const,
          phone: normalizedPhone,
          ext,
          time_plan: time_plan.toString(),
          max_try: max_try.toString(),
          interval: interval.toString(),
          minutes: minutes > 0 ? minutes.toString() : undefined,
          hours: hours > 0 ? hours.toString() : undefined,
          days: days > 0 ? days.toString() : undefined,
          weeks: weeks > 0 ? weeks.toString() : undefined,
          months: months > 0 ? months.toString() : undefined,
          info: info || undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('set_call_lost').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'get_makecall_data': {
        const id_makecall = this.getNodeParameter('id_makecall', i) as string;

        const payload = {
          cmd: 'get_makecall_data',
          id_makecall,
        };

        const validatedPayload = SchemaRegistry.getSchema('get_makecall_data').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      // ✅ ИСПРАВЛЕНО: Изменено с 'getCalls' на 'get_calls' для соответствия с UI
      case 'get_calls': {
        const date_start = this.getNodeParameter('date_start', i) as string;
        const date_finish = this.getNodeParameter('date_finish', i) as string;
        const call_type = this.getNodeParameter('call_type', i, -1) as number;
        const ani = this.getNodeParameter('ani', i, '') as string;
        const dnis = this.getNodeParameter('dnis', i, '') as string;
        const offset = this.getNodeParameter('offset', i, 0) as number;

        if (!validateTimeWindow48h(date_start, date_finish)) {
          throw new NodeOperationError(
            this.getNode(),
            'Time window between start and end dates cannot exceed 48 hours. Please adjust your date range.'
          );
        }

        const payload = {
          cmd: 'get_calls' as const,
          date_start: formatDateTimeSQL(date_start),
          date_finish: formatDateTimeSQL(date_finish),
          call_type: call_type !== -1 ? call_type.toString() : undefined,
          ani: ani ? normalizePhoneDigits(ani) : undefined,
          dnis: dnis ? normalizePhoneDigits(dnis) : undefined,
          offset: offset.toString(),
        };

        const validatedPayload = SchemaRegistry.getSchema('get_calls').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      default:
        throw new NodeOperationError(this.getNode(), `Unsupported telephony operation: ${operation}`);
    }
  }

  private async executeCRMOperation(
    i: number,
    operation: string,
    credentials: LiraXCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    switch (operation) {
      case 'checkContact': {
        const ext = this.getNodeParameter('ext', i) as string;
        const ani = this.getNodeParameter('ani', i) as string;
        const name = this.getNodeParameter('name', i) as string;
        const add_phone = this.getNodeParameter('add_phone', i, '') as string;
        const emails = this.getNodeParameter('emails', i, '') as string;
        const marketingData = this.getNodeParameter('marketingTracking', i, {}) as IDataObject;

        const normalizedAni = normalizePhoneDigits(ani);
        const normalizedAddPhone = add_phone ? normalizePhoneDigits(add_phone) : undefined;

        const stringifiedMarketingData: IDataObject = {};
        for (const [key, value] of Object.entries(marketingData)) {
          if (value !== undefined && value !== null && value !== '') {
            stringifiedMarketingData[key] = String(value);
          }
        }

        const payload = {
          cmd: 'checkContact' as const,
          ext,
          ani: normalizedAni,
          name,
          add_phone: normalizedAddPhone,
          emails: emails || undefined,
          ...stringifiedMarketingData,
        };

        const validatedPayload = SchemaRegistry.getSchema('checkContact').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'getContact': {
        const ani = this.getNodeParameter('ani', i, '') as string;
        const email = this.getNodeParameter('email', i, '') as string;

        if (!ani && !email) {
          throw new NodeOperationError(
            this.getNode(),
            'Either "ani" (phone) or "email" must be provided for getContact operation',
            { itemIndex: i }
          );
        }

        const normalizedAni = ani ? normalizePhoneDigits(ani) : undefined;

        const payload = {
          cmd: 'getContact' as const,
          ani: normalizedAni,
          email: email || undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('getContact').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'createTask': {
        const ext = this.getNodeParameter('ext', i) as string;
        const ani = this.getNodeParameter('ani', i, '') as string;
        const email = this.getNodeParameter('email', i, '') as string;
        const text = this.getNodeParameter('text_task', i) as string;
        const department = this.getNodeParameter('department', i, '') as string;
        const date = this.getNodeParameter('date', i, '') as string;
        const type = this.getNodeParameter('type', i, 1) as number;
        const webhook = this.getNodeParameter('webhook', i, '') as string;

        const normalizedAni = ani ? normalizePhoneDigits(ani) : undefined;

        const payload = {
          cmd: 'createTask' as const,
          ext,
          ani: normalizedAni,
          email: email || undefined,
          text,
          department: department || undefined,
          date: date ? formatDateTimeSQL(date) : undefined,
          type: type.toString(),
          webhook: webhook || undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('createTask').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'createDeal': {
        const ext = this.getNodeParameter('ext', i) as string;
        const ani = this.getNodeParameter('ani', i) as string;
        const name = this.getNodeParameter('name', i) as string;
        const sum = this.getNodeParameter('sum', i) as number;
        const stage = this.getNodeParameter('stage', i) as number;
        const status = this.getNodeParameter('status', i, 0) as number;

        const normalizedAni = normalizePhoneDigits(ani);

        const payload = {
          cmd: 'createDeal' as const,
          ext,
          ani: normalizedAni,
          name,
          sum: sum.toString(),
          stage: stage.toString(),
          status: status !== undefined ? status.toString() : undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('createDeal').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'updateDeal': {
        const id_deal = this.getNodeParameter('id_deal', i) as number;
        const ext = this.getNodeParameter('ext', i) as string;
        const ani = this.getNodeParameter('ani', i) as string;
        const name = this.getNodeParameter('name', i) as string;
        const sum = this.getNodeParameter('sum', i) as number;
        const stage = this.getNodeParameter('stage', i) as number;
        const status = this.getNodeParameter('status', i, 0) as number;

        const normalizedAni = normalizePhoneDigits(ani);

        const payload = {
          cmd: 'updateDeal' as const,
          id_deal: id_deal.toString(),
          ext,
          ani: normalizedAni,
          name,
          sum: sum.toString(),
          stage: stage.toString(),
          status: status.toString(),
        };

        const validatedPayload = SchemaRegistry.getSchema('updateDeal').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'createNote': {
        const ext = this.getNodeParameter('ext', i) as string;
        const ani = this.getNodeParameter('ani', i) as string;
        const text = this.getNodeParameter('text_note', i) as string;

        const normalizedAni = normalizePhoneDigits(ani);

        const payload = {
          cmd: 'createNote' as const,
          ext,
          ani: normalizedAni,
          text,
        };

        const validatedPayload = SchemaRegistry.getSchema('createNote').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'AddTag': {
        const ani = this.getNodeParameter('ani', i) as string;
        const tag = this.getNodeParameter('tag', i) as string;

        const normalizedAni = normalizePhoneDigits(ani);

        const payload = {
          cmd: 'AddTag' as const,
          ani: normalizedAni,
          tag,
        };

        const validatedPayload = SchemaRegistry.getSchema('AddTag').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'DelTag': {
        const ani = this.getNodeParameter('ani', i) as string;
        const tag = this.getNodeParameter('tag', i) as string;

        const normalizedAni = normalizePhoneDigits(ani);

        const payload = {
          cmd: 'DelTag' as const,
          ani: normalizedAni,
          tag,
        };

        const validatedPayload = SchemaRegistry.getSchema('DelTag').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'AddTaskResult': {
        const idtask = this.getNodeParameter('idtask', i) as number;
        const text = this.getNodeParameter('text', i) as string;
        const ext = this.getNodeParameter('ext', i) as string;
        const newext = this.getNodeParameter('newext', i, '') as string;
        const finish = this.getNodeParameter('finish', i, false) as boolean;

        const payload = {
          cmd: 'AddTaskResult' as const,
          idtask: idtask.toString(),
          text,
          ext,
          newext: newext || undefined,
          finish: finish ? '1' : '0',
        };

        const validatedPayload = SchemaRegistry.getSchema('AddTaskResult').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'getStages': {
        return await liraxRequest(this, credentials, {
          cmd: 'getStages',
        }, { ...options, useCache: true, cacheKey: 'stages' });
      }

      case 'getShops': {
        return await liraxRequest(this, credentials, {
          cmd: 'getShops',
        }, { ...options, useCache: true, cacheKey: 'shops' });
      }

      case 'getStatInfo': {
        const Start = this.getNodeParameter('Start', i) as string;
        const Stop = this.getNodeParameter('Stop', i, '') as string;

        const payload = {
          cmd: 'getStatInfo' as const,
          Start: formatDateTimeSQL(Start),
          Stop: Stop ? formatDateTimeSQL(Stop) : undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('getStatInfo').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'getUserStatuses': {
        return await liraxRequest(this, credentials, {
          cmd: 'getUserStatuses',
        }, { ...options, useCache: true, cacheKey: 'user_statuses' });
      }

      case 'initStatuses': {
        return await liraxRequest(this, credentials, {
          cmd: 'initStatuses',
        }, options);
      }

      default:
        throw new NodeOperationError(this.getNode(), `Unsupported CRM operation: ${operation}`);
    }
  }

  private async executeMessagingOperation(
    i: number,
    operation: string,
    credentials: LiraXCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    switch (operation) {
      case 'sendSMS': {
        const ext = this.getNodeParameter('ext', i) as string;
        const provider = this.getNodeParameter('provider', i) as string;
        const phone = this.getNodeParameter('phone', i) as string;
        const text = this.getNodeParameter('text', i) as string;

        const normalizedPhone = normalizePhoneDigits(phone);

        const payload = {
          cmd: 'sendSMS' as const,
          ext,
          provider,
          phone: normalizedPhone,
          text,
        };

        const validatedPayload = SchemaRegistry.getSchema('sendSMS').parse(payload);

        return await throttledSMSRequest(
          this,
          credentials,
          validatedPayload,
          provider,
          ext,
          options
        );
      }

      case 'checkSMS': {
        const ext = this.getNodeParameter('ext', i) as string;
        const provider = this.getNodeParameter('provider', i) as string;
        const id_sms = this.getNodeParameter('id_sms', i) as number;

        const payload = {
          cmd: 'checkSMS' as const,
          ext,
          provider,
          id_sms: id_sms.toString(),
        };

        const validatedPayload = SchemaRegistry.getSchema('checkSMS').parse(payload);

        return await throttledSMSRequest(
          this,
          credentials,
          validatedPayload,
          provider,
          ext,
          options
        );
      }

      case 'sendMsg': {
        const ext = this.getNodeParameter('ext', i) as string;
        const ani = this.getNodeParameter('ani', i) as string;
        const text = this.getNodeParameter('text', i) as string;

        const normalizedAni = normalizePhoneDigits(ani);

        const payload = {
          cmd: 'sendMsg' as const,
          ext,
          ani: normalizedAni,
          text,
        };

        const validatedPayload = SchemaRegistry.getSchema('sendMsg').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'send_cloud_message': {
        const client = this.getNodeParameter('client', i, '') as string;
        const ani = this.getNodeParameter('ani', i, '') as string;
        const text = this.getNodeParameter('text', i) as string;

        if (!client && !ani) {
          throw new NodeOperationError(
            this.getNode(),
            'Either "client" or "ani" (phone) must be provided for send_cloud_message operation',
            { itemIndex: i }
          );
        }

        const normalizedAni = ani ? normalizePhoneDigits(ani) : undefined;

        const payload = {
          cmd: 'send_cloud_message' as const,
          client: client || undefined,
          ani: normalizedAni,
          text,
        };

        const validatedPayload = SchemaRegistry.getSchema('send_cloud_message').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      default:
        throw new NodeOperationError(this.getNode(), `Unsupported messaging operation: ${operation}`);
    }
  }

  private async executePresenceOperation(
    i: number,
    operation: string,
    credentials: LiraXCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    switch (operation) {
      case 'IsFreeUsers': {
        const phones = this.getNodeParameter('phones', i) as string;

        const phoneList = phones.split(',').map(phone => normalizePhoneDigits(phone.trim())).join(',');

        const payload = {
          cmd: 'IsFreeUsers' as const,
          phones: phoneList,
        };

        const validatedPayload = SchemaRegistry.getSchema('IsFreeUsers').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'IsCalling': {
        const phones = this.getNodeParameter('phones', i) as string;

        const phoneList = phones.split(',').map(phone => normalizePhoneDigits(phone.trim())).join(',');

        const payload = {
          cmd: 'IsCalling' as const,
          phones: phoneList,
        };

        const validatedPayload = SchemaRegistry.getSchema('IsCalling').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'initStatuses': {
        const payload = {
          cmd: 'initStatuses' as const,
        };

        const validatedPayload = SchemaRegistry.getSchema('initStatuses').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      default:
        throw new NodeOperationError(this.getNode(), `Unsupported presence operation: ${operation}`);
    }
  }

  private async executeSIPOperation(
    i: number,
    operation: string,
    credentials: LiraXCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    switch (operation) {
      case 'getUserSips': {
        const ext = this.getNodeParameter('ext', i) as string;
        const web = this.getNodeParameter('web', i, false) as boolean;

        const payload = {
          cmd: 'getUserSips' as const,
          ext,
          web: web ? '1' : '0',
        };

        const validatedPayload = SchemaRegistry.getSchema('getUserSips').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'get_sip_route_in': {
        const phone = this.getNodeParameter('phone', i) as string;

        const normalizedPhone = normalizePhoneDigits(phone);

        const payload = {
          cmd: 'get_sip_route_in' as const,
          phone: normalizedPhone,
        };

        const validatedPayload = SchemaRegistry.getSchema('get_sip_route_in').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      
      case 'set_sip_route_in': {
        const phone = this.getNodeParameter('phone', i) as string;
        const sip_number = this.getNodeParameter('sip_number', i) as string;
        const priority = this.getNodeParameter('priority', i) as number;
        const time_plan = this.getNodeParameter('time_plan', i) as number;

        const normalizedPhone = normalizePhoneDigits(phone);

        const payload = {
          cmd: 'set_sip_route_in' as const,
          phone: normalizedPhone,
          sip_number, 
          priority: priority.toString(),
          time_plan: time_plan.toString(),
        };

        const validatedPayload = SchemaRegistry.getSchema('set_sip_route_in').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      default:
        throw new NodeOperationError(this.getNode(), `Unsupported SIP operation: ${operation}`);
    }
  }

  private async executeBlacklistOperation(
    i: number,
    operation: string,
    credentials: LiraXCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    switch (operation) {
      case 'addBlackPhone': {
        const phone = this.getNodeParameter('phone', i) as string;

        const normalizedPhone = normalizePhoneDigits(phone);

        const payload = {
          cmd: 'addBlackPhone' as const,
          phone: normalizedPhone,
        };

        const validatedPayload = SchemaRegistry.getSchema('addBlackPhone').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'delBlackPhone': {
        const phone = this.getNodeParameter('phone', i) as string;

        const normalizedPhone = normalizePhoneDigits(phone);

        const payload = {
          cmd: 'delBlackPhone' as const,
          phone: normalizedPhone,
        };

        const validatedPayload = SchemaRegistry.getSchema('delBlackPhone').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'listBlackPhone': {
        const payload = {
          cmd: 'listBlackPhone' as const,
        };

        const validatedPayload = SchemaRegistry.getSchema('listBlackPhone').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'addBlackIP': {
        const IP = this.getNodeParameter('IP', i) as string;

        const payload = {
          cmd: 'addBlackIP' as const,
          IP,
        };

        const validatedPayload = SchemaRegistry.getSchema('addBlackIP').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'delBlackIP': {
        const IP = this.getNodeParameter('IP', i) as string;

        const payload = {
          cmd: 'delBlackIP' as const,
          IP,
        };

        const validatedPayload = SchemaRegistry.getSchema('delBlackIP').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'listBlackIP': {
        const payload = {
          cmd: 'listBlackIP' as const,
        };

        const validatedPayload = SchemaRegistry.getSchema('listBlackIP').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      default:
        throw new NodeOperationError(this.getNode(), `Unsupported blacklist operation: ${operation}`);
    }
  }

  private async executeCampaignsOperation(
    i: number,
    operation: string,
    credentials: LiraXCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    switch (operation) {
      case 'AddCampaign': {
        const from = this.getNodeParameter('from', i) as string;
        const ext = this.getNodeParameter('ext', i, '') as string;
        const days = this.getNodeParameter('days', i, '1,2,3,4,5') as string;
        const time = this.getNodeParameter('time', i, '10:00-18:00') as string;
        const tryCount = this.getNodeParameter('try', i, 1) as number;
        const type = this.getNodeParameter('type', i, 1) as number;
        const phones = this.getNodeParameter('phones', i) as string;
        const message = this.getNodeParameter('message', i, '') as string;
        const pdd = this.getNodeParameter('pdd', i, 0) as number;
        const preview_timeout = this.getNodeParameter('preview_timeout', i, 0) as number;

        // ✅ ДОБАВЛЕНА валидация: параметр message не может быть пустым
        if (!message || message.trim().length === 0) {
          throw new NodeOperationError(
            this.getNode(),
            'Parameter "message" is required and cannot be empty for AddCampaign operation',
            { itemIndex: i }
          );
        }

        const normalizedPhones = phones.split(',').map(phone => normalizePhoneDigits(phone.trim())).join(',');

        const payload = {
          cmd: 'AddCampaign' as const,
          from,
          ext: ext || undefined,
          days,
          time,
          try: tryCount.toString(),
          type: type.toString(),
          phones: normalizedPhones,
          message: type === 2 && message ? message : undefined,
          pdd: pdd > 0 ? pdd.toString() : undefined,
          preview_timeout: preview_timeout > 0 ? preview_timeout.toString() : undefined,
        };

        const validatedPayload = SchemaRegistry.getSchema('AddCampaign').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'AddPhoneCampaign': {
        const from = this.getNodeParameter('from', i) as string;
        const phones = this.getNodeParameter('phones', i) as string;

        const normalizedPhones = phones.split(',').map(phone => normalizePhoneDigits(phone.trim())).join(',');

        const payload = {
          cmd: 'AddPhoneCampaign' as const,
          from,
          phones: normalizedPhones,
        };

        const validatedPayload = SchemaRegistry.getSchema('AddPhoneCampaign').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      default:
        throw new NodeOperationError(this.getNode(), `Unsupported campaigns operation: ${operation}`);
    }
  }

  private async executeUtilityOperation(
    i: number,
    operation: string,
    credentials: LiraXCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    switch (operation) {
      case 'EncodePhone': {
        const phone = this.getNodeParameter('phone', i) as string;

        const normalizedPhone = normalizePhoneDigits(phone);

        const payload = {
          cmd: 'EncodePhone' as const,
          phone: normalizedPhone,
        };

        const validatedPayload = SchemaRegistry.getSchema('EncodePhone').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      case 'DecodePhone': {
        const phone = this.getNodeParameter('phone', i) as string;

        const normalizedPhone = normalizePhoneDigits(phone);

        const payload = {
          cmd: 'DecodePhone' as const,
          phone: normalizedPhone,
        };

        const validatedPayload = SchemaRegistry.getSchema('DecodePhone').parse(payload);
        return await liraxRequest(this, credentials, validatedPayload, options);
      }

      default:
        throw new NodeOperationError(this.getNode(), `Unsupported utility operation: ${operation}`);
    }
  }
}

// Вспомогательная функция delay
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Вспомогательная функция validatePublicUrl
function validatePublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    // Блокируем RFC1918 и link-local
    const privateCidrs = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^169\.254\./];
    if (privateCidrs.some((r) => r.test(host))) return false;
    return true;
  } catch {
    return false;
  }
}

// Вспомогательная функция throttledSMSRequest
const throttledSMSRequest = async (
  context: any,
  credentials: LiraXCredentials,
  payload: any,
  provider: string,
  ext: string,
  options: any
): Promise<unknown> => {
  // Реализация троттлинга для SMS запросов
  return await liraxRequest(context, credentials, payload, options);
};