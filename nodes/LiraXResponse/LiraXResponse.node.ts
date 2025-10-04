import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class LiraXResponse implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'LiraX Response',
    name: 'liraXResponse',
    icon: 'file:lirax.svg',
    group: ['transform'],
    version: 1,
    description: 'Send response back to LiraX for interactive webhooks like Contact Lookup',
    defaults: {
      name: 'LiraX Response',
    },
    inputs: ['main'],
    outputs: [],
    properties: [
      {
        displayName: 'Contact Name',
        name: 'contact_name',
        type: 'string',
        default: '',
        description: 'The name of the contact to display on the agent\'s phone',
      },
      {
        displayName: 'Responsible Employee Extension',
        name: 'responsible',
        type: 'string',
        default: '',
        description: 'The internal extension number of the responsible employee',
      },
      {
        displayName: 'Additional Data',
        name: 'additionalData',
        type: 'json',
        default: '{}',
        description: 'Additional contact data in JSON format',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const contactName = this.getNodeParameter('contact_name', i) as string;
        const responsible = this.getNodeParameter('responsible', i) as string;
        const additionalDataJson = this.getNodeParameter('additionalData', i, '{}') as string;

        let additionalData = {};
        try {
          additionalData = JSON.parse(additionalDataJson);
        } catch (error) {
          throw new NodeOperationError(this.getNode(), 'Invalid JSON in additional data');
        }

        const responseData = {
          contact_name: contactName,
          responsible: responsible,
          ...additionalData,
        };

        const webhookResponse = {
          body: responseData,
          headers: {
            'Content-Type': 'application/json',
          },
        };

        if ((this as any).sendWebhookResponse) {
          (this as any).sendWebhookResponse(webhookResponse);
        } else {
          throw new NodeOperationError(this.getNode(), 'Webhook response method not available. This node should be used in webhook workflows.');
        }

        returnData.push({
          json: {
            success: true,
            responseSent: true,
            data: responseData,
            timestamp: new Date().toISOString(),
          },
          pairedItem: {
            item: i,
          },
        });

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              success: false,
              error: error.message,
              timestamp: new Date().toISOString(),
            },
            pairedItem: {
              item: i,
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}