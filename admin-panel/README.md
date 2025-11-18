<div align="center">

# ChargeFrog Admin Panel

[![License](https://img.shields.io/badge/license-apache2-blue.svg)](LICENSE)

</div>

## Introduction

The **ChargeFrog Admin Panel** is a web-based dashboard designed to manage and monitor **station equity and payouts**.  
It leverages the **Asset Tokenization Studio (ATS) Monorepo** for compliance, security, and license compliance, ensuring all functionality builds upon a robust, enterprise-grade foundation.

This admin panel allows:

- Monitoring and managing **station equity** across multiple EV stations.
- Executing **mass payouts** to investors or stakeholders.
- Assigning **roles and permissions** automatically.
- Interacting with **station equity diamond contracts** securely.

---

## Key Features

- **Station Equity Management**
  - Tracks total supply, max supply, and individual station equity.
  - Interacts with **diamond-pattern smart contracts** inherited from ATS.
  - Role-based access control for administrative and operational users.

- **Investor Request Integration**
  - Investor requests now interact directly with station equity contracts.
  - Ensures secure and auditable transactions.

- **License & Compliance**
  - Fully compliant with **Apache 2.0 license** via the ATS codebase.
  - Maintains attribution and notices as per ATS licensing.

- **Admin Panel Utilities**
  - Dashboard for viewing and managing stations, equity, and payouts.
  - Quick access to automated functions like ISIN generation, role assignment, and equity initialization.

---

## Installation & Setup

### Prerequisites

- Node.js v20.19.4 or newer
- npm v10.9.0 or newer
- PostgreSQL (for backend operations, if applicable)

### Quick Setup

From the project root:

```bash
# Install dependencies
npm ci
```
