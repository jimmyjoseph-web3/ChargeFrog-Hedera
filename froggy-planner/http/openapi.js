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
      { name: 'ATS' },
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
