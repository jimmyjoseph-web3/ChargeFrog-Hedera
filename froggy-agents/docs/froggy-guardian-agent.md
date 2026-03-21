# ChargeFrog: FroggyGuardian Agent

## Overview

ChargeFrog: FroggyGuardian is the public A2A coordinator agent for ChargeFrog’s Guardian-facing policy workflows. It handles station-specific Guardian policy enquiry, fully-invested station readiness checks, and the controlled policy-creation workflow for past ChargeFrog stations.

This document is written for the hosted agent surface only.

Hosted base URL:

- `https://froggyagents.online`

Canonical A2A endpoint:

- `POST https://froggyagents.online/a2a/froggy-guardian`

Canonical discovery endpoints:

- `GET https://froggyagents.online/.well-known/froggy-guardian-agent.json`
- `GET https://froggyagents.online/.well-known/froggy-guardian-agent-card.json`

## Purpose

ChargeFrog: FroggyGuardian provides a dedicated compliance and policy-oriented surface separated from the main planner agent.

It focuses on:

- Guardian policy enquiry
- policy summarization
- fully-invested station readiness checks
- controlled Guardian policy and schema creation initiation

Internally, ChargeFrog: FroggyGuardian coordinates worker agents over A2A. It uses Hedera Guardian for policy summarization, policy replication, and compliance-oriented station workflows.

## Supported Workflows

### 1. Policy enquiry

The agent can:

- locate Guardian policies associated with a station
- retrieve the full policy record
- summarize what the policy does in professional, technical language
- explain what the policy controls, tracks, and is intended to enable

Typical request:

- `show me the guardian policy for Madison Square Garden`

### 2. Fully-invested station readiness lookup

The agent can:

- list stations that are already fully-invested
- identify which ones are ready for policy and schema creation

Typical request:

- `what stations have been fully-invested`

### 3. Guardian policy and schema creation workflow

The agent can:

- resolve a fully-invested station from user intent
- map the station name internally to the correct station record
- strip the ChargeFrog station prefix where needed
- trigger the fixed Guardian station-policy workflow for template replication

Typical request:

- `create guardian policy and schema for Madison Square Garden New York`

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
      "messageId": "guardian-msg-1",
      "role": "user",
      "parts": [
        {
          "text": "show me the guardian policy for Madison Square Garden"
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

- `parts[0].text` is the human-readable Guardian reply
- `artifacts[0].parts[0].data` is the structured Guardian result
- `result.id` is the A2A task identifier

## Authentication And Identity

ChargeFrog: FroggyGuardian does not require `walletAddress` for normal policy enquiries.

Its primary identity dependency is station context:

- a station name in user text
- or a resolvable fully-invested station context for the creation workflow

## Guardrails And Scope

ChargeFrog: FroggyGuardian handles:

- station Guardian policy enquiries
- policy summaries
- fully-invested station readiness
- controlled Guardian policy and schema creation initiation

It does not handle:

- general investment chat
- token buying or issuing directly
- unrelated station discovery
- arbitrary off-domain questions

It is a policy and compliance workflow agent, not a general chat surface.

## Operational Dependencies

ChargeFrog: FroggyGuardian depends on:

- Hedera Guardian policy APIs
- Guardian schema APIs where relevant to creation workflows
- MongoDB station state, especially fully-invested station records
- the fixed Guardian policy replication workflow

The public A2A endpoint is a transport surface over internal coordinator and worker-agent logic. The underlying station-policy replication flow is deterministic and tool-driven.

## Example Requests

### Policy enquiry

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "guardian-msg-1",
      "role": "user",
      "parts": [
        {
          "text": "show me the guardian policy for Madison Square Garden"
        }
      ]
    }
  }
}
```

### List fully-invested stations

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "guardian-msg-2",
      "role": "user",
      "parts": [
        {
          "text": "what stations have been fully-invested"
        }
      ]
    }
  }
}
```

### Start Guardian policy creation

```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "guardian-msg-3",
      "role": "user",
      "parts": [
        {
          "text": "create guardian policy and schema for Madison Square Garden New York"
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
            "text": "I found 1 fully-invested station that is ready for Guardian policy and schema creation so the station can move closer to going live: ChargeFrog Station - Madison Square Garden New York (stationId 1)."
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
              "intent": "LIST_FULLY_INVESTED_STATIONS",
              "reply": "I found 1 fully-invested station that is ready for Guardian policy and schema creation so the station can move closer to going live: ChargeFrog Station - Madison Square Garden New York (stationId 1)."
            }
          }
        ]
      }
    ]
  }
}
```

## Registration Notes

This hosted guardian agent is intended to be registered with:

- `communicationProtocol: "a2a"`
- HOL as the primary fast-layer registry
- optional ERC-8004 linkage through `additionalRegistries`

The canonical hosted registration endpoint is:

- `https://froggyagents.online/a2a/froggy-guardian`
