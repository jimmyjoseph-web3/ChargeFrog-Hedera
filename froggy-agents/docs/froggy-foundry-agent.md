# ChargeFrog: FroggyFoundry Agent

## Overview

ChargeFrog: FroggyFoundry is the public A2A admin agent for ChargeFrog. It handles pending station review, admin approval of station deployment, and post-deployment equity and bond token creation workflows.

This document is written for the hosted agent surface only.

Hosted base URL:

- `https://froggyagents.online`

Canonical A2A endpoint:

- `POST https://froggyagents.online/a2a/froggy-foundry`

Canonical discovery endpoints:

- `GET https://froggyagents.online/.well-known/froggy-foundry-agent.json`
- `GET https://froggyagents.online/.well-known/froggy-foundry-agent-card.json`

## Purpose

ChargeFrog: FroggyFoundry turns ChargeFrog admin review and approval requests into concrete station deployment and token creation workflows.

It is the public-facing foundry agent for:

- pending station review
- proposal summarization for admin approval
- station deployment approval
- station contract deployment orchestration
- post-deployment equity and bond token creation

Internally, ChargeFrog: FroggyFoundry coordinates deployment and issuance worker flows over A2A. It uses ChargeFrog contract deployment logic plus the Hedera Asset Tokenization SDK-backed issuance flow after station deployment completes.

## Supported Workflows

### 1. Station review

The agent can:

- list stations that are pending admin action
- summarize the pending proposal for each station
- surface stationId, proposalId, and key proposal terms
- ask for approval before deployment and issuance

Typical request:

- `which stations require my attention?`

### 2. Station approval and deployment orchestration

The agent can:

- resolve the pending station by `stationId`
- resolve the pending station by `proposalId`
- resolve the pending station by ChargeFrog station name
- deploy the station bundle through the ChargeFrog contract flow
- persist deployment metadata after successful deployment

Typical requests:

- `approve station 8`
- `approve proposal <proposalId>`

### 3. Post-deployment equity and bond issuance

The agent can:

- trigger the station asset issuer after deployment
- create the equity token
- create the bond token
- persist issued asset records for the deployed station

Typical request:

- `deploy and issue the pending station for proposal <proposalId>`

## A2A Input Format

The endpoint expects A2A JSON-RPC `2.0` requests using either:

- `message/send`
- `tasks/get`

### `message/send`

Required fields:

- `jsonrpc`
- `id`
- `method`
- `params.message.role`
- `params.message.parts`

Example:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "foundry-msg-1",
      "role": "user",
      "parts": [
        {
          "text": "which stations require my attention?"
        }
      ]
    }
  }
}
```

### `tasks/get`

Example:

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tasks/get",
  "params": {
    "id": "task-id-from-message-send"
  }
}
```

## A2A Output Format

The endpoint returns a task object.

Important fields:

- `result.status.message.parts[0].text`
- `result.artifacts[0].parts[0].data`
- `result.id`

Interpretation:

- `parts[0].text` is the human-readable foundry answer
- `artifacts[0].parts[0].data` is the structured foundry result
- `result.id` is the A2A task identifier

## Authentication And Identity

ChargeFrog: FroggyFoundry does not accept `walletAddress` for normal operation.

It uses the configured admin signer and private key on the server side for deployment and issuance workflows.

Its primary identity dependency is station and proposal context:

- a pending `proposalId`
- a pending `stationId`
- or a resolvable pending ChargeFrog station name

## Guardrails And Scope

ChargeFrog: FroggyFoundry handles:

- station review
- pending admin action queues
- proposal summarization for approval
- station deployment approval
- deployment orchestration
- post-deployment equity and bond token creation

It does not handle:

- general investor chat
- equity or bond purchases
- token balance lookups
- unrelated station discovery
- arbitrary off-domain questions

It is an admin deployment and issuance workflow agent, not an investor-facing chat surface.

## Operational Dependencies

ChargeFrog: FroggyFoundry depends on:

- MongoDB for station and proposal state
- ChargeFrog Registry, Bolt, Station, and Shares contract artifacts and deployment logic
- an admin private key plus RPC access for deployment transactions
- stored proposal metadata for review summaries
- the post-deployment station asset issuer flow for token creation
- Hedera Asset Tokenization SDK-backed issuance tools for equity and bond creation

The public A2A endpoint is a transport surface over internal coordinator and worker-agent logic. The deployment and issuance workflows are not implemented in the HTTP route itself.

## Example Requests

### Review pending stations

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "foundry-msg-1",
      "role": "user",
      "parts": [
        {
          "text": "which stations require my attention?"
        }
      ]
    }
  }
}
```

### Approve by station ID

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "foundry-msg-2",
      "role": "user",
      "parts": [
        {
          "text": "approve station 8"
        }
      ]
    }
  }
}
```

### Approve by proposal ID

```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "foundry-msg-3",
      "role": "user",
      "parts": [
        {
          "text": "approve proposal proposal_1741856400000_abc123def4"
        }
      ]
    }
  }
}
```

## Example Response Fragments

### Human-readable reply

```json
{
  "result": {
    "status": {
      "message": {
        "parts": [
          {
            "kind": "text",
            "text": "The station requiring your attention is station 8 (ChargeFrog Station - Madison Square Garden) proposal proposal_1741856400000_abc123def4. title: Madison Square Garden station proposal. target 2500000 HBAR, 1000 equity shares, 1000 bond units. summary: Proposed station for a high-demand Manhattan charging corridor. would you like to approve this station, this would mean deployment on hedera testnet through the chargefrog contracts, and the creation of equity and bond stations"
          }
        ]
      }
    }
  }
}
```

### Structured artifact

```json
{
  "result": {
    "artifacts": [
      {
        "parts": [
          {
            "kind": "data",
            "data": {
              "status": "pending_admin_action_queue",
              "reply": "The station requiring your attention is station 8 (ChargeFrog Station - Madison Square Garden) proposal proposal_1741856400000_abc123def4.",
              "stations": [
                {
                  "stationId": 8,
                  "stationName": "ChargeFrog Station - Madison Square Garden",
                  "stage": "pending-admin-action",
                  "proposalId": "proposal_1741856400000_abc123def4",
                  "reviewSummary": "station 8 (ChargeFrog Station - Madison Square Garden) proposal proposal_1741856400000_abc123def4. title: Madison Square Garden station proposal. target 2500000 HBAR, 1000 equity shares, 1000 bond units."
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

## Registration Notes

This hosted foundry agent is intended to be registered with:

- `communicationProtocol: "a2a"`
- HOL as the primary fast-layer registry
- optional ERC-8004 linkage through `additionalRegistries`

The canonical hosted registration endpoint is:

- `https://froggyagents.online/a2a/froggy-foundry`
