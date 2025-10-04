import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

// ==================== RESOURCE SELECTION ====================
export const resourceProperties: INodeProperties[] = [
  {
    displayName: 'Resource',
    name: 'resource',
    type: 'options',
    noDataExpression: true,
    options: [
      {
        name: '📞 Telephony',
        value: 'telephony',
        description: 'Voice calls, IVR, call management and call analytics',
      },
      {
        name: '👥 CRM',
        value: 'crm',
        description: 'Contacts, deals, tasks, notes and customer management',
      },
      {
        name: '💬 Messaging',
        value: 'messaging',
        description: 'SMS messaging and internal communications',
      },
      {
        name: '🔄 Presence & Status',
        value: 'presence',
        description: 'User availability and call status monitoring',
      },
      {
        name: '📡 SIP Routing',
        value: 'sip',
        description: 'SIP number management and routing configuration',
      },
      {
        name: '🚫 Blacklist',
        value: 'blacklist',
        description: 'Phone number and IP address blocking',
      },
      {
        name: '🎯 Campaigns',
        value: 'campaigns',
        description: 'Mass calling and SMS campaigns',
      },
      {
        name: '🔧 Utility',
        value: 'utility',
        description: 'Phone number encoding and utility functions',
      },
    ],
    default: 'telephony',
    description: 'Select which LiraX service category to use',
  },
];

// ==================== TELEPHONY OPERATIONS ====================
export const telephonyOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['telephony'] },
    },
    options: [
      {
        name: '📞 Make Call',
        value: 'makeCall',
        description: 'Initiate a call from employee to customer',
        action: 'Make a phone call',
      },
      {
        name: '⏹️ Kill Call',
        value: 'killCall',
        description: 'Forcefully terminate an active call',
        action: 'Terminate a call',
      },
      {
        name: '🔀 Make 2 Calls',
        value: 'make2Calls',
        description: 'Connect two subscribers together with optional speech',
        action: 'Connect two calls',
      },
      {
        name: '🎯 Ask Question (IVR)',
        value: 'AskQuestion',
        description: 'Interactive voice response with customer input collection',
        action: 'Ask IVR question',
      },
      {
        name: '📥 Set Callback on Missed Call',
        value: 'set_call_lost',
        description: 'Schedule automatic callback for missed calls',
        action: 'Set callback',
      },
      {
        name: '📊 Get Call Data',
        value: 'get_makecall_data',
        description: 'Retrieve detailed information about specific call',
        action: 'Get call data',
      },
      {
        name: '📈 Get Calls History',
        value: 'get_calls',
        description: 'Retrieve call logs and history for time period',
        action: 'Get call history',
      },
    ],
    default: 'makeCall',
    description: 'The telephony operation to perform',
  },
];

export const telephonyFields: INodeProperties[] = [
  // Make Call Fields
  {
    displayName: 'From (Internal Number)',
    name: 'from',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['makeCall', 'make2Calls', 'AskQuestion'],
      },
    },
    default: '',
    placeholder: '101',
    description: 'Internal extension number of the employee making the call',
    hint: 'This number must be configured and active in your LiraX system',
  },
  {
    displayName: 'To (Phone Number)',
    name: 'to',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['makeCall'],
      },
    },
    default: '',
    placeholder: '380501234567',
    description: 'Customer phone number to call. Will be automatically normalized to digits only',
    hint: 'Include country code. Example: 380501234567 for Ukraine',
  },
  {
    displayName: 'Shop ID',
    name: 'idshop',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['makeCall', 'make2Calls', 'AskQuestion'],
      },
    },
    default: 0,
    description: 'Shop ID from which the call will be made. Use 0 for default',
    hint: 'Get available shops from CRM → Get Shops operation',
  },

  // Kill Call Fields
  {
    displayName: 'Call ID',
    name: 'Call_id',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['killCall'],
      },
    },
    default: '',
    description: 'Unique call identifier from makecall_finished webhook event',
    hint: 'This ID is provided in the webhook when a call is completed',
  },

  // Make 2 Calls Fields
  {
    displayName: 'First Number (To1)',
    name: 'to1',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls', 'AskQuestion'],
      },
    },
    default: '',
    placeholder: '380501234567',
    description: 'Phone number for the first call. Will be normalized to digits',
  },
  {
    displayName: 'Second Number or Audio URL (To2)',
    name: 'to2',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: '',
    placeholder: '380501234568 or https://example.com/welcome.mp3',
    description: 'Phone number for second call or URL to audio file (MP3, WAV)',
    hint: 'For audio files, use direct URLs to MP3 or WAV files',
  },
  {
    displayName: 'Speech Text',
    name: 'speech',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: '',
    placeholder: 'en Hello customer, connecting you now',
    description: 'Text to speech message. Format: "language_code Text". Example: "ru Приветствие"',
    hint: 'Supported languages: en, ru, uk, etc. Use language code followed by text',
  },
  {
    displayName: 'Speech Speed (atmepo)',
    name: 'atmepo',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    options: [
      { name: '0.5x (Slow)', value: '0.5' },
      { name: '0.75x', value: '0.75' },
      { name: '1.0x (Normal)', value: '1.0' },
      { name: '1.25x', value: '1.25' },
      { name: '1.5x', value: '1.5' },
      { name: '2.0x (Fast)', value: '2.0' },
    ],
    default: '1.0',
    description: 'Speed of text-to-speech playback',
  },
  {
    displayName: 'Timeout (Minutes)',
    name: 'timeout',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: 0,
    description: 'Time in minutes for repeated attempts. 0 = single attempt only',
    typeOptions: {
      minValue: 0,
      maxValue: 1440,
    },
    hint: 'Set to 0 for immediate failure, or higher for retry logic',
  },
  {
    displayName: 'Success Time (Seconds)',
    name: 'successtime',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: 0,
    description: 'Minimum call duration in seconds to consider as successful',
    typeOptions: {
      minValue: 0,
      maxValue: 3600,
    },
  },
  {
    displayName: 'Not Before Hour',
    name: 'notbefore',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: 8,
    description: 'Earliest hour to make calls (0-23)',
    typeOptions: {
      minValue: 0,
      maxValue: 23,
    },
  },
  {
    displayName: 'Not After Hour',
    name: 'notafter',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: 20,
    description: 'Latest hour to make calls (0-23)',
    typeOptions: {
      minValue: 0,
      maxValue: 23,
    },
  },
  {
    displayName: 'First Internal',
    name: 'FirstInternal',
    type: 'boolean',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: false,
    description: 'Whether the first number is internal',
  },
  {
    displayName: 'Second Internal',
    name: 'SecondInternal',
    type: 'boolean',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: false,
    description: 'Whether the second number is internal',
  },
  {
    displayName: 'Speech No Wait',
    name: 'SpeechNoWait',
    type: 'boolean',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: false,
    description: 'Play speech instead of ringtones when calling second subscriber',
  },
  {
    displayName: 'Time (vtime)',
    name: 'vtime',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: '',
    placeholder: '14:30',
    description: 'Time in HH:mm format for the call',
  },
  {
    displayName: 'Date (vdate)',
    name: 'vdate',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: '',
    placeholder: '31.12.2023',
    description: 'Date in dd.mm.YYYY format for the call',
  },
  {
    displayName: 'Money (vmoney)',
    name: 'vmoney',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['make2Calls'],
      },
    },
    default: '',
    placeholder: '100.50',
    description: 'Monetary amount for the call',
  },

  // AskQuestion Fields
  {
    displayName: 'Question Text',
    name: 'ask',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    placeholder: 'Press 1 for sales, 2 for support, 3 for billing',
    description: 'The question or menu that will be read to the customer',
    hint: 'Be clear about the options available to the customer',
  },
  {
    displayName: 'Valid Responses',
    name: 'ok',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    placeholder: '1 2 3 0',
    description: 'Space-separated list of valid DTMF responses',
    hint: 'Common options: "1 2 3 0" or "yes no" for voice recognition',
  },
  {
    displayName: 'Greeting Message',
    name: 'hello',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    description: 'Optional greeting message before the question',
  },
  {
    displayName: 'Text 1',
    name: 'text1',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    description: 'Additional text message 1',
  },
  {
    displayName: 'Text 2',
    name: 'text2',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    description: 'Additional text message 2',
  },
  {
    displayName: 'Text 3',
    name: 'text3',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    description: 'Additional text message 3',
  },
  {
    displayName: 'Text 4',
    name: 'text4',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    description: 'Additional text message 4',
  },
  {
    displayName: 'Goodbye Message',
    name: 'bye',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    description: 'Optional goodbye message after the question',
  },
  {
    displayName: 'Callback URL',
    name: 'cburl',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['AskQuestion'],
      },
    },
    default: '',
    placeholder: 'https://your-n8n.com/webhook/lirax-ivr',
    description: 'Webhook URL to receive IVR results',
    hint: 'Use LiraX Trigger node to handle the callback',
  },

  // Set Call Lost Fields
  {
    displayName: 'Phone Number',
    name: 'phone',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['set_call_lost'],
      },
    },
    default: '',
    placeholder: '380501234567',
    description: 'Phone number that missed the call',
  },
  {
    displayName: 'Internal Extension',
    name: 'ext',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['set_call_lost'],
      },
    },
    default: '',
    placeholder: '101',
    description: 'Internal extension that missed the call',
    hint: 'This must be a valid internal extension number, not a phone number',
  },
  {
    displayName: 'Time Plan (Days)',
    name: 'time_plan',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['set_call_lost'],
      },
    },
    default: 1,
    description: 'Number of days for the callback plan',
    typeOptions: {
      minValue: 1,
      maxValue: 365,
    },
  },
  {
    displayName: 'Max Retry Attempts',
    name: 'max_try',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['set_call_lost'],
      },
    },
    default: 3,
    description: 'Maximum number of callback attempts',
    typeOptions: {
      minValue: 1,
      maxValue: 50,
    },
  },
  {
    displayName: 'Interval (Hours)',
    name: 'interval',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['set_call_lost'],
      },
    },
    default: 6,
    description: 'Interval between callback attempts in hours',
    typeOptions: {
      minValue: 6,
      maxValue: 168,
    },
    hint: 'Must be multiple of 6 (6, 12, 18, 24, etc.)',
  },
  {
    displayName: 'Callback Time Units',
    name: 'timeUnits',
    type: 'collection',
    placeholder: 'Add Time Unit',
    default: {},
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['set_call_lost'],
      },
    },
    description: 'Additional time units for callback scheduling',
    options: [
      {
        displayName: 'Minutes',
        name: 'minutes',
        type: 'number',
        default: 0,
        description: 'Additional minutes until callback',
        typeOptions: {
          minValue: 0,
          maxValue: 59,
        },
      },
      {
        displayName: 'Hours',
        name: 'hours',
        type: 'number',
        default: 0,
        description: 'Additional hours until callback',
        typeOptions: {
          minValue: 0,
          maxValue: 23,
        },
      },
      {
        displayName: 'Days',
        name: 'days',
        type: 'number',
        default: 0,
        description: 'Additional days until callback',
        typeOptions: {
          minValue: 0,
          maxValue: 30,
        },
      },
      {
        displayName: 'Weeks',
        name: 'weeks',
        type: 'number',
        default: 0,
        description: 'Additional weeks until callback',
        typeOptions: {
          minValue: 0,
          maxValue: 52,
        },
      },
      {
        displayName: 'Months',
        name: 'months',
        type: 'number',
        default: 0,
        description: 'Additional months until callback',
        typeOptions: {
          minValue: 0,
          maxValue: 12,
        },
      },
    ],
  },
  {
    displayName: 'Additional Info',
    name: 'info',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['set_call_lost'],
      },
    },
    default: '',
    description: 'Additional information for the callback',
    typeOptions: {
      rows: 2,
    },
  },

  // Get Calls Fields
  {
    displayName: 'API Limits',
    name: 'getCallsNotice',
    type: 'notice',
    default: '<strong>API Limitation:</strong> The time window between Start and End dates cannot exceed 48 hours. For larger exports, process data in sequential 48-hour chunks.',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['get_calls'],
      },
    },
  },
  {
    displayName: 'Start Date',
    name: 'date_start',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['get_calls'],
      },
    },
    default: '',
    placeholder: '={{ $now.minus({ hours: 48 }).toFormat("yyyy-MM-dd HH:mm:ss") }}',
    description: 'Start of time period in SQL format: YYYY-MM-DD HH:MM:SS',
    hint: 'Maximum time window is 48 hours. Use n8n expressions for dynamic dates.',
  },
  {
    displayName: 'End Date',
    name: 'date_finish',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['get_calls'],
      },
    },
    default: '={{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}',
    placeholder: '={{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}',
    description: 'End of time period in SQL format. Max 48 hours from start',
  },
  {
    displayName: 'Call Type',
    name: 'call_type',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['get_calls'],
      },
    },
    options: [
      { name: 'All Types', value: -1 },
      { name: 'Incoming', value: 0 },
      { name: 'Outgoing', value: 1 },
    ],
    default: -1,
    description: 'Filter by call direction',
  },
  {
    displayName: 'Caller Number (ANI)',
    name: 'ani',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['get_calls'],
      },
    },
    default: '',
    description: 'Filter by caller phone number',
  },
  {
    displayName: 'Called Number (DNIS)',
    name: 'dnis',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['get_calls'],
      },
    },
    default: '',
    description: 'Filter by called phone number',
  },
  {
    displayName: 'Offset',
    name: 'offset',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['telephony'],
        operation: ['get_calls'],
      },
    },
    default: 0,
    description: 'Offset for pagination (number of records to skip)',
    typeOptions: {
      minValue: 0,
    },
  },
];

// ==================== CRM OPERATIONS ====================
export const crmOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['crm'] },
    },
    options: [
      {
        name: '👤 Check/Create Contact',
        value: 'checkContact',
        description: 'Create new contact or update existing one',
        action: 'Check or create a contact',
      },
      {
        name: '🔍 Get Contact',
        value: 'getContact',
        description: 'Retrieve contact information by phone or email',
        action: 'Get contact information',
      },
      {
        name: '📝 Create Task',
        value: 'createTask',
        description: 'Create a new task for a contact',
        action: 'Create a task',
      },
      {
        name: '💰 Create Deal',
        value: 'createDeal',
        description: 'Create a new sales deal',
        action: 'Create a deal',
      },
      {
        name: '✏️ Update Deal',
        value: 'updateDeal',
        description: 'Update existing deal information',
        action: 'Update a deal',
      },
      {
        name: '📋 Create Note',
        value: 'createNote',
        description: 'Add note to contact record',
        action: 'Create a note',
      },
      {
        name: '➕ Add Tag',
        value: 'AddTag',
        description: 'Add tag to contact',
        action: 'Add tag',
      },
      {
        name: '➖ Delete Tag',
        value: 'DelTag',
        description: 'Delete tag from contact',
        action: 'Delete tag',
      },
      {
        name: '✅ Add Task Result',
        value: 'AddTaskResult',
        description: 'Add result to existing task',
        action: 'Add task result',
      },
      {
        name: '🏪 Get Shops',
        value: 'getShops',
        description: 'Retrieve list of available shops',
        action: 'Get shops',
      },
      {
        name: '📊 Get Stages',
        value: 'getStages',
        description: 'Retrieve sales pipeline stages',
        action: 'Get stages',
      },
      {
        name: '📈 Get Statistics',
        value: 'getStatInfo',
        description: 'Retrieve call statistics for period',
        action: 'Get statistics',
      },
    ],
    default: 'checkContact',
  },
];

export const crmFields: INodeProperties[] = [
  // Common CRM Fields
  {
    displayName: 'Responsible Employee',
    name: 'ext',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['checkContact', 'createTask', 'createDeal', 'updateDeal', 'createNote', 'AddTag', 'DelTag'],
      },
    },
    default: '',
    description: 'Internal number of employee responsible for this contact',
    hint: 'Use Load Options from telephony operations to get valid numbers',
  },
  {
    displayName: 'Phone Number (ANI)',
    name: 'ani',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['checkContact', 'createDeal', 'updateDeal', 'createNote', 'AddTag', 'DelTag'],
      },
    },
    default: '',
    placeholder: '380501234567',
    description: 'Main phone number for the contact',
  },

  // Check Contact Fields
  {
    displayName: 'Contact Name',
    name: 'name',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['checkContact'],
      },
    },
    default: '',
    placeholder: 'John Smith',
    description: 'Full name of the contact',
  },
  {
    displayName: 'Additional Phones',
    name: 'add_phone',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['checkContact'],
      },
    },
    default: '',
    placeholder: '380501234568,380501234569',
    description: 'Additional phone numbers, comma-separated',
  },
  {
    displayName: 'Email Addresses',
    name: 'emails',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['checkContact'],
      },
    },
    default: '',
    placeholder: 'john@example.com,jane@example.com',
    description: 'Email addresses, comma-separated',
  },
  {
    displayName: 'Marketing & Tracking',
    name: 'marketingTracking',
    type: 'collection',
    placeholder: 'Add Tracking Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['checkContact'],
      },
    },
    description: 'UTM tags and tracking IDs for analytics',
    options: [
      {
        displayName: 'Track ID (Google)',
        name: 'trackid',
        type: 'string',
        default: '',
        description: 'Google Analytics Track ID',
      },
      {
        displayName: 'Client ID (Google)',
        name: 'clientid',
        type: 'string',
        default: '',
        description: 'Google Analytics Client ID',
      },
      {
        displayName: 'Site Name',
        name: 'sitename',
        type: 'string',
        default: '',
        description: 'Site name where the contact originated',
      },
      {
        displayName: 'Source',
        name: 'source',
        type: 'string',
        default: '',
        description: 'Traffic source (e.g., google, newsletter)',
      },
      {
        displayName: 'Medium',
        name: 'stype',
        type: 'string',
        default: '',
        description: 'Marketing medium (e.g., cpc, banner)',
      },
      {
        displayName: 'Campaign',
        name: 'campain',
        type: 'string',
        default: '',
        description: 'Campaign name',
      },
      {
        displayName: 'Term',
        name: 'Term',
        type: 'string',
        default: '',
        description: 'Campaign term',
      },
      {
        displayName: 'Tag',
        name: 'tag',
        type: 'string',
        default: '',
        description: 'Custom tag for the contact',
      },
    ],
  },

  // Get Contact Fields
  {
    displayName: 'Search By',
    name: 'searchBy',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['getContact'],
      },
    },
    options: [
      { name: 'Phone Number', value: 'phone' },
      { name: 'Email Address', value: 'email' },
    ],
    default: 'phone',
    description: 'Search contact by phone or email',
  },
  {
    displayName: 'Phone Number',
    name: 'ani',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['getContact'],
        searchBy: ['phone'],
      },
    },
    default: '',
    description: 'Phone number to search for',
  },
  {
    displayName: 'Email Address',
    name: 'email',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['getContact'],
        searchBy: ['email'],
      },
    },
    default: '',
    placeholder: 'john@example.com',
    description: 'Email address to search for',
  },

  // Create Task Fields
  {
    displayName: 'Task Text',
    name: 'text',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createTask'],
      },
    },
    default: '',
    description: 'Description of the task',
    typeOptions: {
      rows: 3,
    },
  },
  {
    displayName: 'Contact Identifier',
    name: 'contactIdentifier',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createTask'],
      },
    },
    options: [
      { name: 'Phone Number', value: 'phone' },
      { name: 'Email Address', value: 'email' },
    ],
    default: 'phone',
    description: 'Use phone or email to identify the contact',
  },
  {
    displayName: 'Phone Number',
    name: 'ani',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createTask'],
        contactIdentifier: ['phone'],
      },
    },
    default: '',
    description: 'Contact phone number',
  },
  {
    displayName: 'Email Address',
    name: 'email',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createTask'],
        contactIdentifier: ['email'],
      },
    },
    default: '',
    description: 'Contact email address',
  },
  {
    displayName: 'Department',
    name: 'department',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createTask'],
      },
    },
    default: '',
    description: 'Department responsible for the task',
  },
  {
    displayName: 'Due Date',
    name: 'date',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createTask'],
      },
    },
    default: '',
    placeholder: '={{ $now.plus({ days: 1 }).toFormat("yyyy-MM-dd HH:mm:ss") }}',
    description: 'Due date for the task in SQL format',
  },
  {
    displayName: 'Task Type',
    name: 'type',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['crm'],
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
    displayName: 'Webhook URL',
    name: 'webhook',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createTask'],
      },
    },
    default: '',
    description: 'URL to receive task completion notifications',
  },

  // Create/Update Deal Fields
  {
    displayName: 'Deal Name',
    name: 'name',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createDeal', 'updateDeal'],
      },
    },
    default: '',
    placeholder: 'New Customer Deal',
    description: 'Name or title of the deal',
  },
  {
    displayName: 'Deal Amount',
    name: 'sum',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createDeal', 'updateDeal'],
      },
    },
    default: 0,
    description: 'Monetary value of the deal',
  },
  {
    displayName: 'Stage',
    name: 'stage',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getStages',
    },
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createDeal', 'updateDeal'],
      },
    },
    default: '',
    description: 'Sales pipeline stage for this deal',
    hint: 'Stages are configured in your LiraX CRM',
  },
  {
    displayName: 'Deal Status',
    name: 'status',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createDeal', 'updateDeal'],
      },
    },
    options: [
      { name: 'Active', value: 0 },
      { name: 'Success', value: 1 },
      { name: 'Failed', value: 2 },
    ],
    default: 0,
    description: 'Current status of the deal',
  },
  {
    displayName: 'Deal ID',
    name: 'id_deal',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['updateDeal'],
      },
    },
    default: 0,
    description: 'ID of the existing deal to update',
  },

  // AddTag/DelTag Fields
  {
    displayName: 'Tag',
    name: 'tag',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['AddTag', 'DelTag'],
      },
    },
    default: '',
    description: 'Tag to add or remove from the contact',
  },

  // AddTaskResult Fields
  {
    displayName: 'Task ID',
    name: 'idtask',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['AddTaskResult'],
      },
    },
    default: 0,
    description: 'ID of the task to update with result',
  },
  {
    displayName: 'Task Result',
    name: 'result',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['AddTaskResult'],
      },
    },
    default: '',
    description: 'Result or outcome of the task',
    typeOptions: {
      rows: 3,
    },
  },
  {
    displayName: 'New Responsible Employee',
    name: 'newext',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['AddTaskResult'],
      },
    },
    default: '',
    description: 'Reassign task to different employee (leave empty to keep current)',
  },
  {
    displayName: 'Finish Task',
    name: 'finish',
    type: 'boolean',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['AddTaskResult'],
      },
    },
    default: false,
    description: 'Whether to mark the task as completed after adding result',
  },

  // Create Note Fields
  {
    displayName: 'Note Text',
    name: 'text',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['createNote'],
      },
    },
    default: '',
    description: 'Content of the note',
    typeOptions: {
      rows: 4,
    },
  },

  // Get Statistics Fields
  {
    displayName: 'API Limits',
    name: 'getStatInfoNotice',
    type: 'notice',
    default: '<strong>API Limitation:</strong> LiraX API recommends calling this command no more than once per hour.',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['getStatInfo'],
      },
    },
  },
  {
    displayName: 'Start Period',
    name: 'Start',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['getStatInfo'],
      },
    },
    default: '={{ $now.minus({ hours: 24 }).toFormat("yyyy-MM-dd HH:mm:ss") }}',
    placeholder: '={{ $now.minus({ hours: 24 }).toFormat("yyyy-MM-dd HH:mm:ss") }}',
    description: 'Start of statistics period',
  },
  {
    displayName: 'End Period',
    name: 'Stop',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['crm'],
        operation: ['getStatInfo'],
      },
    },
    default: '={{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}',
    description: 'End of statistics period (optional, defaults to 24 hours from start)',
  },
];

// ==================== MESSAGING OPERATIONS ====================
export const messagingOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['messaging'] },
    },
    options: [
      {
        name: '💬 Send SMS',
        value: 'sendSMS',
        description: 'Send SMS message to phone number',
        action: 'Send an SMS',
      },
      {
        name: '✅ Check SMS Status',
        value: 'checkSMS',
        description: 'Check delivery status of sent SMS',
        action: 'Check SMS status',
      },
      {
        name: '📨 Send Internal Message',
        value: 'sendMsg',
        description: 'Send internal message to employee',
        action: 'Send internal message',
      },
      {
        name: '☁️ Send Cloud Message',
        value: 'send_cloud_message',
        description: 'Send message via cloud messaging',
        action: 'Send cloud message',
      },
    ],
    default: 'sendSMS',
  },
];

export const messagingFields: INodeProperties[] = [
  // Send SMS Fields
  {
    displayName: 'Employee Number',
    name: 'ext',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['messaging'],
        operation: ['sendSMS', 'checkSMS', 'sendMsg'],
      },
    },
    default: '',
    description: 'Internal number of employee sending the message',
  },
  {
    displayName: 'Provider',
    name: 'provider',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['messaging'],
        operation: ['sendSMS', 'checkSMS'],
      },
    },
    default: 'default',
    description: 'SMS gateway provider name',
  },
  {
    displayName: 'Phone Number',
    name: 'phone',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['messaging'],
        operation: ['sendSMS'],
      },
    },
    default: '',
    placeholder: '380501234567',
    description: 'Recipient phone number',
  },
  {
    displayName: 'Message Text',
    name: 'text',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['messaging'],
        operation: ['sendSMS', 'sendMsg', 'send_cloud_message'],
      },
    },
    default: '',
    typeOptions: {
      rows: 3,
    },
    description: 'Content of the message to send',
  },
  {
    displayName: 'SMS ID',
    name: 'id_sms',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['messaging'],
        operation: ['checkSMS'],
      },
    },
    default: 0,
    description: 'ID of the SMS message to check',
  },
  {
    displayName: 'Recipient Type',
    name: 'recipientType',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['messaging'],
        operation: ['send_cloud_message'],
      },
    },
    options: [
      { name: 'Client ID', value: 'client' },
      { name: 'Phone Number', value: 'phone' },
    ],
    default: 'client',
    description: 'Send message to client ID or phone number',
  },
  {
    displayName: 'Client ID',
    name: 'client',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['messaging'],
        operation: ['send_cloud_message'],
        recipientType: ['client'],
      },
    },
    default: '',
    description: 'Client identifier for cloud messaging',
  },
  {
    displayName: 'Phone Number',
    name: 'ani',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['messaging'],
        operation: ['send_cloud_message'],
        recipientType: ['phone'],
      },
    },
    default: '',
    description: 'Phone number for cloud messaging',
  },
];

// ==================== PRESENCE OPERATIONS ====================
export const presenceOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['presence'] },
    },
    options: [
      {
        name: '🟢 List Free Users',
        value: 'IsFreeUsers',
        description: 'Get list of available (free) users',
        action: 'List free users',
      },
      {
        name: '📞 List Active Calls',
        value: 'IsCalling',
        description: 'Get list of currently active calls',
        action: 'List active calls',
      },
      {
        name: '🔄 Initialize Status Tracking',
        value: 'initStatuses',
        description: 'Initialize user status tracking',
        action: 'Initialize status tracking',
      },
    ],
    default: 'IsFreeUsers',
  },
];

export const presenceFields: INodeProperties[] = [
  {
    displayName: 'Phone Numbers to Check',
    name: 'phones',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['presence'],
        operation: ['IsFreeUsers', 'IsCalling'],
      },
    },
    default: '',
    placeholder: '101,102,103',
    description: 'Comma-separated list of internal numbers or SIP numbers to check status for',
    hint: 'Use internal extensions (101, 102) or SIP numbers',
  },
];

// ==================== SIP OPERATIONS ====================
export const sipOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['sip'] },
    },
    options: [
      {
        name: '📱 Get User SIP Numbers',
        value: 'getUserSips',
        description: 'Get available SIP numbers for user',
        action: 'Get user SIP numbers',
      },
      {
        name: '🔄 Get SIP Route In',
        value: 'get_sip_route_in',
        description: 'Get SIP routing configuration',
        action: 'Get SIP route in',
      },
      {
        name: '⚙️ Set SIP Route In',
        value: 'set_sip_route_in',
        description: 'Configure SIP routing priority',
        action: 'Set SIP route in',
      },
    ],
    default: 'getUserSips',
  },
];

export const sipFields: INodeProperties[] = [
  {
    displayName: 'User Phone Number',
    name: 'phone',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['sip'],
      },
    },
    default: '',
    description: 'Internal user phone number',
  },
  {
    displayName: 'SIP Number',
    name: 'sip_number',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['sip'],
        operation: ['set_sip_route_in'],
      },
    },
    default: '',
    description: 'SIP number to configure routing for',
  },
  {
    displayName: 'Priority',
    name: 'priority',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['sip'],
        operation: ['set_sip_route_in'],
      },
    },
    default: 1,
    description: 'Routing priority (lower number = higher priority)',
    typeOptions: {
      minValue: 1,
      maxValue: 100,
    },
  },
  {
    displayName: 'Time Plan ID',
    name: 'time_plan',
    type: 'number',
    required: true,
    displayOptions: {
      show: {
        resource: ['sip'],
        operation: ['set_sip_route_in'],
      },
    },
    default: 0,
    description: 'ID of the weekly time plan for routing',
  },
  {
    displayName: 'Web Phones Only',
    name: 'web',
    type: 'boolean',
    displayOptions: {
      show: {
        resource: ['sip'],
        operation: ['getUserSips'],
      },
    },
    default: false,
    description: 'Whether to return only web phones',
  },
];

// ==================== BLACKLIST OPERATIONS ====================
export const blacklistOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['blacklist'] },
    },
    options: [
      {
        name: '➕ Add Phone to Blacklist',
        value: 'addBlackPhone',
        description: 'Block specific phone number',
        action: 'Add phone to blacklist',
      },
      {
        name: '➖ Remove Phone from Blacklist',
        value: 'delBlackPhone',
        description: 'Unblock phone number',
        action: 'Remove phone from blacklist',
      },
      {
        name: '📋 List Blacklisted Phones',
        value: 'listBlackPhone',
        description: 'Get all blocked phone numbers',
        action: 'List blacklisted phones',
      },
      {
        name: '🌐 Add IP to Blacklist',
        value: 'addBlackIP',
        description: 'Block specific IP address',
        action: 'Add IP to blacklist',
      },
      {
        name: '🔄 Remove IP from Blacklist',
        value: 'delBlackIP',
        description: 'Unblock IP address',
        action: 'Remove IP from blacklist',
      },
      {
        name: '📜 List Blacklisted IPs',
        value: 'listBlackIP',
        description: 'Get all blocked IP addresses',
        action: 'List blacklisted IPs',
      },
    ],
    default: 'addBlackPhone',
  },
];

export const blacklistFields: INodeProperties[] = [
  {
    displayName: 'Phone Number',
    name: 'phone',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['blacklist'],
        operation: ['addBlackPhone', 'delBlackPhone'],
      },
    },
    default: '',
    description: 'Phone number to block or unblock',
  },
  {
    displayName: 'IP Address',
    name: 'IP',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['blacklist'],
        operation: ['addBlackIP', 'delBlackIP'],
      },
    },
    default: '',
    placeholder: '192.168.1.1',
    description: 'IP address to block or unblock',
  },
];

// ==================== CAMPAIGNS OPERATIONS ====================
export const campaignsOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['campaigns'] },
    },
    options: [
      {
        name: '🎯 Add Campaign',
        value: 'AddCampaign',
        description: 'Create new calling or SMS campaign',
        action: 'Add campaign',
      },
      {
        name: '📞 Add Phones to Campaign',
        value: 'AddPhoneCampaign',
        description: 'Add phone numbers to existing campaign',
        action: 'Add phones to campaign',
      },
    ],
    default: 'AddCampaign',
  },
];

export const campaignsFields: INodeProperties[] = [
  {
    displayName: 'Campaign Initiator',
    name: 'from',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['campaigns'],
      },
    },
    default: '',
    description: 'User who initiates the campaign',
  },
  {
    displayName: 'Phone Numbers',
    name: 'phones',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['campaigns'],
      },
    },
    default: '',
    description: 'Comma-separated list of phone numbers',
    placeholder: '380501234567,380501234568,380501234569',
  },
  {
    displayName: 'Campaign Type',
    name: 'type',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['campaigns'],
        operation: ['AddCampaign'],
      },
    },
    options: [
      { name: 'Phone Calls', value: 1 },
      { name: 'SMS Messages', value: 2 },
    ],
    default: 1,
    description: 'Type of campaign to create',
  },
  {
    displayName: 'SMS Message',
    name: 'message',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['campaigns'],
        operation: ['AddCampaign'],
        type: [2],
      },
    },
    default: '',
    description: 'SMS message text (required for SMS campaigns)',
    typeOptions: {
      rows: 3,
    },
  },
  {
    displayName: 'Employee Extension',
    name: 'ext',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['campaigns'],
        operation: ['AddCampaign'],
      },
    },
    default: '',
    description: 'Extension for receiving campaign calls (defaults to initiator)',
  },
  {
    displayName: 'Days of Week',
    name: 'days',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['campaigns'],
        operation: ['AddCampaign'],
      },
    },
    default: '1,2,3,4,5',
    description: 'Comma-separated days (0=Sunday, 6=Saturday)',
    placeholder: '1,2,3,4,5',
  },
  {
    displayName: 'Time Range',
    name: 'time',
    type: 'string',
    displayOptions: {
      show: {
        resource: ['campaigns'],
        operation: ['AddCampaign'],
      },
    },
    default: '10:00-18:00',
    description: 'Time window for campaign activities',
    placeholder: '09:00-17:00',
  },
  {
    displayName: 'Retry Attempts',
    name: 'try',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['campaigns'],
        operation: ['AddCampaign'],
      },
    },
    default: 1,
    description: 'Number of retry attempts for each number',
    typeOptions: {
      minValue: 1,
      maxValue: 10,
    },
  },
  {
    displayName: 'PDD (Post Dial Delay)',
    name: 'pdd',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['campaigns'],
        operation: ['AddCampaign'],
      },
    },
    default: 0,
    description: 'Post dial delay in seconds',
  },
  {
    displayName: 'Preview Timeout',
    name: 'preview_timeout',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['campaigns'],
        operation: ['AddCampaign'],
      },
    },
    default: 0,
    description: 'Preview mode timeout in seconds',
  },
];

// ==================== UTILITY OPERATIONS ====================
export const utilityOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['utility'] },
    },
    options: [
      {
        name: '🔒 Encode Phone',
        value: 'EncodePhone',
        description: 'Encrypt phone number for secure transmission',
        action: 'Encode phone',
      },
      {
        name: '🔓 Decode Phone',
        value: 'DecodePhone',
        description: 'Decrypt previously encoded phone number',
        action: 'Decode phone',
      },
    ],
    default: 'EncodePhone',
  },
];

export const utilityFields: INodeProperties[] = [
  {
    displayName: 'Phone Number',
    name: 'phone',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['utility'],
      },
    },
    default: '',
    placeholder: '380501234567',
    description: 'Phone number to encode or decode',
  },
];

// ==================== ADVANCED SETTINGS ====================
export const advancedSettings: INodeProperties[] = [
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
    displayName: '⚡ Performance Settings',
    name: 'performanceSettings',
    type: 'collection',
    placeholder: 'Add Performance Setting',
    default: {},
    options: [
      // НОВЫЕ ПОЛЯ ДЛЯ КЭША
      {
        displayName: 'Cache Provider',
        name: 'cacheProvider',
        type: 'options',
        default: 'memory',
        options: [
          { name: 'In-Memory', value: 'memory' },
          { name: 'Redis', value: 'redis' },
          { name: 'File System', value: 'file' },
        ],
        description: 'Where to store cache data. In-Memory is fastest but ephemeral; Redis/File persist across restarts.',
      },
      {
        displayName: 'Redis URL',
        name: 'redisUrl',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            '/performanceSettings/cacheProvider': ['redis']
          }
        },
        description: 'redis://user:pass@host:port/db or rediss:// for TLS',
      },
      {
        displayName: 'Redis TLS',
        name: 'redisTls',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: {
            '/performanceSettings/cacheProvider': ['redis']
          }
        },
      },
      {
        displayName: 'File Cache Directory',
        name: 'fileCachePath',
        type: 'string',
        default: '/tmp/n8n-lirax-cache',
        displayOptions: {
          show: {
            '/performanceSettings/cacheProvider': ['file']
          }
        },
      },
      {
        displayName: 'Cache Key Prefix',
        name: 'cacheKeyPrefix',
        type: 'string',
        default: 'lirax',
        description: 'Prefix for cache keys to isolate multiple instances sharing Redis or filesystem',
      },
      // СУЩЕСТВУЮЩИЕ ПОЛЯ
      {
        displayName: 'Enable Circuit Breaker',
        name: 'enableCircuitBreaker',
        type: 'boolean',
        default: true,
        description: 'Temporarily block requests when API is failing to prevent cascade failures',
      },
      {
        displayName: 'Use Cache for Lookups',
        name: 'useCache',
        type: 'boolean',
        default: true,
        description: 'Cache frequently accessed data like users and shops lists',
      },
      {
        displayName: 'Cache TTL (seconds)',
        name: 'cacheTTL',
        type: 'number',
        default: 3600,
        description: 'How long to cache data (default: 1 hour)',
        displayOptions: {
          show: {
            useCache: [true],
          },
        },
        typeOptions: {
          minValue: 60,
          maxValue: 86400,
        },
      },
      {
        displayName: 'Timeout Override (ms)',
        name: 'timeoutOverride',
        type: 'number',
        default: 0,
        description: 'Override default timeout. 0 = use credentials setting',
        typeOptions: {
          minValue: 0,
          maxValue: 120000,
        },
      },
      {
        displayName: 'Disable Auto Retry',
        name: 'disableRetry',
        type: 'boolean',
        default: false,
        description: 'Whether to disable automatic retry on failure',
      },
      {
        displayName: 'Bypass Cache',
        name: 'bypassCache',
        type: 'boolean',
        default: false,
        description: 'Whether to skip cache and force fresh API call',
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
];