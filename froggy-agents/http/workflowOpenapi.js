function buildWorkflowOpenApiSpec(serverUrl) {
  const serverList = serverUrl ? [{ url: serverUrl }] : [{ url: '/' }];

  return {
    openapi: '3.0.3',
    info: {
      title: 'Froggy Planner Broker Workflow API',
      version: '0.1.0',
      description:
        'HTTP wrapper around Registry Broker UAID workflow calls for FroggyChat, FroggyPlanner, FroggyFoundry, and FroggyGuardian.',
    },
    servers: serverList,
    tags: [{ name: 'Broker Workflow' }],
    paths: {
      '/api/hol/workflow/resolve/{agentKey}': {
        get: {
          tags: ['Broker Workflow'],
          summary: 'Resolve a broker-registered agent by configured UAID',
          parameters: [
            {
              in: 'path',
              name: 'agentKey',
              required: true,
              schema: {
                type: 'string',
                enum: ['froggychat', 'planner', 'foundry', 'guardian'],
              },
            },
          ],
          responses: {
            200: {
              description: 'Resolved agent metadata',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/hol/workflow/{agentKey}': {
        post: {
          tags: ['Broker Workflow'],
          summary: 'Send one plaintext Registry Broker message to a configured UAID',
          parameters: [
            {
              in: 'path',
              name: 'agentKey',
              required: true,
              schema: {
                type: 'string',
                enum: ['froggychat', 'planner', 'foundry', 'guardian'],
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkflowAgentRequest',
                },
                examples: {
                  froggychat: {
                    value: {
                      message: 'which stations require my attention?',
                      encryptionPreference: 'disabled',
                    },
                  },
                  planner: {
                    value: {
                      message: 'find a station near Madison Square Garden',
                      encryptionPreference: 'disabled',
                    },
                  },
                  foundry: {
                    value: {
                      message: 'which stations require my attention?',
                      encryptionPreference: 'disabled',
                    },
                  },
                  guardian: {
                    value: {
                      message:
                        'show me the guardian policy for Madison Square Garden',
                      encryptionPreference: 'disabled',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Broker workflow response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/hol/workflow/run': {
        post: {
          tags: ['Broker Workflow'],
          summary:
            'Run one or more broker workflow steps sequentially using the configured UAIDs',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkflowRunRequest',
                },
                examples: {
                  chatOnly: {
                    value: {
                      froggychat: 'which stations require my attention?',
                      encryptionPreference: 'disabled',
                    },
                  },
                  plannerOnly: {
                    value: {
                      planner: 'find a station near Madison Square Garden',
                      encryptionPreference: 'disabled',
                    },
                  },
                  chained: {
                    value: {
                      planner: 'find a station near Madison Square Garden',
                      foundry: 'which stations require my attention?',
                      guardian:
                        'show me the guardian policy for Madison Square Garden',
                      encryptionPreference: 'disabled',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Sequential broker workflow responses',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },
      },
    },
    components: {
      responses: {
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        InternalError: {
          description: 'Server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
      schemas: {
        WorkflowAgentRequest: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'find a station near Madison Square Garden',
            },
            senderUaid: {
              type: 'string',
              example:
                'uaid:aid:3UDbHLsm8bjjEHuZ2Zar1cNn2zbMNJaCPhYfPzT8LSgqGL1d1zFZRiqMQCcPimcj89',
            },
            historyTtlSeconds: {
              type: 'integer',
              example: 3600,
            },
            encryptionPreference: {
              type: 'string',
              enum: ['disabled', 'preferred', 'required'],
              default: 'disabled',
            },
            streaming: {
              type: 'boolean',
              example: false,
            },
            auth: {
              type: 'object',
              additionalProperties: true,
              description:
                'Optional broker auth object forwarded as-is to Registry Broker chat methods.',
            },
          },
          required: ['message'],
          additionalProperties: false,
        },
        WorkflowRunRequest: {
          type: 'object',
          properties: {
            froggychat: {
              type: 'string',
              example: 'which stations require my attention?',
            },
            chat: {
              type: 'string',
              example: 'which stations require my attention?',
            },
            chatMessage: {
              type: 'string',
              example: 'which stations require my attention?',
            },
            planner: {
              type: 'string',
              example: 'find a station near Madison Square Garden',
            },
            plannerMessage: {
              type: 'string',
              example: 'find a station near Madison Square Garden',
            },
            foundry: {
              type: 'string',
              example: 'which stations require my attention?',
            },
            foundryMessage: {
              type: 'string',
              example: 'which stations require my attention?',
            },
            guardian: {
              type: 'string',
              example: 'show me the guardian policy for Madison Square Garden',
            },
            guardianMessage: {
              type: 'string',
              example: 'show me the guardian policy for Madison Square Garden',
            },
            senderUaid: {
              type: 'string',
            },
            historyTtlSeconds: {
              type: 'integer',
              example: 3600,
            },
            encryptionPreference: {
              type: 'string',
              enum: ['disabled', 'preferred', 'required'],
              default: 'disabled',
            },
            streaming: {
              type: 'boolean',
              example: false,
            },
            auth: {
              type: 'object',
              additionalProperties: true,
            },
          },
          additionalProperties: false,
          description:
            'Provide at least one of froggychat/chat/chatMessage, planner/plannerMessage, foundry/foundryMessage, or guardian/guardianMessage.',
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            data: { type: 'object', additionalProperties: true },
          },
          required: ['ok', 'data'],
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
          required: ['ok', 'error'],
        },
      },
    },
  };
}

module.exports = {
  buildWorkflowOpenApiSpec,
};