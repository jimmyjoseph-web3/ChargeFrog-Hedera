# ChargeFrog: FroggyChat Agent

## Overview

ChargeFrog: FroggyChat is the public A2A routing agent for ChargeFrog. It accepts a ChargeFrog-domain chat request, classifies the intent, and routes the request to the correct hosted public agent.

This document is written for the hosted agent surface only.

Hosted base URL:

- `https://froggyagents.online`

Canonical A2A endpoint:

- `POST https://froggyagents.online/a2a/froggy-chat`

Canonical discovery endpoints:

- `GET https://froggyagents.online/.well-known/froggychat-agent.json`
- `GET https://froggyagents.online/.well-known/froggychat-agent-card.json`

## Purpose

ChargeFrog: FroggyChat is the public entrypoint for ChargeFrog multi-agent chat.

It routes incoming requests to one of the hosted public A2A agents:

- ChargeFrog: FroggyPlanner for station discovery, proposal creation, and investor-facing investment workflows
- ChargeFrog: FroggyFoundry for pending admin review, approval, deployment, and post-deployment issuance workflows
- ChargeFrog: FroggyGuardian for Guardian policy enquiry and policy creation workflows

It also leaves a routing trail in the structured result so callers can see which downstream A2A agent was selected and when the downstream A2A handoff started and finished.

## Supported Workflows

### 1. Investor and station workflows

ChargeFrog: FroggyChat can route investor-facing and planning requests to ChargeFrog: FroggyPlanner.

This includes:

- station opportunity discovery
- investment proposal generation
- investable station listing
- station investment choice prompts
- equity or bond investment execution
- token balance lookups

Typical requests:

- `Can you list any available stations for me to invest in?`
- `Find a station for proposal near Madison Square Garden`
- `I want to buy equity for station 1`

### 2. Admin review and deployment workflows

ChargeFrog: FroggyChat can route admin approval and deployment requests to ChargeFrog: FroggyFoundry.

This includes:

- pending admin action queue review
- proposal summarization for approval
- approval by `stationId`
- approval by `proposalId`
- deployment and post-deployment issuance workflows

Typical requests:

- `Which stations require my attention?`
- `Approve station 8`
- `Approve proposal proposal_1741856400000_abc123def4`

### 3. Guardian policy workflows

ChargeFrog: FroggyChat can route Guardian-related requests to ChargeFrog: FroggyGuardian.

This includes:

- station-specific Guardian policy enquiry
- listing fully-invested stations that are ready for Guardian workflows
- Guardian policy and schema creation flows

Typical requests:

- `Show me the guardian policy for Madison Square Garden`
- `What stations have been fully-invested?`
- `Create guardian policy and schema for Madison Square Garden New York`

### 4. Routing trail visibility

ChargeFrog: FroggyChat returns a routing trail in the structured result.

The trail can show:

- request receipt by ChargeFrog: FroggyChat
- route decision and selected downstream agent
- downstream A2A call start
- downstream A2A call completion
- downstream A2A call failure

This lets callers inspect which agent handled the request and whether the downstream handoff succeeded.

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

Optional fields:

- `params.message.metadata.walletAddress`

If `walletAddress` is provided, ChargeFrog: FroggyChat can forward it to the routed planner workflow when investor-facing station investment actions require wallet context.

Example:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "froggychat-msg-1",
      "role": "user",
      "parts": [
        {
          "text": "Which stations require my attention?"
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
- `result.artifacts[0].parts[0].data.trail`
- `result.id`

Interpretation:

- `parts[0].text` is the human-readable reply from the routed downstream agent
- `artifacts[0].parts[0].data` is the structured routed result
- `artifacts[0].parts[0].data.trail` is the ChargeFrog: FroggyChat routing and A2A handoff trail
- `result.id` is the A2A task identifier

## Authentication And Identity

ChargeFrog: FroggyChat does not require a wallet address for normal routing.

It does not directly deploy contracts, issue tokens, or create Guardian policies itself. It routes to the appropriate hosted agent for that workflow.

Optional identity context:

- `walletAddress` may be supplied for planner-side investor workflows
- admin-signing remains a server-side task of ChargeFrog: FroggyFoundry
- Guardian execution context remains a server-side task of ChargeFrog: FroggyGuardian

## Guardrails And Scope

ChargeFrog: FroggyChat handles ChargeFrog workflow routing for:

- station discovery and investor chat
- pending admin action and approval flows
- Guardian policy and schema flows

It does not handle:

- unrelated general-purpose chat
- arbitrary off-domain questions
- direct execution of deployment or issuance logic by itself
- direct execution of Guardian policy logic by itself

It is a routing and handoff agent, not the final business-logic worker for every action.

## Operational Dependencies

ChargeFrog: FroggyChat depends on:

- ChargeFrog: FroggyPlanner public A2A endpoint
- ChargeFrog: FroggyFoundry public A2A endpoint
- ChargeFrog: FroggyGuardian public A2A endpoint
- public-base A2A routing in production, or localhost A2A routing in development
- the downstream systems and databases used by whichever agent is selected

The public A2A endpoint is a routing surface over downstream A2A delegation logic. In production, ChargeFrog: FroggyChat calls the routed public agent through the configured public base URL. In development, it uses localhost for the same A2A endpoint path. The downstream business workflow is executed by the routed agent, not by the HTTP route itself.

## Example Requests

### Route to ChargeFrog: FroggyPlanner

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "froggychat-msg-1",
      "role": "user",
      "parts": [
        {
          "text": "Can you list any available stations for me to invest in?"
        }
      ],
      "metadata": {
        "walletAddress": "0.0.xxxxxxxx"
      }
    }
  }
}
```

### Route to ChargeFrog: FroggyFoundry

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "froggychat-msg-2",
      "role": "user",
      "parts": [
        {
          "text": "Which stations require my attention?"
        }
      ]
    }
  }
}
```

### Route to ChargeFrog: FroggyGuardian

```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "froggychat-msg-3",
      "role": "user",
      "parts": [
        {
          "text": "Show me the guardian policy for Madison Square Garden"
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

### Structured artifact with routing trail

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
              "routedAgentKey": "foundry",
              "routedAgentName": "FroggyFoundry",
              "routedAgentEndpoint": "/a2a/froggy-foundry",
              "routeReason": "foundry_intent",
              "reply": "The station requiring your attention is station 8 (ChargeFrog Station - Madison Square Garden) proposal proposal_1741856400000_abc123def4.",
              "trail": [
                {
                  "stage": "received",
                  "agentKey": "froggychat",
                  "agentName": "FroggyChat",
                  "endpointPath": "/a2a/froggy-chat",
                  "message": "Which stations require my attention?",
                  "success": true
                },
                {
                  "stage": "routed",
                  "agentKey": "foundry",
                  "agentName": "FroggyFoundry",
                  "endpointPath": "/a2a/froggy-foundry",
                  "reason": "foundry_intent",
                  "success": true
                },
                {
                  "stage": "a2a_call_started",
                  "transport": "a2a_http_external",
                  "callerAgentKey": "froggychat",
                  "callerAgentName": "FroggyChat",
                  "callerEndpointPath": "/a2a/froggy-chat",
                  "calleeAgentKey": "foundry",
                  "calleeAgentName": "FroggyFoundry",
                  "calleeEndpointPath": "/a2a/froggy-foundry",
                  "message": "Which stations require my attention?",
                  "success": true
                },
                {
                  "stage": "a2a_call_completed",
                  "transport": "a2a_http_external",
                  "callerAgentKey": "froggychat",
                  "callerAgentName": "FroggyChat",
                  "callerEndpointPath": "/a2a/froggy-chat",
                  "calleeAgentKey": "foundry",
                  "calleeAgentName": "FroggyFoundry",
                  "calleeEndpointPath": "/a2a/froggy-foundry",
                  "status": "pending_admin_action_queue",
                  "success": true,
                  "durationMs": 309
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

This hosted ChargeFrog: FroggyChat agent is intended to be registered with:

- `communicationProtocol: "a2a"`
- HOL as the primary fast-layer registry
- optional ERC-8004 linkage through `additionalRegistries`

For HOL and Registry Broker registration, the canonical hosted discovery URL is:

- `https://froggyagents.online/.well-known/froggychat-agent.json`

The canonical hosted live service endpoint advertised by that discovery document is:

- `https://froggyagents.online/a2a/froggy-chat`
