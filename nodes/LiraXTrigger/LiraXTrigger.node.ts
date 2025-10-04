import {
  ITriggerFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
  NodeApiError,
  IDataObject,
  IHookFunctions,
} from 'n8n-workflow';

import type { LiraXCredentials } from '../../types/LiraX.types';
import { verifyWebhookToken, parseWebhookBody, maskSensitiveData, validateWebhookPayload } from '../../shared/LiraX.utils';

export class LiraXTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'LiraX Trigger',
    name: 'liraXTrigger',
    icon: 'file:lirax.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["eventFilter"].length ? $parameter["eventFilter"].join(", ") : "All Events"}}',
    description: 'Handle LiraX webhook events for calls, SMS, contacts and system events with advanced processing and response capabilities',
    defaults: {
      name: 'LiraX Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'liraXApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        path: 'lirax',
      },
    ],
    properties: [
      {
        displayName: 'Event Filter',
        name: 'eventFilter',
        type: 'multiOptions',
        options: [
          {
            name: '📞 Contact Lookup',
            value: 'contact',
            description: 'When LiraX requests contact information for incoming call - requires Response Node',
          },
          {
            name: '📞 Call Events',
            value: 'event',
            description: 'Various call events (incoming, accepted, completed)',
          },
          {
            name: '🔊 Call Recording Available',
            value: 'record',
            description: 'When call recording is ready for download',
          },
          {
            name: '💬 SMS Received',
            value: 'smsReceived',
            description: 'When new SMS message is received',
          },
          {
            name: '✅ SMS Delivered',
            value: 'smsDelivered',
            description: 'When SMS message is successfully delivered',
          },
          {
            name: '👤 User Status Changed',
            value: 'staton',
            description: 'When user presence status changes',
          },
          {
            name: '📞 MakeCall Finished',
            value: 'makecall_finished',
            description: 'When MakeCall operation completes',
          },
          {
            name: '🔀 Make2Calls Finished',
            value: 'make2calls_finished',
            description: 'When Make2Calls or AskQuestion operation completes with IVR results',
          },
          {
            name: '🎯 Task Completed',
            value: 'task_completed',
            description: 'When task is marked as completed',
          },
          {
            name: '💰 Deal Updated',
            value: 'deal_updated',
            description: 'When deal status or stage changes',
          },
        ],
        default: [],
        description: 'Which events to trigger on. Leave empty to receive all events',
        hint: 'Filter events to reduce noise and improve performance. Contact events require LiraX Response node',
      },
      {
        displayName: '🛠️ Advanced Webhook Settings',
        name: 'advancedSettings',
        type: 'collection',
        placeholder: 'Add Setting',
        default: {},
        options: [
          {
            displayName: 'Webhook Path',
            name: 'webhookPath',
            type: 'string',
            default: 'lirax',
            description: 'Custom path for webhook URL. Change if you need multiple LiraX triggers',
            placeholder: 'lirax',
          },
          {
            displayName: 'Validate Webhook Token',
            name: 'validateToken',
            type: 'boolean',
            default: true,
            description: 'Whether to validate the webhook token for security',
          },
          {
            displayName: 'Log Webhook Payload',
            name: 'logPayload',
            type: 'boolean',
            default: false,
            description: 'Log full webhook payload for debugging (may contain sensitive data)',
          },
          {
            displayName: 'Response Delay (ms)',
            name: 'responseDelay',
            type: 'number',
            default: 0,
            description: 'Artificial delay before sending response (for testing)',
          },
          {
            displayName: 'Webhook Timeout (seconds)',
            name: 'webhookTimeout',
            type: 'number',
            default: 30,
            description: 'Maximum time to wait for webhook processing',
          },
        ],
      },
      {
        displayName: '🔧 IVR Processing Settings',
        name: 'ivrSettings',
        type: 'collection',
        placeholder: 'Add IVR Setting',
        default: {},
        options: [
          {
            displayName: 'Parse IVR Keys',
            name: 'parseIVRKeys',
            type: 'boolean',
            default: true,
            description: 'Whether to parse and structure IVR key presses',
          },
          {
            displayName: 'Build IVR Path',
            name: 'buildIVRPath',
            type: 'boolean',
            default: true,
            description: 'Build complete IVR navigation path from key presses',
          },
          {
            displayName: 'Calculate IVR Timing',
            name: 'calculateIVRTiming',
            type: 'boolean',
            default: true,
            description: 'Calculate timing between IVR key presses',
          },
          {
            displayName: 'Max IVR Depth',
            name: 'maxIVRDepth',
            type: 'number',
            default: 10,
            description: 'Maximum number of IVR levels to process',
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
            displayName: 'Track Call Metrics',
            name: 'trackCallMetrics',
            type: 'boolean',
            default: true,
            description: 'Track call duration, wait time, and other metrics',
          },
          {
            displayName: 'Calculate Success Rates',
            name: 'calculateSuccessRates',
            type: 'boolean',
            default: true,
            description: 'Calculate success rates for operations',
          },
          {
            displayName: 'Monitor User Performance',
            name: 'monitorUserPerformance',
            type: 'boolean',
            default: false,
            description: 'Track user performance metrics',
          },
        ],
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        if (webhookData.webhookId) {
          return true;
        }
        return false;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        const webhookUrl = this.getNodeWebhookUrl('default');
        webhookData.webhookId = webhookUrl;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        delete webhookData.webhookId;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData();
    const req = this.getRequestObject();
    const credentials = await this.getCredentials('liraXApi') as LiraXCredentials;
    const eventFilter = this.getNodeParameter('eventFilter', []) as string[];
    const advancedSettings = this.getNodeParameter('advancedSettings', {}) as IDataObject;
    const ivrSettings = this.getNodeParameter('ivrSettings', {}) as IDataObject;
    const analyticsSettings = this.getNodeParameter('analyticsSettings', {}) as IDataObject;

    const validateToken = advancedSettings.validateToken !== false;
    const logPayload = advancedSettings.logPayload === true;
    const responseDelay = (advancedSettings.responseDelay as number) || 0;
    const webhookTimeout = (advancedSettings.webhookTimeout as number) || 30;

    try {
      const webhookData = parseWebhookBody(bodyData);
      const validatedPayload = validateWebhookPayload(webhookData);
      const { cmd, from_LiraX_token } = validatedPayload;

      if (logPayload) {
        const maskedPayload = maskSensitiveData(webhookData as IDataObject);
        console.log('LiraX Webhook Payload Received:', {
          cmd,
          headers: req.headers,
          body: maskedPayload,
          timestamp: new Date().toISOString(),
          workflowId: this.getWorkflow().id,
        });
      }

      if (validateToken) {
        try {
          verifyWebhookToken(from_LiraX_token as string, credentials.incomingToken, this);
        } catch (error) {
          throw new NodeApiError(this.getNode(), error as Error, {
            httpCode: 401,
            message: 'Webhook token verification failed',
          });
        }
      }

      if (eventFilter.length > 0 && !eventFilter.includes(cmd as string)) {
        return {
          noWebhookResponse: true,
        };
      }

      if (responseDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, responseDelay));
      }

      let workflowData: IDataObject;

      try {
        switch (cmd) {
          case 'contact':
            workflowData = this.processContactEvent(webhookData);
            break;

          case 'event':
            workflowData = this.processCallEvent(webhookData, analyticsSettings);
            break;

          case 'record':
            workflowData = this.processRecordEvent(webhookData);
            break;

          case 'smsReceived':
            workflowData = this.processSmsReceivedEvent(webhookData);
            break;

          case 'smsDelivered':
            workflowData = this.processSmsDeliveredEvent(webhookData);
            break;

          case 'staton':
            workflowData = this.processStatusEvent(webhookData);
            break;

          case 'makecall_finished':
            workflowData = this.processMakeCallFinishedEvent(webhookData);
            break;

          case 'make2calls_finished':
            workflowData = this.processMake2CallsFinishedEvent(webhookData, ivrSettings);
            break;

          case 'task_completed':
            workflowData = this.processTaskCompletedEvent(webhookData);
            break;

          case 'deal_updated':
            workflowData = this.processDealUpdatedEvent(webhookData);
            break;

          default:
            workflowData = this.processUnknownEvent(webhookData);
        }
      } catch (error) {
        throw new NodeApiError(this.getNode(), error as Error, {
          message: `Failed to process webhook event: ${cmd}`,
        });
      }

      return {
        workflowData: [[workflowData]],
      };

    } catch (error) {
      console.error('LiraX Webhook Processing Error:', {
        error: error.message,
        timestamp: new Date().toISOString(),
        workflowId: this.getWorkflow().id,
      });

      throw error;
    }
  }

  private processContactEvent(data: IDataObject): IDataObject {
    const contactData = {
      event: 'contact',
      event_type: 'contact_lookup',
      phone: data.phone,
      callid: data.callid,
      diversion: data.diversion,
      timestamp: new Date().toISOString(),
      metadata: {
        description: 'LiraX is requesting contact information for incoming call',
        action_required: 'Use LiraX Response node to send contact details back',
        requires_response: true,
        response_timeout: 30,
      },
      raw: maskSensitiveData(data),
    };

    return {
      json: contactData,
    };
  }

  private processCallEvent(data: IDataObject, analyticsSettings: IDataObject): IDataObject {
    const trackMetrics = analyticsSettings.trackCallMetrics !== false;

    const callEvent = {
      event: 'call',
      event_type: data.event,
      call_type: data.type,
      phone: data.phone,
      diversion: data.diversion,
      ext: data.ext,
      callid: data.callid,
      duration: data.duration,
      call_duration: data.call_duration,
      is_recorded: data.is_recorded,
      status: data.status,
      record_link: data.record_link,
      keys: this.parseIVRKeys(data.keys),
      utm: {
        tid: data.tid,
        cid: data.cid,
        cs: data.cs,
        cm: data.cm,
        cc: data.cc,
        ct: data.ct,
      },
      timestamp: new Date().toISOString(),
      metadata: {
        description: this.getCallEventDescription(data.event as string, data.type as string),
        priority: this.getCallEventPriority(data.event as string),
        analytics: trackMetrics ? this.calculateCallAnalytics(data) : undefined,
      },
      raw: maskSensitiveData(data),
    };

    return { json: callEvent };
  }

  private processRecordEvent(data: IDataObject): IDataObject {
    return {
      json: {
        event: 'record',
        event_type: 'recording_available',
        callid: data.callid,
        record_link: data.record_link,
        file_size: data.file_size,
        duration: data.duration,
        timestamp: new Date().toISOString(),
        metadata: {
          description: 'Call recording is now available for download',
          action_required: 'Download and process recording if needed',
          download_url: data.record_link,
          format: this.detectAudioFormat(data.record_link as string),
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private processSmsReceivedEvent(data: IDataObject): IDataObject {
    return {
      json: {
        event: 'sms',
        event_type: 'sms_received',
        id_sms: data.id,
        ani: data.ani,
        provider: data.provider,
        text: data.text,
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: {
          description: 'New SMS message received',
          direction: 'inbound',
          character_count: (data.text as string)?.length || 0,
          contains_unicode: this.containsUnicode(data.text as string),
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private processSmsDeliveredEvent(data: IDataObject): IDataObject {
    return {
      json: {
        event: 'sms',
        event_type: 'sms_delivered',
        id_sms: data.id_sms,
        status: data.status,
        delivery_timestamp: data.timestamp || new Date().toISOString(),
        timestamp: new Date().toISOString(),
        metadata: {
          description: 'SMS message successfully delivered',
          direction: 'outbound',
          delivery_confirmation: true,
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private processStatusEvent(data: IDataObject): IDataObject {
    const statusMeanings = {
      '1': 'Available',
      '2': 'Busy',
      '3': 'Away',
      '4': 'Offline',
      '5': 'Do Not Disturb',
      '6': 'Break',
      '7': 'Meeting',
    };

    return {
      json: {
        event: 'presence',
        event_type: 'status_changed',
        ext: data.ext,
        status: data.status,
        status_text: statusMeanings[data.status as string] || 'Unknown',
        previous_status: data.previous_status,
        timestamp: new Date().toISOString(),
        metadata: {
          description: 'User presence status updated',
          status_meanings: statusMeanings,
          availability: this.calculateAvailability(data.status as string),
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private processMakeCallFinishedEvent(data: IDataObject): IDataObject {
    return {
      json: {
        event: 'operation',
        event_type: 'makecall_finished',
        id_makecall: data.id_makecall,
        Call_id: data.Call_id,
        success: data.success,
        duration: data.duration,
        error_message: data.error_message,
        timestamp: new Date().toISOString(),
        metadata: {
          description: 'MakeCall operation completed',
          success: data.success === 1,
          call_established: !!data.Call_id,
          has_error: !!data.error_message,
          operation_type: 'makeCall',
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private processMake2CallsFinishedEvent(data: IDataObject, ivrSettings: IDataObject): IDataObject {
    const parseKeys = ivrSettings.parseIVRKeys !== false;
    const buildPath = ivrSettings.buildIVRPath !== false;
    const calculateTiming = ivrSettings.calculateIVRTiming !== false;
    const maxDepth = (ivrSettings.maxIVRDepth as number) || 10;

    const keys = parseKeys ? this.parseIVRKeys(data.keys, maxDepth) : [];
    const ivrAnalysis = parseKeys ? this.analyzeIVRKeys(keys, buildPath, calculateTiming) : {};

    return {
      json: {
        event: 'operation',
        event_type: 'make2calls_finished',
        id_make2calls: data.id_make2calls,
        success: data.success,
        duration_success: data.duration_success,
        keys,
        timestamp: new Date().toISOString(),
        metadata: {
          description: 'Make2Calls or AskQuestion operation completed',
          success: data.success === 1,
          has_ivr_results: keys.length > 0,
          ivr_path: buildPath ? keys.map(k => k.key).join(' → ') : undefined,
          ivr_analytics: ivrAnalysis,
          operation_type: data.operation_type || 'make2Calls',
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private processTaskCompletedEvent(data: IDataObject): IDataObject {
    return {
      json: {
        event: 'task',
        event_type: 'task_completed',
        id_task: data.id_task,
        task_type: data.task_type,
        result: data.result,
        completed_by: data.completed_by,
        completion_time: data.completion_time || new Date().toISOString(),
        timestamp: new Date().toISOString(),
        metadata: {
          description: 'Task marked as completed',
          has_result: !!data.result,
          result_length: (data.result as string)?.length || 0,
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private processDealUpdatedEvent(data: IDataObject): IDataObject {
    return {
      json: {
        event: 'deal',
        event_type: 'deal_updated',
        id_deal: data.id_deal,
        deal_name: data.deal_name,
        old_stage: data.old_stage,
        new_stage: data.new_stage,
        old_status: data.old_status,
        new_status: data.new_status,
        amount: data.amount,
        timestamp: new Date().toISOString(),
        metadata: {
          description: 'Deal stage or status updated',
          stage_changed: data.old_stage !== data.new_stage,
          status_changed: data.old_status !== data.new_status,
          progress: this.calculateDealProgress(data.new_stage as number),
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private processUnknownEvent(data: IDataObject): IDataObject {
    return {
      json: {
        event: 'unknown',
        event_type: data.cmd,
        timestamp: new Date().toISOString(),
        metadata: {
          description: 'Unknown webhook event type',
          warning: 'This event type is not fully supported',
          recommended_action: 'Check LiraX documentation for updates',
        },
        raw: maskSensitiveData(data),
      },
    };
  }

  private parseIVRKeys(keysData: unknown, maxDepth: number = 10): Array<{ivr_name: string; ivr_entry: string; key: string; timestamp?: string; duration?: number}> {
    if (!keysData) {
      return [];
    }

    try {
      let keys: any[] = [];

      if (typeof keysData === 'string') {
        const parsed = JSON.parse(keysData);
        keys = Array.isArray(parsed) ? parsed : [];
      } else if (Array.isArray(keysData)) {
        keys = keysData;
      } else if (typeof keysData === 'object') {
        keys = [keysData];
      }

      return keys.slice(0, maxDepth).map((key, index) => ({
        ivr_name: key.ivr_name || `Level_${index + 1}`,
        ivr_entry: key.ivr_entry || 'unknown',
        key: key.key || key.dtmf || 'unknown',
        timestamp: key.timestamp || key.time,
        duration: key.duration,
        sequence: index + 1,
        is_final: index === keys.length - 1,
      }));
    } catch (error) {
      console.warn('Failed to parse IVR keys:', error);
      return [];
    }
  }

  private analyzeIVRKeys(keys: Array<{ivr_name: string; ivr_entry: string; key: string; timestamp?: string; duration?: number}>, buildPath: boolean = true, calculateTiming: boolean = true): IDataObject {
    if (!keys || keys.length === 0) {
      return { empty: true, key_count: 0 };
    }

    const analysis: IDataObject = {
      key_count: keys.length,
      unique_keys: new Set(keys.map(k => k.key)).size,
      final_key: keys[keys.length - 1]?.key,
      first_key: keys[0]?.key,
      key_sequence: keys.map(k => k.key).join(''),
    };

    if (buildPath) {
      analysis.full_path = keys.map(k => `${k.ivr_name}:${k.key}`).join(' → ');
      analysis.ivr_steps = keys.map((key, index) => ({
        step: index + 1,
        menu: key.ivr_name,
        selection: key.key,
        timestamp: key.timestamp,
      }));
    }

    if (calculateTiming && keys.every(k => k.timestamp)) {
      const timestamps = keys.map(k => new Date(k.timestamp!).getTime());
      analysis.time_analysis = {
        total_duration: timestamps[timestamps.length - 1] - timestamps[0],
        average_step_time: (timestamps[timestamps.length - 1] - timestamps[0]) / Math.max(keys.length - 1, 1),
        step_times: keys.slice(1).map((key, index) => ({
          from: keys[index].key,
          to: key.key,
          duration: timestamps[index + 1] - timestamps[index],
        })),
      };
    }

    analysis.key_distribution = keys.reduce((acc, key) => {
      acc[key.key] = (acc[key.key] || 0) + 1;
      return acc;
    }, {} as IDataObject);

    return analysis;
  }

  private getCallEventDescription(event: string, type: string): string {
    const eventDescriptions: {[key: string]: string} = {
      'INCOMING': 'Incoming call received',
      'ACCEPTED': 'Call answered by agent',
      'COMPLETED': 'Call conversation completed',
      'CALL_COMPLETED': 'Call fully completed',
      'MISSED': 'Call missed by agent',
      'REJECTED': 'Call rejected by agent',
      'FAILED': 'Call failed to connect',
      'RINGING': 'Call is ringing',
      'TRANSFER': 'Call transferred',
      'CONFERENCE': 'Call joined conference',
    };

    const typeDescriptions: {[key: string]: string} = {
      'in': 'Incoming call',
      'out': 'Outgoing call',
      'internal': 'Internal call',
    };

    const eventDesc = eventDescriptions[event] || `Call event: ${event}`;
    const typeDesc = typeDescriptions[type] || `Type: ${type}`;

    return `${eventDesc} (${typeDesc})`;
  }

  private getCallEventPriority(event: string): string {
    const priorities: {[key: string]: string} = {
      'INCOMING': 'high',
      'RINGING': 'high',
      'ACCEPTED': 'medium',
      'COMPLETED': 'low',
      'CALL_COMPLETED': 'low',
      'MISSED': 'medium',
      'REJECTED': 'medium',
      'FAILED': 'medium',
      'TRANSFER': 'medium',
      'CONFERENCE': 'medium',
    };

    return priorities[event] || 'medium';
  }

  private calculateCallAnalytics(data: IDataObject): IDataObject {
    const analytics: IDataObject = {};

    if (data.duration) {
      analytics.duration_seconds = parseInt(data.duration as string) || 0;
      analytics.duration_category = this.categorizeDuration(analytics.duration_seconds as number);
    }

    if (data.call_duration) {
      analytics.talk_time_seconds = parseInt(data.call_duration as string) || 0;
      analytics.wait_time_seconds = (analytics.duration_seconds as number) - (analytics.talk_time_seconds as number);
    }

    analytics.call_direction = data.type === 'in' ? 'inbound' : 'outbound';
    analytics.has_recording = !!data.is_recorded;
    analytics.recording_available = !!data.record_link;

    return analytics;
  }

  private categorizeDuration(duration: number): string {
    if (duration < 30) return 'very_short';
    if (duration < 120) return 'short';
    if (duration < 300) return 'medium';
    if (duration < 600) return 'long';
    return 'very_long';
  }

  private calculateAvailability(status: string): string {
    const availableStatuses = ['1', '5'];
    const busyStatuses = ['2', '6', '7'];
    const awayStatuses = ['3'];
    const offlineStatuses = ['4'];

    if (availableStatuses.includes(status)) return 'available';
    if (busyStatuses.includes(status)) return 'busy';
    if (awayStatuses.includes(status)) return 'away';
    if (offlineStatuses.includes(status)) return 'offline';
    return 'unknown';
  }

  private containsUnicode(text: string): boolean {
    return /[^\u0000-\u007F]/.test(text);
  }

  private detectAudioFormat(url: string): string {
    if (url.includes('.mp3')) return 'mp3';
    if (url.includes('.wav')) return 'wav';
    if (url.includes('.ogg')) return 'ogg';
    if (url.includes('.m4a')) return 'm4a';
    return 'unknown';
  }

  private calculateDealProgress(stage: number): number {
    const stageProgress: {[key: number]: number} = {
      1: 10,
      2: 25,
      3: 50,
      4: 75,
      5: 90,
      6: 100,
    };
    return stageProgress[stage] || 0;
  }
}