function buildOpenApiSpec(serverUrl, options = {}) {
  const serverList = serverUrl ? [{ url: serverUrl }] : [{ url: '/' }];
  const envCandidates = [
    process.env.NODE_ENV,
    process.env.ENV,
    process.env.APP_ENV,
    process.env.ENVIRONMENT,
  ];
  let runtimeEnv = '';
  for (const candidate of envCandidates) {
    const normalized = String(candidate || '').trim().toLowerCase();
    if (!normalized) continue;
    if (normalized === 'dev') {
      runtimeEnv = 'development';
      break;
    }
    if (normalized === 'prod') {
      runtimeEnv = 'production';
      break;
    }
    runtimeEnv = normalized;
    break;
  }
  const explicitTestingRoutes = process.env.ENABLE_TEST_API_ROUTES;
  const includeTestingRoutes =
    typeof options.includeTestingRoutes === 'boolean'
      ? options.includeTestingRoutes
      : explicitTestingRoutes !== undefined
        ? String(explicitTestingRoutes).trim().toLowerCase() === 'true'
        : runtimeEnv !== 'production';
  const tags = [{ name: 'Agent' }, { name: 'A2A' }];
  if (includeTestingRoutes) {
    tags.push(
      { name: 'Contracts' },
      { name: 'ATS' },
      { name: 'Discovery' },
      { name: 'MiniNodes' },
      { name: 'Stations' },
    );
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'FroggyPlanner API',
      version: '0.1.0',
      description:
        'Testing-only HTTP harness for internal agent systems. Public coordinator agents delegate to internal worker agents over internal A2A.',
    },
    servers: serverList,
    tags,
    paths: {
      '/api/contracts/deploy-station-bundle': {
        post: {
          tags: ['Contracts'],
          summary:
            'Deploy one Station + Shares bundle and wire Registry/Bolt in a single flow',
          description:
            'Uses the app-side admin signer and checked-in contract artifacts. The signer must own both Registry and Bolt.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DeployStationBundleRequest',
                },
                examples: {
                  default: {
                    value: {
                      stationName: 'ChargeFrog Station - Test Endpoint',
                      projectUrl:
                        'https://chargefrog.vercel.app/stations/test-endpoint',
                      totalInvestmentHbar: '10',
                      totalShares: '1000',
                      stationMetadata: 'meta-test-endpoint',
                      registryAddress:
                        '0xE690102867901aaF25F960E95E65421e1cC78b07',
                      boltAddress:
                        '0x173E5D299fFECaE7856504164a157506859F486f',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Station bundle deployed and wired successfully',
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
      '/api/createEquity': {
        post: {
          tags: ['ATS'],
          summary: 'Create equity token (same ATS flow as chargefrog-web)',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateTokenRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Token created',
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
      '/api/createBond': {
        post: {
          tags: ['ATS'],
          summary: 'Create digital security bond token via ATS SDK',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateBondRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Bond token created',
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
      '/api/discovery/poi': {
        get: {
          tags: ['Discovery'],
          summary:
            'GET alias: resolve area/lat-lon to nearby POIs (q/query + optional radius/limit)',
          parameters: [
            { in: 'query', name: 'area', schema: { type: 'string' } },
            { in: 'query', name: 'q', schema: { type: 'string' } },
            { in: 'query', name: 'query', schema: { type: 'string' } },
            { in: 'query', name: 'lat', schema: { type: 'number' } },
            { in: 'query', name: 'lon', schema: { type: 'number' } },
            { in: 'query', name: 'radius', schema: { type: 'integer' } },
            { in: 'query', name: 'limit', schema: { type: 'integer' } },
          ],
          responses: {
            200: {
              description: 'POI results',
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
        post: {
          tags: ['Discovery'],
          summary:
            'Step 1: Find POIs from area/lat-lon, then use returned chargingAvailabilityId in step 2',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DiscoveryAreaRequest' },
                examples: {
                  cityBiasSearch: {
                    summary: 'City search (recommended first call)',
                    value: {
                      area: 'Nottingham',
                      query: 'ev charging station',
                      limit: 20,
                    },
                  },
                  radiusSearch: {
                    summary: 'Hard radius filter search',
                    value: {
                      area: 'Nottingham',
                      radius: 10000,
                      query: 'ev charging station',
                      limit: 20,
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'POI results',
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
      '/api/discovery/charging-stations': {
        post: {
          tags: ['Discovery'],
          summary:
            'Step 2: Get EV charging availability using chargingAvailabilityId(s) from /api/discovery/poi',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DiscoveryChargingAvailabilityRequest',
                },
                examples: {
                  singleId: {
                    summary: 'Single chargingAvailabilityId',
                    value: {
                      chargingAvailabilityId: 'XXX*YYY*ZZZ',
                    },
                  },
                  batchIds: {
                    summary: 'Batch chargingAvailabilityIds',
                    value: {
                      chargingAvailabilityIds: ['XXX*YYY*ZZZ', 'AAA*BBB*CCC'],
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Charging station results',
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
      '/api/ev/chargingAvailability': {
        get: {
          tags: ['Discovery'],
          summary:
            'GET alias: charging availability lookup by chargingAvailabilityId or comma-separated chargingAvailabilityIds',
          parameters: [
            {
              in: 'query',
              name: 'chargingAvailabilityId',
              schema: { type: 'string' },
            },
            { in: 'query', name: 'id', schema: { type: 'string' } },
            {
              in: 'query',
              name: 'chargingAvailabilityIds',
              schema: { type: 'string' },
              description: 'Comma-separated ids',
            },
            {
              in: 'query',
              name: 'ids',
              schema: { type: 'string' },
              description: 'Comma-separated ids',
            },
          ],
          responses: {
            200: {
              description: 'Charging station results',
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
      '/api/mini-nodes': {
        post: {
          tags: ['MiniNodes'],
          summary:
            'Create a mini-node document (geo + walletAddress + timestamp)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MiniNodeCreateRequest' },
                examples: {
                  basic: {
                    value: {
                      lat: 1.299264,
                      lon: 103.788009,
                      walletAddress: '0.0.xxxxxxxx',
                      timestamp: '2026-02-26T08:00:00.000Z',
                    },
                  },
                  hedera: {
                    value: {
                      lat: 1.299264,
                      lon: 103.788009,
                      walletAddress: '0.0.xxxxxxxx',
                      timestamp: '2026-02-26T08:00:00.000Z',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Mini-node saved',
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
      '/api/mini-nodes/neighborhood': {
        get: {
          tags: ['MiniNodes'],
          summary:
            'GET alias: count mini-nodes around lat/lon using radiusMiles (default 25) or radiusMeters',
          parameters: [
            {
              in: 'query',
              name: 'lat',
              required: true,
              schema: { type: 'number' },
            },
            {
              in: 'query',
              name: 'lon',
              required: true,
              schema: { type: 'number' },
            },
            { in: 'query', name: 'radiusMiles', schema: { type: 'number' } },
            { in: 'query', name: 'radiusMeters', schema: { type: 'integer' } },
            { in: 'query', name: 'threshold', schema: { type: 'integer' } },
            {
              in: 'query',
              name: 'triggerThreshold',
              schema: { type: 'integer' },
            },
            {
              in: 'query',
              name: 'lookbackMinutes',
              schema: { type: 'number' },
            },
            { in: 'query', name: 'since', schema: { type: 'string' } },
            { in: 'query', name: 'until', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Neighborhood count result',
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
        post: {
          tags: ['MiniNodes'],
          summary:
            'Count mini-nodes around a requested lat/lon neighborhood and return centroid POI candidate',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MiniNodeNeighborhoodRequest',
                },
                examples: {
                  targeted: {
                    value: {
                      lat: 1.299264,
                      lon: 103.788009,
                      radiusMeters: 1200,
                      triggerThreshold: 20,
                    },
                  },
                  withLookback: {
                    value: {
                      lat: 1.299264,
                      lon: 103.788009,
                      radiusMeters: 1200,
                      lookbackMinutes: 1440,
                      triggerThreshold: 20,
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Neighborhood count result',
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
      '/api/stations/available': {
        get: {
          tags: ['Stations'],
          summary: 'List stations currently in investment stage',
          responses: {
            200: {
              description: 'Investable stations list',
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
      '/api/stations/{stationId}': {
        get: {
          tags: ['Stations'],
          summary: 'Get station details by stationId',
          parameters: [
            {
              in: 'path',
              name: 'stationId',
              required: true,
              schema: { type: 'integer', minimum: 1 },
            },
          ],
          responses: {
            200: {
              description: 'Station details',
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
      '/api/mint': {
        post: {
          tags: ['ATS'],
          summary: 'Mint tokens to a target account',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MintIssueRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Mint transaction submitted',
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
      '/api/issue': {
        post: {
          tags: ['ATS'],
          summary: 'Issue tokens to a target account',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MintIssueRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Issue transaction submitted',
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
      '/api/balance': {
        post: {
          tags: ['ATS'],
          summary: 'Get token balance for an account',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BalanceRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Current balance',
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
      '/api/agent/froggy-planner': {
        post: {
          tags: ['Agent'],
          summary:
            'Testing harness: run FroggyPlanner for station discovery, proposal creation, and investment workflows',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AgentChatRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Agent response',
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
      '/api/agent/froggy-foundry': {
        post: {
          tags: ['Agent'],
          summary:
            'Testing harness: run FroggyFoundry for pending-admin review, approval, station deployment, and token issuance',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FoundryAgentChatRequest',
                },
                examples: {
                  attentionQueue: {
                    value: {
                      message: 'which stations require my attention',
                    },
                  },
                  byProposalId: {
                    value: {
                      proposalId: 'proposal_1741856400000_abc123def4',
                    },
                  },
                  byMessage: {
                    value: {
                      message:
                        'deploy station and issue assets for proposal proposal_1741856400000_abc123def4',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Foundry response',
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
      '/.well-known/froggy-planner-agent.json': {
        get: {
          tags: ['A2A'],
          summary: 'FroggyPlanner A2A discovery document',
          responses: {
            200: {
              description: 'A2A agent discovery metadata',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/.well-known/froggy-planner-agent-card.json': {
        get: {
          tags: ['A2A'],
          summary: 'FroggyPlanner A2A agent card',
          responses: {
            200: {
              description: 'A2A agent card metadata',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/.well-known/froggy-foundry-agent.json': {
        get: {
          tags: ['A2A'],
          summary: 'FroggyFoundry A2A discovery document',
          responses: {
            200: {
              description: 'FroggyFoundry A2A discovery metadata',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/.well-known/froggy-foundry-agent-card.json': {
        get: {
          tags: ['A2A'],
          summary: 'FroggyFoundry A2A agent card',
          responses: {
            200: {
              description: 'FroggyFoundry A2A agent card metadata',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/a2a/froggy-planner': {
        post: {
          tags: ['A2A'],
          summary: 'A2A JSON-RPC endpoint',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
                examples: {
                  sendMessage: {
                    value: {
                      jsonrpc: '2.0',
                      id: '1',
                      method: 'message/send',
                      params: {
                        message: {
                          messageId: 'msg-1',
                          role: 'user',
                          parts: [
                            {
                              text: 'what stations are available right now?',
                            },
                          ],
                          metadata: {
                            walletAddress: '0.0.xxxxxxxx',
                          },
                        },
                      },
                    },
                  },
                  getTask: {
                    value: {
                      jsonrpc: '2.0',
                      id: '2',
                      method: 'tasks/get',
                      params: {
                        id: 'task-id-from-message-send',
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'A2A JSON-RPC response',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                  examples: {
                    completedTask: {
                      value: {
                        jsonrpc: '2.0',
                        id: '1',
                        result: {
                          id: 'task-id',
                          contextId: 'context-id',
                          kind: 'task',
                          status: {
                            state: 'completed',
                            message: {
                              kind: 'message',
                              messageId: 'agent-message-id',
                              contextId: 'context-id',
                              taskId: 'task-id',
                              role: 'agent',
                              parts: [
                                {
                                  kind: 'text',
                                  text: 'There are 1 investable station(s) right now: station 1: ChargeFrog Station - Madison Square Garden (investment, equity 1 HBAR, bond 1 HBAR).',
                                },
                              ],
                              metadata: {
                                a2a: true,
                                endpoint: '/a2a/froggy-planner',
                                intent: 'LIST_AVAILABLE_STATIONS',
                                status: 'listed',
                              },
                            },
                          },
                          artifacts: [
                            {
                              artifactId: 'artifact-id',
                              name: 'planner-result',
                              description:
                                'Structured result from ChargeFrog Planner',
                              parts: [
                                {
                                  kind: 'data',
                                  data: {
                                    intent: 'LIST_AVAILABLE_STATIONS',
                                    status: 'listed',
                                    reply:
                                      'There are 1 investable station(s) right now.',
                                    stations: [
                                      {
                                        stationId: 1,
                                        stationName:
                                          'ChargeFrog Station - Madison Square Garden',
                                        stage: 'investment',
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          ],
                          metadata: {
                            source: 'chargefrog-planner',
                            intent: 'LIST_AVAILABLE_STATIONS',
                            status: 'listed',
                            degraded: false,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/a2a/froggy-foundry': {
        post: {
          tags: ['A2A'],
          summary: 'FroggyFoundry A2A JSON-RPC endpoint',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
                examples: {
                  sendMessage: {
                    value: {
                      jsonrpc: '2.0',
                      id: '1',
                      method: 'message/send',
                      params: {
                        message: {
                          messageId: 'foundry-msg-1',
                          role: 'user',
                          parts: [
                            {
                              text: 'which stations require my attention?',
                            },
                          ],
                        },
                      },
                    },
                  },
                  approveProposal: {
                    value: {
                      jsonrpc: '2.0',
                      id: '2',
                      method: 'message/send',
                      params: {
                        message: {
                          messageId: 'foundry-msg-2',
                          role: 'user',
                          parts: [
                            {
                              text: 'approve proposal proposal_1741856400000_abc123def4',
                            },
                          ],
                        },
                      },
                    },
                  },
                  getTask: {
                    value: {
                      jsonrpc: '2.0',
                      id: '3',
                      method: 'tasks/get',
                      params: {
                        id: 'task-id-from-message-send',
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'FroggyFoundry A2A JSON-RPC response',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                  examples: {
                    completedTask: {
                      value: {
                        jsonrpc: '2.0',
                        id: '1',
                        result: {
                          id: 'foundry-task-id',
                          contextId: 'foundry-context-id',
                          kind: 'task',
                          status: {
                            state: 'completed',
                            message: {
                              kind: 'message',
                              messageId: 'foundry-agent-message-id',
                              contextId: 'foundry-context-id',
                              taskId: 'foundry-task-id',
                              role: 'agent',
                              parts: [
                                {
                                  kind: 'text',
                                  text: 'The station requiring your attention is station 8 (ChargeFrog Station - Madison Square Garden) proposal proposal_1741856400000_abc123def4; would you like to approve this station, this would mean deployment on hedera testnet through the chargefrog contracts, and the creation of equity and bond stations',
                                },
                              ],
                              metadata: {
                                a2a: true,
                                endpoint: '/a2a/froggy-foundry',
                                status: 'pending_admin_action_queue',
                              },
                            },
                          },
                          artifacts: [
                            {
                              artifactId: 'foundry-artifact-id',
                              name: 'foundry-result',
                              description:
                                'Structured result from ChargeFrog Foundry',
                              parts: [
                                {
                                  kind: 'data',
                                  data: {
                                    status: 'pending_admin_action_queue',
                                    reply:
                                      'The station requiring your attention is station 8 (ChargeFrog Station - Madison Square Garden) proposal proposal_1741856400000_abc123def4; would you like to approve this station, this would mean deployment on hedera testnet through the chargefrog contracts, and the creation of equity and bond stations',
                                    stations: [
                                      {
                                        stationId: 8,
                                        stationName:
                                          'ChargeFrog Station - Madison Square Garden',
                                        stage: 'pending-admin-action',
                                        proposalId:
                                          'proposal_1741856400000_abc123def4',
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          ],
                          metadata: {
                            source: 'chargefrog-froggyfoundry',
                            status: 'pending_admin_action_queue',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
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
        DiscoveryAreaRequest: {
          type: 'object',
          properties: {
            area: {
              type: 'string',
              example: 'Barclays Center, New York',
              description:
                'Area/place text to resolve. Landmark queries are resolved via TomTom Search first, then geocode fallback. Optional if lat/lon are provided.',
            },
            lat: { type: 'number', example: 52.9548 },
            lon: { type: 'number', example: -1.1581 },
            radius: {
              type: 'integer',
              example: 10000,
              description:
                'Optional hard filter in meters. If omitted, TomTom does bias-only search around the area center. 500 means 500 meters only.',
            },
            limit: {
              type: 'integer',
              example: 10,
              description: 'Max results (1..100).',
            },
            query: {
              type: 'string',
              example: 'ev charging station',
              description:
                'POI query. Defaults to "ev charging station" if omitted.',
            },
            openingHours: {
              type: 'string',
              example: 'nextSevenDays',
              description:
                'Optional opening-hours mode. Defaults to nextSevenDays.',
            },
            connectorSet: {
              type: 'string',
              example: 'IEC62196Type2CableAttached',
            },
            minPowerKW: { type: 'number', example: 50 },
            maxPowerKW: { type: 'number', example: 350 },
            categorySet: {
              type: 'string',
              example: '7315',
            },
            language: {
              type: 'string',
              example: 'en-US',
            },
          },
          additionalProperties: true,
        },
        DiscoveryChargingAvailabilityRequest: {
          type: 'object',
          properties: {
            chargingAvailabilityId: {
              type: 'string',
              example: 'XXX*YYY*ZZZ',
              description:
                'Single charging availability ID from /api/discovery/poi response: pointsOfInterest[].chargingAvailabilityId',
            },
            chargingAvailabilityIds: {
              type: 'array',
              items: { type: 'string' },
              example: ['XXX*YYY*ZZZ', 'AAA*BBB*CCC'],
              description:
                'Batch charging availability IDs from /api/discovery/poi.',
            },
            connectorSet: {
              type: 'string',
              example: 'IEC62196Type2CableAttached',
            },
            minPowerKW: { type: 'number', example: 50 },
            maxPowerKW: { type: 'number', example: 350 },
          },
          additionalProperties: true,
        },
        MiniNodeCreateRequest: {
          type: 'object',
          properties: {
            lat: { type: 'number', example: 1.299264 },
            lon: { type: 'number', example: 103.788009 },
            walletAddress: {
              type: 'string',
              example: '0.0.xxxxxxxx',
              description: 'Hedera account ID (0.0.x).',
            },
            timestamp: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
              example: '2026-02-26T08:00:00.000Z',
              description:
                'Optional. ISO date string or unix timestamp (seconds or milliseconds). Defaults to now.',
            },
          },
          required: ['lat', 'lon', 'walletAddress'],
          additionalProperties: true,
        },
        MiniNodeNeighborhoodRequest: {
          type: 'object',
          properties: {
            lat: { type: 'number', example: 1.299264 },
            lon: { type: 'number', example: 103.788009 },
            radiusMeters: {
              type: 'integer',
              example: 1200,
              description:
                'Neighborhood radius in meters around the requested lat/lon.',
            },
            triggerThreshold: {
              type: 'integer',
              example: 20,
              description:
                'If count >= triggerThreshold, shouldTriggerProposal=true.',
            },
            lookbackMinutes: {
              type: 'number',
              example: 1440,
              description:
                'Optional rolling window. If set, only docs from now-lookbackMinutes to now are counted.',
            },
            since: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
              example: '2026-02-25T00:00:00.000Z',
              description: 'Optional start time.',
            },
            until: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
              example: '2026-02-26T23:59:59.000Z',
              description: 'Optional end time.',
            },
            neighborLimit: {
              type: 'integer',
              example: 100,
              description:
                'Number of mini-node docs returned in response (max 1000).',
            },
          },
          required: ['lat', 'lon'],
          additionalProperties: true,
        },
        DeployStationBundleRequest: {
          type: 'object',
          properties: {
            stationName: {
              type: 'string',
              example: 'ChargeFrog Station - Test Endpoint',
            },
            projectUrl: {
              type: 'string',
              example: 'https://chargefrog.vercel.app/stations/test-endpoint',
            },
            totalInvestmentHbar: {
              type: 'string',
              example: '10',
              description:
                'Preferred input. Human-readable HBAR amount; converted internally to 18-decimal wei/weibar units.',
            },
            totalInvestment: {
              type: 'string',
              example: '10000000000000000000',
              description:
                'Raw 18-decimal integer amount. Use this instead of totalInvestmentHbar if you want exact units.',
            },
            totalShares: {
              type: 'string',
              example: '1000',
            },
            stationMetadata: {
              oneOf: [{ type: 'string' }, { type: 'object' }],
              example: 'meta-test-endpoint',
              description:
                'Plain text, hex string, or JSON object. Non-hex values are UTF-8 encoded into bytes.',
            },
            initialFundAddress: {
              type: 'string',
              example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
              description:
                'Optional temporary fund address used during createStation. Defaults to the admin signer address before the Station address is written back.',
            },
            registryAddress: {
              type: 'string',
              example: '0xE690102867901aaF25F960E95E65421e1cC78b07',
            },
            boltAddress: {
              type: 'string',
              example: '0x173E5D299fFECaE7856504164a157506859F486f',
            },
            rpcUrl: {
              type: 'string',
              example: 'https://testnet.hashio.io/api',
            },
          },
          required: ['stationName'],
          additionalProperties: true,
          description:
            'Provide stationName plus one of totalInvestmentHbar or totalInvestment.',
        },
        CreateTokenRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'ChargeFrog-Notts' },
            symbol: { type: 'string', example: 'CFNT' },
            isin: { type: 'string', example: 'MY760VPEW3I9' },
            isin_number: {
              type: 'string',
              example: 'MY760VPEW3I9',
              description:
                'Alias of isin. Agent tools use isin_number explicitly.',
            },
            decimals: { type: 'integer', example: 6 },
            currency: { type: 'string', example: 'USD' },
            currencyHex: {
              type: 'string',
              example: '0x555344',
              description:
                'Optional pre-encoded currency hex. If set, it is used as-is.',
            },
            numberOfShares: { type: 'string', example: '1000' },
            nominalValue: { type: 'string', example: '1' },
            adminAccountId: { type: 'string', example: '0.0.7106098' },
            diamondOwnerAccount: { type: 'string', example: '0.0.7106098' },
            info: { type: 'string' },
            isWhiteList: { type: 'boolean', example: false },
            isControllable: { type: 'boolean', example: true },
            arePartitionsProtected: { type: 'boolean', example: false },
            isMultiPartition: { type: 'boolean', example: false },
            clearingActive: { type: 'boolean', example: false },
            internalKycActivated: { type: 'boolean', example: false },
            externalPausesIds: {
              type: 'array',
              items: { type: 'string' },
              example: [],
            },
            externalControlListsIds: {
              type: 'array',
              items: { type: 'string' },
              example: [],
            },
            externalKycListsIds: {
              type: 'array',
              items: { type: 'string' },
              example: [],
            },
            votingRight: { type: 'boolean', example: false },
            informationRight: { type: 'boolean', example: true },
            liquidationRight: { type: 'boolean', example: false },
            subscriptionRight: { type: 'boolean', example: false },
            conversionRight: { type: 'boolean', example: false },
            redemptionRight: { type: 'boolean', example: false },
            putRight: { type: 'boolean', example: false },
            dividendRight: { type: 'number', example: 0 },
            regulationType: { type: 'integer', example: 1 },
            regulationSubType: { type: 'integer', example: 0 },
            isCountryControlListWhiteList: { type: 'boolean', example: false },
            countries: { type: 'string', example: '' },
            configId: {
              type: 'string',
              example:
                '0x0000000000000000000000000000000000000000000000000000000000000001',
            },
            configVersion: { type: 'integer', example: 0 },
            erc20VotesActivated: { type: 'boolean', example: false },
          },
        },
        CreateBondRequest: {
          type: 'object',
          required: [
            'name',
            'symbol',
            'isin',
            'numberOfUnits',
            'startingDate',
            'maturityDate',
          ],
          properties: {
            name: { type: 'string', example: 'ChargeFrog-Station-Bond' },
            symbol: { type: 'string', example: 'CFSB' },
            isin: { type: 'string', example: 'MY760VPEW3I9' },
            decimals: { type: 'integer', example: 6 },
            currency: { type: 'string', example: 'USD' },
            currencyHex: {
              type: 'string',
              example: '0x555344',
              description:
                'Optional pre-encoded currency hex. If set, it is used as-is.',
            },
            numberOfUnits: { type: 'string', example: '1000' },
            nominalValue: { type: 'string', example: '1' },
            startingDate: {
              type: 'integer',
              example: 1761978000,
              description: 'Unix timestamp in seconds (or milliseconds).',
            },
            maturityDate: {
              type: 'integer',
              example: 1793514000,
              description: 'Unix timestamp in seconds (or milliseconds).',
            },
            adminAccountId: { type: 'string', example: '0.0.7106098' },
            diamondOwnerAccount: { type: 'string', example: '0.0.7106098' },
            isWhiteList: { type: 'boolean', example: false },
            isControllable: { type: 'boolean', example: true },
            arePartitionsProtected: { type: 'boolean', example: false },
            isMultiPartition: { type: 'boolean', example: false },
            clearingActive: { type: 'boolean', example: false },
            internalKycActivated: { type: 'boolean', example: false },
            regulationType: { type: 'integer', example: 1 },
            regulationSubType: { type: 'integer', example: 0 },
            isCountryControlListWhiteList: { type: 'boolean', example: true },
            countries: { type: 'string', example: 'US' },
            configId: {
              type: 'string',
              example:
                '0x0000000000000000000000000000000000000000000000000000000000000002',
            },
            configVersion: { type: 'integer', example: 1 },
            erc20VotesActivated: { type: 'boolean', example: false },
            info: { type: 'string' },
          },
        },
        MintIssueRequest: {
          type: 'object',
          properties: {
            securityId: {
              type: 'string',
              example: '0.0.1234567',
              description:
                'Preferred security ID. If omitted, server can resolve from stationId/env.',
            },
            stationId: {
              type: 'integer',
              example: 1,
              description:
                'Optional station selector for VITE_STATION_{n}_SECURITY_CONTRACT_ID.',
            },
            targetId: { type: 'string', example: '0.0.7106098' },
            amount: { type: 'string', example: '10' },
          },
          required: ['amount'],
        },
        BalanceRequest: {
          type: 'object',
          properties: {
            securityId: { type: 'string', example: '0.0.1234567' },
            stationId: { type: 'integer', example: 1 },
            targetId: { type: 'string', example: '0.0.7106098' },
          },
        },
        AgentChatRequest: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'I want to find a station to invest in',
            },
            walletAddress: {
              type: 'string',
              example: '0.0.xxxxxxxx',
              description:
                'Optional in request. Required only when registering mini-node interest or minting investments. Must be a Hedera account ID (0.0.x).',
            },
          },
          required: ['message'],
          additionalProperties: false,
        },
        FoundryAgentChatRequest: {
          type: 'object',
          description:
            'FroggyFoundry always uses the configured admin signer. walletAddress is not accepted.',
          properties: {
            message: {
              type: 'string',
              example:
                'deploy station and issue assets for proposal proposal_1741856400000_abc123def4',
            },
            proposalId: {
              type: 'string',
              example: 'proposal_1741856400000_abc123def4',
              description:
                'Preferred direct trigger. FroggyFoundry derives station deployment inputs from this proposal, deploys the station, then calls the station asset issuer.',
            },
            projectUrl: {
              type: 'string',
              example: 'https://chargefrog.vercel.app/stations/12',
            },
            stationMetadata: {
              oneOf: [{ type: 'string' }, { type: 'object' }],
              example: {
                proposalId: 'proposal_1741856400000_abc123def4',
                source: 'froggy-foundry',
              },
            },
            totalInvestmentHbar: {
              type: 'string',
              example: '2500000',
              description:
                'Optional override. If omitted, FroggyFoundry uses proposal tokenizationInvestmentTerms.investmentTargetHbarEquivalent.',
            },
            totalInvestment: {
              type: 'string',
              example: '2500000000000000000000000',
              description:
                'Optional raw 18-decimal value override passed directly to deployStationBundle.',
            },
            totalShares: {
              type: 'string',
              example: '1000',
              description:
                'Optional override. If omitted, FroggyFoundry uses proposal tokenizationInvestmentTerms.totalSupply.equityShares.',
            },
            stationName: {
              type: 'string',
              example: 'ChargeFrog Station - Madison Square Garden',
            },
            initialFundAddress: {
              type: 'string',
              example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            },
            registryAddress: {
              type: 'string',
              example: '0xE690102867901aaF25F960E95E65421e1cC78b07',
            },
            boltAddress: {
              type: 'string',
              example: '0x173E5D299fFECaE7856504164a157506859F486f',
            },
            rpcUrl: {
              type: 'string',
              example: 'https://testnet.hashio.io/api',
            },
            expectedStationId: {
              type: 'string',
              example: '12',
              description:
                'Optional safety override. Defaults to the proposal stationId and must match Registry.nextId before deployment.',
            },
            stationId: {
              type: 'string',
              example: '12',
              description:
                'Alias of expectedStationId.',
            },
          },
          anyOf: [{ required: ['message'] }, { required: ['proposalId'] }],
          additionalProperties: false,
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

  return spec;
}

function getDocsHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Froggy Planner API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; background: #f7f9fc; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
      });
    </script>
  </body>
</html>`;
}

module.exports = {
  buildOpenApiSpec,
  getDocsHtml,
};
