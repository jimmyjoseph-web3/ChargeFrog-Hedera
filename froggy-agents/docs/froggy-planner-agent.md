# FroggyPlanner Agent

## Overview

FroggyPlanner is the public A2A coordinator agent for ChargeFrog. It handles station opportunity discovery, investment proposal orchestration, station asset issuance readiness, investor purchase flows, and token balance retrieval.

This document is written for the hosted agent surface only.

Hosted base URL:

- `https://froggyplanner.onrender.com`

Canonical A2A endpoint:

- `POST https://froggyplanner.onrender.com/a2a/froggy-planner`

Canonical discovery endpoints:

- `GET https://froggyplanner.onrender.com/.well-known/froggy-planner-agent.json`
- `GET https://froggyplanner.onrender.com/.well-known/froggy-planner-agent-card.json`

## Purpose

FroggyPlanner turns user or operator requests into concrete ChargeFrog station investment workflows.

It is the public-facing planner agent for:

- station opportunity discovery
- neighborhood demand and interest evaluation
- investment proposal generation
- station asset issuance orchestration
- investor station purchase flows
- equity and bond balance retrieval

Internally, FroggyPlanner coordinates worker agents over A2A. It also relies on the Hedera Asset Tokenization SDK for tokenization and asset issuance flows.

## Supported Workflows

### 1. Station opportunity discovery

The agent can:

- resolve a target area or coordinates
- register mini-node interest
- evaluate neighborhood interest thresholds
- inspect nearby POIs and charging evidence
- produce a recommended candidate station area

Typical request:

- `i want to invest near Madison Square Garden`

### 2. Investment proposal orchestration

The agent can:

- collect evidence for a proposed station
- build an investment proposal payload
- create a station investment proposal
- persist metadata and on-chain references

Typical request:

- `create an investment proposal near Madison Square Garden`

### 3. Station asset issuance readiness

The agent can:

- read proposal data
- generate ISINs
- create equity and bond tokens
- save issued asset records

Typical request:

- `issue assets for proposal <proposalId>`

### 4. Investor station actions

The agent can:

- list investable stations
- show investment choices
- execute equity purchases
- execute bond purchases
- mint and issue the corresponding token flow
- retrieve balances for station-linked equity or bond assets

Typical requests:

- `what stations are available right now?`
- `give me 10 equity tokens for the station ChargeFrog Station - Madison Square Garden`
- `what is my equity balance for station 1`

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
- `params.contextId`

Example:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "msg-1",
      "role": "user",
      "parts": [
        {
          "text": "what stations are available right now?"
        }
      ],
      "metadata": {
        "walletAddress": "0.0.xxxxxxxx"
      }
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

- `parts[0].text` is the human-readable answer
- `artifacts[0].parts[0].data` is the structured planner result
- `result.id` is the A2A task identifier

## Authentication And Identity

FroggyPlanner can operate in read-only scenarios without a wallet identifier, but wallet-linked investment actions require a Hedera account ID.

Expected wallet format:

- `0.0.xxxxxxxx`

The planner is intentionally Hedera-account oriented for identity in investment flows.

## Guardrails And Scope

FroggyPlanner handles:

- station investment
- station discovery and interest
- investment proposals
- asset issuance orchestration
- equity and bond purchase workflows
- token balance lookups

It does not handle:

- unrelated general chat
- arbitrary web assistant tasks
- non-ChargeFrog workflows outside the investment and station domain

## Operational Dependencies

FroggyPlanner depends on:

- OpenAI for selected classification and proposal drafting
- MongoDB for station, proposal, and issued asset records
- TomTom for area and reverse-geocode workflows
- Hedera Asset Tokenization SDK for token creation, minting, issuing, and balance lookup
- Pinata/IPFS for off-chain proposal metadata

The public A2A endpoint is a transport surface over internal coordinator and worker-agent logic. The business workflows are not implemented in the HTTP route itself.

## Example Requests

### List stations

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "msg-1",
      "role": "user",
      "parts": [
        {
          "text": "what stations are available right now?"
        }
      ]
    }
  }
}
```

### Buy equity

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "msg-2",
      "role": "user",
      "parts": [
        {
          "text": "give me 10 equity tokens for the station ChargeFrog Station - Madison Square Garden"
        }
      ],
      "metadata": {
        "walletAddress": "0.0.xxxxxxxx"
      }
    }
  }
}
```

### Check balance

```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "msg-3",
      "role": "user",
      "parts": [
        {
          "text": "what is my equity balance for station 1"
        }
      ],
      "metadata": {
        "walletAddress": "0.0.xxxxxxxx"
      }
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
            "text": "There are 1 investable station(s) right now."
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
              "intent": "LIST_AVAILABLE_STATIONS",
              "status": "listed",
              "reply": "There are 1 investable station(s) right now."
            }
          }
        ]
      }
    ]
  }
}
```

## Registration Notes

This hosted planner agent is intended to be registered with:

- `communicationProtocol: "a2a"`
- HOL as the primary fast-layer registry
- optional ERC-8004 linkage through `additionalRegistries`

The canonical hosted registration endpoint is:

- `https://froggyplanner.onrender.com/a2a/froggy-planner`
