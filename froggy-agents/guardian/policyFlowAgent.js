const { guardianTools } = require('./tools');

const DEFAULT_CARBON_TEMPLATE_POLICY_ID = '6917fef5e88fa758ecc72e1b';
const DEFAULT_WIPE_TEMPLATE_POLICY_ID = '69186a11e88fa758ecc73127';
const DEFAULT_GUARDIAN_TOKEN_ID = '0.0.7264176';
const DEFAULT_POLICY_VERSION = '1.0.0';

const DEFAULT_POLICY_CATEGORIES = [
  '6917d97da17a3035b283a89e',
  '6917d97da17a3035b283a887',
  '6917d97da17a3035b283a889',
  '6917d97da17a3035b283a896',
  '6917d97da17a3035b283a89a',
];

const IDENTIFIER_KEYS_TO_REMOVE = new Set([
  'policyId',
  '_id',
  'uuid',
  'createDate',
  'updateDate',
  'hash',
  'hashMap',
  'hashMapFileId',
  'messageId',
  'configFileId',
  'instanceTopicId',
  'synchronizationTopicId',
  'commentsTopicId',
]);

const SCHEMA_REFERENCE_KEYS = new Set(['schema', 'presetSchema']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = deepClone(item);
  }
  return out;
}

function unwrapResult(value) {
  if (isPlainObject(value) && isPlainObject(value.result)) {
    return value.result;
  }
  return value;
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function extractPolicyId(policy) {
  if (!isPlainObject(policy)) return null;
  return firstNonEmpty([policy.policyId, policy.id, policy.uuid, policy._id]);
}

function extractPolicyStatus(policy) {
  if (!isPlainObject(policy)) return '';
  return String(policy.status || '')
    .trim()
    .toUpperCase();
}

function extractPolicyName(policy) {
  if (!isPlainObject(policy)) return '';
  return String(policy.name || '').trim();
}

function extractPolicyTopicId(policy) {
  if (!isPlainObject(policy)) return null;
  return firstNonEmpty([
    policy.topicId,
    policy.topicID,
    policy.topic_id,
    policy.instanceTopicId,
    policy.synchronizationTopicId,
  ]);
}

function extractPolicyConfig(policy) {
  if (!isPlainObject(policy)) return null;
  if (isPlainObject(policy.config)) return deepClone(policy.config);
  if (isPlainObject(policy.policy) && isPlainObject(policy.policy.config)) {
    return deepClone(policy.policy.config);
  }
  return null;
}

function normalizePolicyListResponse(response) {
  const payload = unwrapResult(response);
  if (Array.isArray(payload)) return payload;
  if (isPlainObject(payload) && Array.isArray(payload.policies))
    return payload.policies;
  if (isPlainObject(payload) && Array.isArray(payload.data))
    return payload.data;
  return [];
}

function normalizeSchemaListResponse(response) {
  const payload = unwrapResult(response);
  if (Array.isArray(payload)) return payload;
  if (isPlainObject(payload) && Array.isArray(payload.schemas))
    return payload.schemas;
  if (isPlainObject(payload) && Array.isArray(payload.data))
    return payload.data;
  return [];
}

function buildPolicyTag() {
  const randomizedTimestamp =
    Date.now() + Math.floor(Math.random() * 1_000_000);
  return `Tag_${randomizedTimestamp}`;
}

function sanitizePolicyConfig(value, state, path = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizePolicyConfig(item, state, path.concat(index)),
    );
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (IDENTIFIER_KEYS_TO_REMOVE.has(key)) {
      continue;
    }
    if (SCHEMA_REFERENCE_KEYS.has(key)) {
      state.schemaReferencePaths.push(path.concat(key));
      continue;
    }
    if (key === 'tokenId') {
      const tokenId = DEFAULT_GUARDIAN_TOKEN_ID;
      state.tokenIds.add(tokenId);
      output[key] = tokenId;
      continue;
    }
    output[key] = sanitizePolicyConfig(item, state, path.concat(key));
  }
  return output;
}

function setAtPath(root, path, value) {
  let cursor = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const nextKey = path[i + 1];
    const nextShouldBeArray = typeof nextKey === 'number';
    if (!isPlainObject(cursor[key]) && !Array.isArray(cursor[key])) {
      cursor[key] = nextShouldBeArray ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
}

function applySchemaUriToConfig(config, schemaReferencePaths, schemaUri) {
  if (
    !Array.isArray(schemaReferencePaths) ||
    schemaReferencePaths.length === 0
  ) {
    throw new Error(
      'Template config did not contain schema/presetSchema references to reattach',
    );
  }
  const output = deepClone(config);
  for (const path of schemaReferencePaths) {
    if (!Array.isArray(path) || path.length === 0) continue;
    setAtPath(output, path, schemaUri);
  }
  return output;
}

function forceSchemaBindings(config, schemaUri) {
  const output = deepClone(config);
  let sawSchema = false;
  let sawPresetSchema = false;

  function walk(node) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isPlainObject(node)) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(node, 'schema')) {
      node.schema = schemaUri;
      sawSchema = true;
    }
    if (Object.prototype.hasOwnProperty.call(node, 'presetSchema')) {
      node.presetSchema = schemaUri;
      sawPresetSchema = true;
    }

    const blockType = String(node.blockType || '').trim();
    if (
      blockType === 'requestVcDocumentBlock' ||
      blockType === 'retirementDocumentBlock'
    ) {
      node.schema = schemaUri;
      node.presetSchema = schemaUri;
      sawSchema = true;
      sawPresetSchema = true;
    }

    for (const value of Object.values(node)) {
      walk(value);
    }
  }

  walk(output);

  if (!sawSchema) {
    output.schema = schemaUri;
    sawSchema = true;
  }
  if (!sawPresetSchema) {
    output.presetSchema = schemaUri;
    sawPresetSchema = true;
  }

  return output;
}

function findSchemaBindingStatus(config, schemaUri) {
  let hasSchema = false;
  let hasPresetSchema = false;

  function walk(node) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isPlainObject(node)) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(node, 'schema') &&
      String(node.schema || '').trim() === String(schemaUri || '').trim()
    ) {
      hasSchema = true;
    }
    if (
      Object.prototype.hasOwnProperty.call(node, 'presetSchema') &&
      String(node.presetSchema || '').trim() === String(schemaUri || '').trim()
    ) {
      hasPresetSchema = true;
    }

    for (const value of Object.values(node)) {
      walk(value);
    }
  }

  walk(config);
  return { hasSchema, hasPresetSchema };
}

function parseSchemaDocument(schemaItem) {
  const rawDocument = schemaItem?.document;
  if (isPlainObject(rawDocument)) return rawDocument;
  if (typeof rawDocument === 'string') {
    try {
      const parsed = JSON.parse(rawDocument);
      if (!isPlainObject(parsed)) {
        throw new Error('document JSON is not an object');
      }
      return parsed;
    } catch (error) {
      throw new Error(`Invalid schema document JSON: ${error.message}`);
    }
  }
  throw new Error('Schema item does not include a valid document');
}

function selectBestSourceSchema(schemas, kind) {
  if (!Array.isArray(schemas) || schemas.length === 0) {
    throw new Error('No source schemas found for template topic');
  }
  let best = null;
  let bestScore = -1;

  for (const schema of schemas) {
    const text =
      `${schema?.name || ''} ${schema?.description || ''}`.toLowerCase();
    let score = 1;
    if (kind === 'carbon') {
      if (text.includes('carbon')) score += 4;
      if (text.includes('offset')) score += 3;
    }
    if (kind === 'wipe') {
      if (text.includes('wipe')) score += 4;
      if (text.includes('token')) score += 2;
    }
    if (schema?.document) score += 1;

    if (score > bestScore) {
      best = schema;
      bestScore = score;
    }
  }

  return best;
}

function buildSchemaCreatePayload(sourceSchema, schemaName) {
  const schemaDoc = parseSchemaDocument(sourceSchema);
  return {
    name: schemaName,
    entity: String(sourceSchema?.entity || 'VC'),
    properties: isPlainObject(schemaDoc.properties) ? schemaDoc.properties : {},
    required: Array.isArray(schemaDoc.required) ? schemaDoc.required : [],
    additionalProperties:
      schemaDoc.additionalProperties === undefined
        ? false
        : Boolean(schemaDoc.additionalProperties),
    $defs: isPlainObject(schemaDoc.$defs) ? schemaDoc.$defs : {},
  };
}

function getSchemaUri(schemaItem) {
  if (!isPlainObject(schemaItem)) return null;
  const uri = firstNonEmpty([
    schemaItem.uri,
    schemaItem.iri,
    schemaItem.documentURL,
    schemaItem.contextURL,
  ]);
  if (uri) return uri;
  const uuid = firstNonEmpty([schemaItem.uuid]);
  return uuid ? `schema:${uuid}` : null;
}

function toTimestamp(value) {
  const parsed = Number(new Date(value).getTime());
  return Number.isFinite(parsed) ? parsed : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectDraftPolicyIds(policies) {
  const ids = new Set();
  for (const item of Array.isArray(policies) ? policies : []) {
    if (extractPolicyStatus(item) !== 'DRAFT') continue;
    const policyId = extractPolicyId(item);
    if (policyId) {
      ids.add(policyId);
    }
  }
  return ids;
}

function findDraftPolicyRecord(
  policies,
  expectedName,
  excludedPolicyIds = null,
  previousDraftPolicyIds = null,
) {
  const excluded =
    excludedPolicyIds instanceof Set ? excludedPolicyIds : new Set();
  const previousDrafts =
    previousDraftPolicyIds instanceof Set ? previousDraftPolicyIds : new Set();
  const drafts = policies.filter((item) => {
    if (extractPolicyStatus(item) !== 'DRAFT') return false;
    const policyId = extractPolicyId(item);
    if (!policyId) return false;
    if (excluded.has(policyId)) return false;
    if (previousDrafts.has(policyId)) return false;
    return true;
  });
  if (drafts.length === 0) {
    throw new Error('No draft policy found after policy creation');
  }

  if (expectedName) {
    const byName = drafts
      .filter((item) => extractPolicyName(item) === expectedName)
      .sort(
        (a, b) =>
          toTimestamp(b.updateDate || b.createDate) -
          toTimestamp(a.updateDate || a.createDate),
      );
    if (byName.length > 0) return byName[0];
  }

  if (drafts.length === 1) {
    return drafts[0];
  }

  throw new Error(
    `Multiple draft policies found (${drafts.length}). Unable to safely resolve the new draft policy.`,
  );
}

async function resolveDraftPolicy(
  createdPolicyName,
  excludedPolicyIds = null,
  previousDraftPolicyIds = null,
) {
  const initialDelayMs = 2000;
  const intervalMs = 1000;
  let attempts = 0;

  if (initialDelayMs > 0) {
    await sleep(initialDelayMs);
  }

  while (true) {
    attempts += 1;
    try {
      const listResponse = await guardianTools.listPolicies({
        pageSize: 100,
        maxPages: 50,
      });
      const policies = normalizePolicyListResponse(listResponse);
      const draftPolicy = findDraftPolicyRecord(
        policies,
        createdPolicyName || '',
        excludedPolicyIds,
        previousDraftPolicyIds,
      );

      const policyId = extractPolicyId(draftPolicy);
      const topicId = extractPolicyTopicId(draftPolicy);

      if (!policyId) {
        throw new Error(
          'Unable to resolve draft policyId from /api/guardian/policies',
        );
      }
      if (!topicId) {
        throw new Error(
          'Unable to resolve draft topicId from /api/guardian/policies',
        );
      }

      return {
        policyId,
        topicId,
        status: extractPolicyStatus(draftPolicy),
      };
    } catch (error) {
      const message = String(
        error && error.message ? error.message : '',
      ).toLowerCase();
      const isNoDraftYet = message.includes(
        'no draft policy found after policy creation',
      );
      if (!isNoDraftYet) {
        throw error;
      }
      await sleep(intervalMs);
    }
  }
}

async function resolveCreatedSchemaUri(topicId, schemaName) {
  const schemaListResponse = await guardianTools.listSchemasByTopicId({
    topicId,
    pageSize: 100,
    maxPages: 50,
  });
  const schemas = normalizeSchemaListResponse(schemaListResponse);
  const named = schemas.filter(
    (schema) => String(schema?.name || '').trim() === schemaName,
  );
  const pool = named.length > 0 ? named : schemas;
  if (pool.length === 0) {
    throw new Error(`No schemas found for topic ${topicId}`);
  }
  const sorted = pool
    .slice()
    .sort(
      (a, b) =>
        toTimestamp(b.updateDate || b.createDate) -
        toTimestamp(a.updateDate || a.createDate),
    );
  const schemaUri = getSchemaUri(sorted[0]);
  if (!schemaUri) {
    throw new Error(`Unable to resolve schema URI for topic ${topicId}`);
  }
  return schemaUri;
}

function buildPolicyCreatePayload(policyName, sanitizedConfig) {
  return {
    name: policyName,
    applicabilityConditions: '',
    detailsUrl: '',
    policyTag: buildPolicyTag(),
    typicalProjects: '',
    topicDescription: '',
    description: '',
    categories: DEFAULT_POLICY_CATEGORIES.slice(),
    importantParameters: {
      atValidation: '',
      monitored: '',
    },
    config: sanitizedConfig,
  };
}

function buildPolicyUpdatePayload(
  policyName,
  updatedConfig,
  existingPolicy = null,
) {
  const existing = isPlainObject(existingPolicy) ? existingPolicy : {};
  const policyTag = firstNonEmpty([
    existing.policyTag,
    existing.tag,
    buildPolicyTag(),
  ]);
  return {
    name: policyName,
    applicabilityConditions: '',
    detailsUrl: '',
    policyTag,
    typicalProjects: '',
    topicDescription: '',
    description: '',
    categories: DEFAULT_POLICY_CATEGORIES.slice(),
    importantParameters: {
      atValidation: '',
      monitored: '',
    },
    config: updatedConfig,
  };
}

function selectBestExistingPolicyByName(policies, policyName) {
  const matches = policies.filter(
    (item) => extractPolicyName(item) === policyName,
  );
  if (matches.length === 0) {
    return { policy: null, duplicateCount: 0 };
  }

  function statusWeight(status) {
    if (status === 'PUBLISHED') return 3;
    if (status === 'DRAFT') return 2;
    return 1;
  }

  const sorted = matches.slice().sort((a, b) => {
    const statusCompare =
      statusWeight(extractPolicyStatus(b)) -
      statusWeight(extractPolicyStatus(a));
    if (statusCompare !== 0) return statusCompare;
    return (
      toTimestamp(b.updateDate || b.createDate) -
      toTimestamp(a.updateDate || a.createDate)
    );
  });

  return {
    policy: sorted[0],
    duplicateCount: matches.length,
  };
}

async function runSinglePolicyFlow(options) {
  const {
    stationName,
    templatePolicyId,
    policyNameSuffix,
    schemaNameSuffix,
    publishRole,
    policyVersion,
    kind,
    usedPolicyIds,
    copiedTemplatePolicyIds,
  } = options;
  const usedIds = usedPolicyIds instanceof Set ? usedPolicyIds : new Set();
  const copiedTemplateIds =
    copiedTemplatePolicyIds instanceof Set
      ? copiedTemplatePolicyIds
      : new Set();

  if (copiedTemplateIds.has(templatePolicyId)) {
    throw new Error(
      `Template policy ${templatePolicyId} already processed in this run; refusing duplicate copy`,
    );
  }
  copiedTemplateIds.add(templatePolicyId);

  const sourcePolicyResponse = await guardianTools.getPolicyById({
    policyId: templatePolicyId,
  });
  const sourcePolicy = unwrapResult(sourcePolicyResponse);
  const sourceConfig = extractPolicyConfig(sourcePolicy);
  const sourceTopicId = extractPolicyTopicId(sourcePolicy);

  if (!sourceConfig) {
    throw new Error(
      `Template policy ${templatePolicyId} did not include config`,
    );
  }
  if (!sourceTopicId) {
    throw new Error(
      `Template policy ${templatePolicyId} did not include topicId`,
    );
  }

  const sanitizeState = {
    schemaReferencePaths: [],
    tokenIds: new Set(),
  };
  const sanitizedConfig = sanitizePolicyConfig(sourceConfig, sanitizeState, []);
  const tokenId =
    sanitizeState.tokenIds.values().next().value || DEFAULT_GUARDIAN_TOKEN_ID;

  const createdPolicyName = `ChargeFrog Policy for ${stationName} - ${policyNameSuffix}`;
  const existingPoliciesResponse = await guardianTools.listPolicies({
    pageSize: 100,
    maxPages: 50,
  });
  const existingPolicies = normalizePolicyListResponse(
    existingPoliciesResponse,
  );
  const stationPolicyPrefix = `ChargeFrog Policy for ${stationName} -`;
  const stationNamedPolicies = existingPolicies.filter((item) =>
    extractPolicyName(item).startsWith(stationPolicyPrefix),
  );
  if (stationNamedPolicies.length >= 2) {
    const hasTargetPolicy = stationNamedPolicies.some(
      (item) => extractPolicyName(item) === createdPolicyName,
    );
    if (!hasTargetPolicy) {
      throw new Error(
        `Refusing to create additional policy. Station "${stationName}" already has ${stationNamedPolicies.length} named policies.`,
      );
    }
  }

  const unnamedDraftPolicies = existingPolicies.filter(
    (item) => extractPolicyStatus(item) === 'DRAFT' && !extractPolicyName(item),
  );
  if (unnamedDraftPolicies.length > 0) {
    throw new Error(
      `Found ${unnamedDraftPolicies.length} unnamed draft policy/policies. Resolve or remove them before creating new policies.`,
    );
  }

  const { policy: existingPolicyByName, duplicateCount } =
    selectBestExistingPolicyByName(existingPolicies, createdPolicyName);
  if (duplicateCount > 1) {
    throw new Error(
      `Found ${duplicateCount} policies with same name "${createdPolicyName}". Resolve duplicates first.`,
    );
  }
  if (existingPolicyByName) {
    const existingPolicyId = extractPolicyId(existingPolicyByName);
    const existingStatus =
      extractPolicyStatus(existingPolicyByName) || 'UNKNOWN';
    throw new Error(
      `Policy "${createdPolicyName}" already exists (policyId=${existingPolicyId || 'n/a'}, status=${existingStatus}). Refusing duplicate creation.`,
    );
  }

  const createPolicyPayload = buildPolicyCreatePayload(
    createdPolicyName,
    sanitizedConfig,
  );
  const previousDraftPolicyIds = collectDraftPolicyIds(existingPolicies);
  await guardianTools.createPolicy({ payload: createPolicyPayload });
  const draftPolicy = await resolveDraftPolicy(
    createdPolicyName,
    usedIds,
    previousDraftPolicyIds,
  );
  if (usedIds.has(draftPolicy.policyId)) {
    throw new Error(
      `Resolved draft policy ${draftPolicy.policyId} is already used in this run; refusing duplicate reuse`,
    );
  }

  // Persist canonical metadata+config on resolved draft policy.
  await guardianTools.updatePolicyById({
    policyId: draftPolicy.policyId,
    payload: createPolicyPayload,
  });

  const sourceSchemasResponse = await guardianTools.listSchemasByTopicId({
    topicId: sourceTopicId,
    pageSize: 100,
    maxPages: 50,
  });
  const sourceSchemas = normalizeSchemaListResponse(sourceSchemasResponse);
  const selectedSourceSchema = selectBestSourceSchema(sourceSchemas, kind);
  const sourceSchemaName =
    String(selectedSourceSchema?.name || '').trim() || null;

  const createdSchemaName = `ChargeFrog Schema for ${stationName} - ${schemaNameSuffix}`;
  const schemaCreatePayload = buildSchemaCreatePayload(
    selectedSourceSchema,
    createdSchemaName,
  );
  await guardianTools.pushSchemaByTopic({
    topicId: draftPolicy.topicId,
    payload: schemaCreatePayload,
  });

  const schemaUri = await resolveCreatedSchemaUri(
    draftPolicy.topicId,
    createdSchemaName,
  );

  const createdPolicyResponse = await guardianTools.getPolicyById({
    policyId: draftPolicy.policyId,
  });
  const createdPolicy = unwrapResult(createdPolicyResponse);
  const createdPolicyConfig = extractPolicyConfig(createdPolicy);
  if (!createdPolicyConfig) {
    throw new Error(
      `Created policy ${draftPolicy.policyId} did not include config`,
    );
  }
  const updatedConfig = applySchemaUriToConfig(
    createdPolicyConfig,
    sanitizeState.schemaReferencePaths,
    schemaUri,
  );
  const bindingEnforcedConfig = forceSchemaBindings(updatedConfig, schemaUri);
  const updatePayload = buildPolicyUpdatePayload(
    createdPolicyName,
    bindingEnforcedConfig,
    createdPolicy,
  );

  await guardianTools.updatePolicyById({
    policyId: draftPolicy.policyId,
    payload: updatePayload,
  });

  // Verify schema + presetSchema are attached; repair once if Guardian drops either field.
  const verifyPolicyResponse = await guardianTools.getPolicyById({
    policyId: draftPolicy.policyId,
  });
  const verifyPolicy = unwrapResult(verifyPolicyResponse);
  const verifyConfig = extractPolicyConfig(verifyPolicy);
  const bindingStatus = findSchemaBindingStatus(verifyConfig, schemaUri);
  if (!bindingStatus.hasSchema || !bindingStatus.hasPresetSchema) {
    const repairedConfig = forceSchemaBindings(
      verifyConfig || bindingEnforcedConfig,
      schemaUri,
    );
    const repairPayload = buildPolicyUpdatePayload(
      createdPolicyName,
      repairedConfig,
      verifyPolicy,
    );
    await guardianTools.updatePolicyById({
      policyId: draftPolicy.policyId,
      payload: repairPayload,
    });

    const verifyPolicyResponse2 = await guardianTools.getPolicyById({
      policyId: draftPolicy.policyId,
    });
    const verifyPolicy2 = unwrapResult(verifyPolicyResponse2);
    const verifyConfig2 = extractPolicyConfig(verifyPolicy2);
    const bindingStatus2 = findSchemaBindingStatus(verifyConfig2, schemaUri);
    if (!bindingStatus2.hasSchema || !bindingStatus2.hasPresetSchema) {
      throw new Error(
        `Failed to attach both schema and presetSchema for policy ${draftPolicy.policyId}`,
      );
    }
  }

  if (publishRole === 'treasury') {
    await guardianTools.publishPolicyByIdTreasury({
      policyId: draftPolicy.policyId,
      policyVersion,
    });
  } else {
    await guardianTools.publishPolicyById({
      policyId: draftPolicy.policyId,
      policyVersion,
    });
  }

  usedIds.add(draftPolicy.policyId);

  return {
    templatePolicyId,
    sourceTopicId,
    sourceSchemaName,
    tokenId,
    policyId: draftPolicy.policyId,
    topicId: draftPolicy.topicId,
    policyName: createdPolicyName,
    schemaName: createdSchemaName,
    schemaUri,
    policyVersion,
    publishRole,
    duplicateCount,
    created: true,
  };
}

async function runGuardianPolicyStationFlow(input = {}) {
  const stationName = String(
    input.stationName || input.station_name || input.name || '',
  ).trim();
  if (!stationName) {
    throw new Error('stationName is required (or station_name/name)');
  }

  const requestedCarbonTemplatePolicyId = String(
    input.carbonTemplatePolicyId || '',
  ).trim();
  const requestedWipeTemplatePolicyId = String(
    input.wipeTemplatePolicyId || '',
  ).trim();
  if (
    requestedCarbonTemplatePolicyId &&
    requestedCarbonTemplatePolicyId !== DEFAULT_CARBON_TEMPLATE_POLICY_ID
  ) {
    throw new Error(
      `carbonTemplatePolicyId must be ${DEFAULT_CARBON_TEMPLATE_POLICY_ID}`,
    );
  }
  if (
    requestedWipeTemplatePolicyId &&
    requestedWipeTemplatePolicyId !== DEFAULT_WIPE_TEMPLATE_POLICY_ID
  ) {
    throw new Error(
      `wipeTemplatePolicyId must be ${DEFAULT_WIPE_TEMPLATE_POLICY_ID}`,
    );
  }

  const carbonTemplatePolicyId = DEFAULT_CARBON_TEMPLATE_POLICY_ID;
  const wipeTemplatePolicyId = DEFAULT_WIPE_TEMPLATE_POLICY_ID;
  const policyVersion = String(
    input.policyVersion || DEFAULT_POLICY_VERSION,
  ).trim();
  if (!carbonTemplatePolicyId) {
    throw new Error('carbonTemplatePolicyId is required');
  }
  if (!wipeTemplatePolicyId) {
    throw new Error('wipeTemplatePolicyId is required');
  }
  if (!policyVersion) {
    throw new Error('policyVersion is required');
  }
  const rawSecondPolicyDelayMs = Number(input.secondPolicyDelayMs);
  const secondPolicyDelayMs = Number.isFinite(rawSecondPolicyDelayMs)
    ? Math.max(0, Math.trunc(rawSecondPolicyDelayMs))
    : 10000;
  const usedPolicyIds = new Set();
  const copiedTemplatePolicyIds = new Set();

  const carbonOffsetPolicy = await runSinglePolicyFlow({
    stationName,
    templatePolicyId: carbonTemplatePolicyId,
    policyNameSuffix: 'Carbon Offset',
    schemaNameSuffix: 'Carbon Offset',
    publishRole: 'admin',
    policyVersion,
    kind: 'carbon',
    usedPolicyIds,
    copiedTemplatePolicyIds,
  });

  // Guardian can lag under sequential policy operations; pause before second policy.
  if (secondPolicyDelayMs > 0) {
    await sleep(secondPolicyDelayMs);
  }

  const wipeTokenPolicy = await runSinglePolicyFlow({
    stationName,
    templatePolicyId: wipeTemplatePolicyId,
    policyNameSuffix: 'Wipe Token',
    schemaNameSuffix: 'Wipe Token',
    publishRole: 'treasury',
    policyVersion,
    kind: 'wipe',
    usedPolicyIds,
    copiedTemplatePolicyIds,
  });

  return {
    stationName,
    policyVersion,
    secondPolicyDelayMs,
    templates: {
      carbonTemplatePolicyId,
      wipeTemplatePolicyId,
    },
    carbonOffsetPolicy,
    wipeTokenPolicy,
  };
}

module.exports = {
  runGuardianPolicyStationFlow,
};