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
    const normalized = String(candidate || '')
      .trim()
      .toLowerCase();
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
      { name: 'Guardian Operations' },
      { name: 'Guardian Policies' },
      { name: 'Guardian Schema' },
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
                      boltAddress: '0x173E5D299fFECaE7856504164a157506859F486f',
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
      '/api/guardian/createPolicy': {
        post: {
          tags: ['Guardian Policies'],
          summary: 'Create Guardian policy via URL + /policies/push',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GuardianCreatePolicyRequest',
                },
                examples: {
                  default: {
                    value: {
                      name: 'test',
                      applicabilityConditions: 'test',
                      detailsUrl: 'test',
                      policyTag: 'Tag_17725515820794',
                      typicalProjects: '',
                      topicDescription: '',
                      description: '',
                      categories: [
                        '6917d97da17a3035b283a89e',
                        '6917d97da17a3035b283a887',
                        '6917d97da17a3035b283a889',
                        '6917d97da17a3035b283a896',
                        '6917d97da17a3035b283a89a',
                      ],
                      importantParameters: {
                        atValidation: '',
                        monitored: '',
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Policy pushed successfully',
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
      '/api/guardian/agent/create-station-policies': {
        post: {
          tags: ['Guardian Operations'],
          summary:
            'Run Guardian station-policy flow agent: clone Carbon/Wipe templates, copy schema by topic, reattach schema URIs, then publish',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GuardianPolicyFlowAgentRequest',
                },
                examples: {
                  defaultRun: {
                    value: {
                      stationName: 'Madison Square Garden',
                      carbonTemplatePolicyId: '6917fef5e88fa758ecc72e1b',
                      wipeTemplatePolicyId: '69186a11e88fa758ecc73127',
                      policyVersion: '1.0.0',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Flow completed',
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
      '/api/guardian/schemas/push/{topicId}': {
        post: {
          tags: ['Guardian Schema'],
          summary: 'Create schema via URL + /schemas/push/{topicId}',
          parameters: [
            {
              in: 'path',
              name: 'topicId',
              required: true,
              schema: { type: 'string' },
              example: '0.0.8073625',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GuardianSchemaPushRequest',
                },
                examples: {
                  requestedSchema: {
                    value: {
                      name: 'test',
                      entity: 'VC',
                      properties: {
                        '@context': {
                          oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } },
                          ],
                          readOnly: true,
                        },
                        type: {
                          oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } },
                          ],
                          readOnly: true,
                        },
                        id: {
                          type: 'string',
                          readOnly: true,
                        },
                        field1: {
                          title: 'field1',
                          description: 'range',
                          readOnly: false,
                          type: 'string',
                          $comment:
                            '{"term":"field1","@id":"https://www.schema.org/text","availableOptions":[],"orderPosition":0}',
                        },
                        policyId: {
                          title: 'Policy Id',
                          description: 'Policy Id',
                          readOnly: true,
                          type: 'string',
                          $comment:
                            '{"term":"policyId","@id":"https://www.schema.org/text"}',
                        },
                        ref: {
                          title: 'Relationships',
                          description: 'Relationships',
                          readOnly: true,
                          type: 'string',
                          $comment:
                            '{"term":"ref","@id":"https://www.schema.org/text"}',
                        },
                        guardianVersion: {
                          title: 'Guardian Version',
                          description: 'Guardian Version',
                          readOnly: true,
                          type: 'string',
                          $comment:
                            '{"term":"guardianVersion","@id":"https://www.schema.org/text"}',
                        },
                      },
                      required: ['@context', 'type', 'policyId'],
                      additionalProperties: false,
                      $defs: {},
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Schema created',
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
      '/api/guardian/policies': {
        get: {
          tags: ['Guardian Policies'],
          summary:
            'Get all Guardian policies (aggregated from paginated /policies)',
          parameters: [
            {
              in: 'query',
              name: 'pageSize',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 200,
                default: 100,
              },
              description: 'Per-page fetch size when aggregating policies.',
            },
            {
              in: 'query',
              name: 'maxPages',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 200,
                default: 50,
              },
              description: 'Safety limit for pagination loops.',
            },
          ],
          responses: {
            200: {
              description: 'Policies retrieved',
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
      '/api/guardian/schemas/by-topic/{topicId}': {
        get: {
          tags: ['Guardian Schema'],
          summary: 'Get schemas filtered by topicId (scans paginated /schemas)',
          parameters: [
            {
              in: 'path',
              name: 'topicId',
              required: true,
              schema: { type: 'string' },
              example: '0.0.8073625',
            },
            {
              in: 'query',
              name: 'pageSize',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 200,
                default: 100,
              },
              description: 'Per-page fetch size when scanning schemas.',
            },
            {
              in: 'query',
              name: 'maxPages',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 200,
                default: 50,
              },
              description: 'Safety limit for pagination loops.',
            },
          ],
          responses: {
            200: {
              description: 'Schemas retrieved',
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
      '/api/guardian/policies/{policyId}': {
        get: {
          tags: ['Guardian Policies'],
          summary:
            'Get Guardian policy by policyId via URL + /policies/{policyId}',
          parameters: [
            {
              in: 'path',
              name: 'policyId',
              required: true,
              schema: { type: 'string' },
              example: '6917fef5e88fa758ecc72e1b',
            },
          ],
          responses: {
            200: {
              description: 'Policy retrieved',
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
        put: {
          tags: ['Guardian Policies'],
          summary:
            'Update Guardian policy configuration via URL + /policies/{policyId}',
          parameters: [
            {
              in: 'path',
              name: 'policyId',
              required: true,
              schema: { type: 'string' },
              example: '6917fef5e88fa758ecc72e1b',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GuardianUpdatePolicyRequest',
                },
                examples: {
                  configUpdate: {
                    value: {
                      config: {
                        id: 'a75b9508-18ce-4c97-89c4-ce253e5350a9',
                        blockType: 'interfaceContainerBlock',
                        permissions: ['ANY_ROLE'],
                        onErrorAction: 'no-action',
                        uiMetaData: { type: 'blank' },
                        tag: '',
                        children: [
                          {
                            blockType: 'requestVcDocumentBlock',
                            defaultActive: true,
                            permissions: ['ANY_ROLE'],
                            onErrorAction: 'no-action',
                            editType: 'new',
                            uiMetaData: { type: 'page' },
                            presetFields: [],
                            tag: 'Block_1',
                            children: [],
                            events: [],
                            artifacts: [],
                          },
                        ],
                        events: [],
                        artifacts: [],
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Policy updated',
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
      '/api/guardian/policies/{policyId}/publish': {
        put: {
          tags: ['Guardian Policies'],
          summary:
            'Publish policy by policyId via URL + /policies/{policyId}/publish',
          parameters: [
            {
              in: 'path',
              name: 'policyId',
              required: true,
              schema: { type: 'string' },
              example: '6917fef5e88fa758ecc72e1b',
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GuardianPublishPolicyRequest',
                },
                examples: {
                  defaultVersion: {
                    value: { policyVersion: '1.0.0' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Policy published',
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
      '/api/guardian/policies/{policyId}/publish-treasury': {
        put: {
          tags: ['Guardian Policies'],
          summary:
            'Publish policy by policyId using TREASURY_USERNAME/TREASURY_PASSWORD',
          parameters: [
            {
              in: 'path',
              name: 'policyId',
              required: true,
              schema: { type: 'string' },
              example: '6917fef5e88fa758ecc72e1b',
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GuardianPublishPolicyRequest',
                },
                examples: {
                  defaultVersion: {
                    value: { policyVersion: '1.0.0' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Policy published with treasury account',
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
      '/api/guardian/mint': {
        post: {
          tags: ['Guardian Operations'],
          summary: 'Execute Guardian mint block (ported from old Guardian app)',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuardianMintRequest' },
                examples: {
                  defaultConfig: {
                    value: {
                      document: {
                        field0: 'walletAddress',
                        field1: 'tokenId',
                        field2: 'amount',
                        field3: '',
                        field4: '',
                      },
                    },
                  },
                  overridePolicyBlock: {
                    value: {
                      policyId: 'policy-id',
                      blockUUID: 'block-uuid',
                      payload: {
                        document: {
                          field0: 'walletAddress',
                          field1: 'tokenId',
                          field2: 'amount',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Mint block executed',
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
      '/api/guardian/wipe': {
        post: {
          tags: ['Guardian Operations'],
          summary:
            'Execute Guardian wipe block. Supports single/range serial input and auto mode',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuardianWipeRequest' },
                examples: {
                  singleSerial: {
                    value: {
                      document: {
                        field1: '4',
                      },
                    },
                  },
                  serialRange: {
                    value: {
                      document: {
                        field1: '4-8',
                      },
                    },
                  },
                  autoMode: {
                    value: {
                      tokenId: '0.0.7264176',
                      targetAccountId: '0.0.7257818',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Wipe block executed',
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
      '/api/guardian/token-associate': {
        post: {
          tags: ['Guardian Operations'],
          summary:
            'Associate token(s) using regular Hedera SDK TokenAssociateTransaction (no Guardian block)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GuardianTokenAssociateRequest',
                },
                examples: {
                  single: {
                    value: {
                      accountId: '0.0.7098424',
                      tokenId: '0.0.8061310',
                    },
                  },
                  multiple: {
                    value: {
                      accountId: '0.0.7098424',
                      tokenIds: ['0.0.8061310', '0.0.8061316'],
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Token association submitted',
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
      '/api/agent/froggy-guardian': {
        post: {
          tags: ['Agent'],
          summary:
            'Guardian chat agent for policy enquiries and fully-invested station policy creation workflow',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GuardianAgentChatRequest',
                },
                examples: {
                  policyEnquiry: {
                    value: {
                      message:
                        'show me the guardian policy for Madison Square Garden',
                    },
                  },
                  listFullyInvested: {
                    value: {
                      message: 'what stations have been fully-invested',
                    },
                  },
                  createPolicies: {
                    value: {
                      message:
                        'yes create guardian policy and schema for Madison Square Garden New York',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Guardian chat response',
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
      '/.well-known/froggy-guardian-agent.json': {
        get: {
          tags: ['A2A'],
          summary: 'FroggyGuardian A2A discovery document',
          responses: {
            200: {
              description: 'Guardian A2A agent discovery metadata',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/.well-known/froggy-guardian-agent-card.json': {
        get: {
          tags: ['A2A'],
          summary: 'FroggyGuardian A2A agent card',
          responses: {
            200: {
              description: 'Guardian A2A agent card metadata',
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
      '/.well-known/froggychat-agent.json': {
        get: {
          tags: ['A2A'],
          summary: 'FroggyChat A2A discovery document',
          responses: {
            200: {
              description: 'FroggyChat A2A discovery metadata',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/.well-known/froggychat-agent-card.json': {
        get: {
          tags: ['A2A'],
          summary: 'FroggyChat A2A agent card',
          responses: {
            200: {
              description: 'FroggyChat A2A agent card metadata',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/a2a/froggy-chat': {
        post: {
          tags: ['A2A'],
          summary:
            'ChargeFrog FroggyChat A2A endpoint that routes to planner, foundry, or guardian by intent',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
                examples: {
                  investmentMessage: {
                    value: {
                      jsonrpc: '2.0',
                      id: '1',
                      method: 'message/send',
                      params: {
                        message: {
                          messageId: 'froggychat-msg-1',
                          role: 'user',
                          parts: [
                            {
                              text: 'Can you list any available stations for me to invest in?',
                            },
                          ],
                          metadata: {
                            walletAddress: '0.0.xxxxxxxx',
                          },
                        },
                      },
                    },
                  },
                  foundryMessage: {
                    value: {
                      jsonrpc: '2.0',
                      id: '2',
                      method: 'message/send',
                      params: {
                        message: {
                          messageId: 'froggychat-msg-2',
                          role: 'user',
                          parts: [
                            {
                              text: 'Which stations require my attention?',
                            },
                          ],
                        },
                      },
                    },
                  },
                  guardianMessage: {
                    value: {
                      jsonrpc: '2.0',
                      id: '3',
                      method: 'message/send',
                      params: {
                        message: {
                          messageId: 'froggychat-msg-3',
                          role: 'user',
                          parts: [
                            {
                              text: 'Show me the guardian policy for Madison Square Garden',
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'FroggyChat A2A JSON-RPC response',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                  examples: {
                    completedTask: {
                      value: {
                        jsonrpc: '2.0',
                        id: '2',
                        result: {
                          id: 'froggychat-task-id',
                          contextId: 'froggychat-context-id',
                          kind: 'task',
                          status: {
                            state: 'completed',
                            message: {
                              kind: 'message',
                              messageId: 'froggychat-agent-message-id',
                              contextId: 'froggychat-context-id',
                              taskId: 'froggychat-task-id',
                              role: 'agent',
                              parts: [
                                {
                                  kind: 'text',
                                  text: 'The station requiring your attention is station 8 (ChargeFrog Station - Madison Square Garden) proposal proposal_1741856400000_abc123def4; would you like to approve this station, this would mean deployment on hedera testnet through the chargefrog contracts, and the creation of equity and bond stations',
                                },
                              ],
                              metadata: {
                                a2a: true,
                                endpoint: '/a2a/froggy-chat',
                                status: 'pending_admin_action_queue',
                              },
                            },
                          },
                          artifacts: [
                            {
                              artifactId: 'froggychat-artifact-id',
                              name: 'froggychat-result',
                              description:
                                'Structured result from ChargeFrog FroggyChat',
                              parts: [
                                {
                                  kind: 'data',
                                  data: {
                                    status: 'pending_admin_action_queue',
                                    routedAgentKey: 'foundry',
                                    routedAgentName: 'FroggyFoundry',
                                    routedAgentEndpoint: '/a2a/froggy-foundry',
                                    routeReason: 'foundry_intent',
                                    trail: [
                                      {
                                        stage: 'received',
                                        agentKey: 'froggychat',
                                        agentName: 'FroggyChat',
                                        endpointPath: '/a2a/froggy-chat',
                                        message:
                                          'Which stations require my attention?',
                                        success: true,
                                        at: '2026-03-17T10:00:00.000Z',
                                      },
                                      {
                                        stage: 'routed',
                                        agentKey: 'foundry',
                                        agentName: 'FroggyFoundry',
                                        endpointPath: '/a2a/froggy-foundry',
                                        reason: 'foundry_intent',
                                        success: true,
                                        at: '2026-03-17T10:00:00.010Z',
                                      },
                                      {
                                        stage: 'a2a_call_started',
                                        transport: 'a2a_http_external',
                                        callerAgentKey: 'froggychat',
                                        callerAgentName: 'FroggyChat',
                                        callerEndpointPath: '/a2a/froggy-chat',
                                        calleeAgentKey: 'foundry',
                                        calleeAgentName: 'FroggyFoundry',
                                        calleeEndpointPath:
                                          '/a2a/froggy-foundry',
                                        message:
                                          'Which stations require my attention?',
                                        success: true,
                                        at: '2026-03-17T10:00:00.011Z',
                                      },
                                      {
                                        stage: 'a2a_call_completed',
                                        agentKey: 'foundry',
                                        agentName: 'FroggyFoundry',
                                        endpointPath: '/a2a/froggy-foundry',
                                        transport: 'a2a_http_external',
                                        callerAgentKey: 'froggychat',
                                        callerAgentName: 'FroggyChat',
                                        callerEndpointPath: '/a2a/froggy-chat',
                                        calleeAgentKey: 'foundry',
                                        calleeAgentName: 'FroggyFoundry',
                                        calleeEndpointPath:
                                          '/a2a/froggy-foundry',
                                        status: 'pending_admin_action_queue',
                                        success: true,
                                        at: '2026-03-17T10:00:00.320Z',
                                        durationMs: 309,
                                      },
                                    ],
                                    reply:
                                      'The station requiring your attention is station 8 (ChargeFrog Station - Madison Square Garden) proposal proposal_1741856400000_abc123def4; would you like to approve this station, this would mean deployment on hedera testnet through the chargefrog contracts, and the creation of equity and bond stations',
                                  },
                                },
                              ],
                            },
                          ],
                          metadata: {
                            source: 'chargefrog-froggychat',
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
      '/a2a/froggy-guardian': {
        post: {
          tags: ['A2A'],
          summary: 'Guardian A2A JSON-RPC endpoint',
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
                          messageId: 'guardian-msg-1',
                          role: 'user',
                          parts: [
                            {
                              text: 'show me the guardian policy for Madison Square Garden',
                            },
                          ],
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
              description: 'Guardian A2A JSON-RPC response',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                  examples: {
                    completedTask: {
                      value: {
                        jsonrpc: '2.0',
                        id: '1',
                        result: {
                          id: 'guardian-task-id',
                          contextId: 'guardian-context-id',
                          kind: 'task',
                          status: {
                            state: 'completed',
                            message: {
                              kind: 'message',
                              messageId: 'guardian-agent-message-id',
                              contextId: 'guardian-context-id',
                              taskId: 'guardian-task-id',
                              role: 'agent',
                              parts: [
                                {
                                  kind: 'text',
                                  text: 'There is 1 fully-invested station ready for Guardian policy and schema creation: station 1: ChargeFrog Station - Madison Square Garden New York (fully-invested).',
                                },
                              ],
                              metadata: {
                                a2a: true,
                                endpoint: '/a2a/froggy-guardian',
                                intent: 'LIST_FULLY_INVESTED_STATIONS',
                              },
                            },
                          },
                          artifacts: [
                            {
                              artifactId: 'guardian-artifact-id',
                              name: 'guardian-result',
                              description:
                                'Structured result from ChargeFrog Guardian',
                              parts: [
                                {
                                  kind: 'data',
                                  data: {
                                    intent: 'LIST_FULLY_INVESTED_STATIONS',
                                    reply:
                                      'I found 1 fully-invested station that is ready for Guardian policy and schema creation so the station can move closer to going live: ChargeFrog Station - Madison Square Garden New York (stationId 1).',
                                    stations: [
                                      {
                                        stationId: 1,
                                        stationName:
                                          'ChargeFrog Station - Madison Square Garden New York',
                                        stage: 'fully-invested',
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          ],
                          metadata: {
                            source: 'chargefrog-guardian',
                            intent: 'LIST_FULLY_INVESTED_STATIONS',
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
        GuardianSchemaPushRequest: {
          type: 'object',
          properties: {
            payload: {
              type: 'object',
              additionalProperties: true,
              description:
                'Optional explicit payload sent as-is to /schemas/push/{topicId}.',
            },
            uuid: {
              type: 'string',
              description:
                'Optional schema UUID. If omitted, server auto-generates one.',
            },
            name: { type: 'string', example: 'test' },
            description: { type: 'string', example: '' },
            entity: { type: 'string', example: 'VC' },
            properties: {
              type: 'object',
              additionalProperties: true,
              description:
                'JSON schema properties. If document is omitted, server wraps this into document.',
            },
            required: {
              type: 'array',
              items: { type: 'string' },
              example: ['@context', 'type', 'policyId'],
            },
            additionalProperties: { type: 'boolean', example: false },
            $defs: {
              type: 'object',
              additionalProperties: true,
              example: {},
            },
            document: {
              type: 'object',
              additionalProperties: true,
              description:
                'Optional full Guardian document object. If provided, it takes precedence.',
            },
          },
          additionalProperties: true,
        },
        GuardianPublishPolicyRequest: {
          type: 'object',
          properties: {
            policyVersion: {
              type: 'string',
              example: '1.0.0',
              default: '1.0.0',
              description: 'Policy version sent to Guardian publish endpoint.',
            },
          },
          additionalProperties: true,
        },
        GuardianUpdatePolicyRequest: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              additionalProperties: true,
              description:
                'Policy config object forwarded to PUT /policies/{policyId}.',
            },
            payload: {
              type: 'object',
              additionalProperties: true,
              description:
                'Optional explicit payload. If set, it is sent as-is to PUT /policies/{policyId}.',
            },
          },
          required: ['config'],
          additionalProperties: true,
        },
        GuardianCreatePolicyRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'test' },
            applicabilityConditions: { type: 'string', example: 'test' },
            detailsUrl: { type: 'string', example: 'test' },
            policyTag: { type: 'string', example: 'Tag_17725515820794' },
            typicalProjects: { type: 'string', example: '' },
            topicDescription: { type: 'string', example: '' },
            description: { type: 'string', example: '' },
            categories: {
              type: 'array',
              items: { type: 'string' },
              example: [
                '6917d97da17a3035b283a89e',
                '6917d97da17a3035b283a887',
                '6917d97da17a3035b283a889',
                '6917d97da17a3035b283a896',
                '6917d97da17a3035b283a89a',
              ],
            },
            importantParameters: {
              type: 'object',
              properties: {
                atValidation: { type: 'string', example: '' },
                monitored: { type: 'string', example: '' },
              },
              additionalProperties: true,
            },
            payload: {
              type: 'object',
              description:
                'Optional explicit payload. If set, it is sent as-is to /policies/push.',
              additionalProperties: true,
            },
          },
          required: ['name', 'policyTag', 'categories', 'importantParameters'],
          additionalProperties: true,
        },
        GuardianPolicyFlowAgentRequest: {
          type: 'object',
          properties: {
            stationName: {
              type: 'string',
              example: 'Madison Square Garden',
              description:
                'Station display name injected into cloned policy/schema names.',
            },
            station_name: {
              type: 'string',
              example: 'Madison Square Garden',
              description: 'Alias of stationName.',
            },
            name: {
              type: 'string',
              example: 'Madison Square Garden',
              description: 'Alias of stationName.',
            },
            carbonTemplatePolicyId: {
              type: 'string',
              example: '6917fef5e88fa758ecc72e1b',
              description:
                'Fixed source Carbon Offset template policyId. If provided, it must equal 6917fef5e88fa758ecc72e1b.',
            },
            wipeTemplatePolicyId: {
              type: 'string',
              example: '69186a11e88fa758ecc73127',
              description:
                'Fixed source Wipe Token template policyId. If provided, it must equal 69186a11e88fa758ecc73127.',
            },
            policyVersion: {
              type: 'string',
              example: '1.0.0',
              default: '1.0.0',
              description: 'Version passed to publish endpoints.',
            },
            secondPolicyDelayMs: {
              type: 'integer',
              example: 10000,
              default: 10000,
              description:
                'Delay before starting the second policy flow (wipe token). Default 10000ms.',
            },
          },
          required: ['stationName'],
          additionalProperties: false,
        },
        GuardianMintRequest: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description:
                'Optional override. Defaults to mintTokenRequestVCBlock_policyID.',
            },
            blockUUID: {
              type: 'string',
              description:
                'Optional override. Defaults to mintTokenRequestVCBlock_blockUUID.',
            },
            payload: {
              type: 'object',
              additionalProperties: true,
              description:
                'Exact payload posted to Guardian policy block. If omitted, root object is used as payload.',
            },
            document: {
              type: 'object',
              additionalProperties: true,
              description: 'Convenience shorthand if payload is omitted.',
            },
          },
          additionalProperties: true,
        },
        GuardianWipeRequest: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description:
                'Optional override. Defaults to wipeTokenRequestVCBlock_policyID.',
            },
            blockUUID: {
              type: 'string',
              description:
                'Optional override. Defaults to wipeTokenRequestVCBlock_blockUUID.',
            },
            tokenId: {
              type: 'string',
              description:
                'Used in auto wipe mode when document.field1 is empty.',
            },
            targetAccountId: {
              type: 'string',
              description:
                'Used in auto wipe mode when document.field1 is empty.',
            },
            network: {
              type: 'string',
              enum: ['testnet'],
              example: 'testnet',
              description: 'Guardian is testnet-only.',
            },
            payload: {
              type: 'object',
              additionalProperties: true,
              description:
                'Exact payload posted to Guardian policy block. If document.field1 exists, single/range wipe mode is used.',
            },
            document: {
              type: 'object',
              properties: {
                field1: {
                  type: 'string',
                  description:
                    'Serial selector. "4" for single, "4-8" for range, empty for auto mode.',
                },
              },
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        GuardianTokenAssociateRequest: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              example: '0.0.7098424',
              description:
                'Hedera account to associate token(s) with. Required unless OPERATOR_ID is set.',
            },
            privateKey: {
              type: 'string',
              description:
                'Private key for accountId. Optional if OPERATOR_KEY is set.',
            },
            tokenId: {
              type: 'string',
              example: '0.0.8061310',
            },
            tokenIds: {
              type: 'array',
              items: { type: 'string' },
              example: ['0.0.8061310', '0.0.8061316'],
            },
            network: {
              type: 'string',
              enum: ['testnet'],
              example: 'testnet',
              description: 'Guardian is testnet-only.',
            },
            memo: {
              type: 'string',
              description: 'Optional Hedera tx memo (max 100 chars).',
            },
          },
          additionalProperties: true,
        },
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
              description: 'Alias of expectedStationId.',
            },
          },
          anyOf: [{ required: ['message'] }, { required: ['proposalId'] }],
          additionalProperties: false,
        },
        GuardianAgentChatRequest: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example:
                'show me the guardian policy for ChargeFrog Station - Madison Square Garden',
              description:
                'Supports per-station Guardian policy enquiry, listing fully-invested stations, and confirming Guardian policy creation by station name.',
            },
          },
          required: ['message'],
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

  if (!includeTestingRoutes) {
    const allowedPaths = new Set([
      '/.well-known/froggychat-agent.json',
      '/.well-known/froggychat-agent-card.json',
      '/.well-known/froggy-planner-agent.json',
      '/.well-known/froggy-planner-agent-card.json',
      '/.well-known/froggy-foundry-agent.json',
      '/.well-known/froggy-foundry-agent-card.json',
      '/.well-known/froggy-guardian-agent.json',
      '/.well-known/froggy-guardian-agent-card.json',
      '/a2a/froggy-chat',
      '/a2a/froggy-planner',
      '/a2a/froggy-foundry',
      '/a2a/froggy-guardian',
    ]);
    spec.paths = Object.fromEntries(
      Object.entries(spec.paths).filter(([path]) => allowedPaths.has(path)),
    );
  }

  const usedTags = new Set();
  for (const operations of Object.values(spec.paths)) {
    for (const operation of Object.values(operations)) {
      for (const tag of operation.tags || []) {
        usedTags.add(tag);
      }
    }
  }
  spec.tags = spec.tags.filter((tag) => usedTags.has(tag.name));

  return spec;
}

function getDocsHtml(options = {}) {
  const title = String(options.title || 'Froggy Planner API Docs');
  const specUrl = String(options.specUrl || '/openapi.json');
  const navLinks = Array.isArray(options.navLinks) ? options.navLinks : [];
  const navLinksHtml = navLinks.length
    ? `<div class="docs-nav">${navLinks
        .map(
          (link) =>
            `<a class="docs-nav-link" href="${String(link.href || '#')}">${String(link.label || link.href || '')}</a>`,
        )
        .join('')}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; background: #f7f9fc; }
      body { font-family: Arial, sans-serif; color: #132238; }
      .docs-toolbar {
        max-width: 1200px;
        margin: 0 auto;
        padding: 16px 20px 0;
      }
      .docs-nav {
        max-width: 1200px;
        margin: 0 auto;
        padding: 16px 20px 0;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .docs-nav-link {
        display: inline-flex;
        align-items: center;
        border: 1px solid #d6dfeb;
        border-radius: 999px;
        background: #ffffff;
        color: #17324d;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 700;
        text-decoration: none;
        box-shadow: 0 6px 18px rgba(19, 34, 56, 0.05);
      }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
      @media (max-width: 640px) {
        .docs-nav { padding: 12px 12px 0; }
      }
    </style>
  </head>
  <body>
    ${navLinksHtml}
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
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
