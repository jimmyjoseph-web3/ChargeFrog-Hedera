<div align="center">
    <img src="https://github.com/user-attachments/assets/8397eba5-dbe5-441c-8f02-e9b71ebbc2f2" width=200>
    <h1>ChargeFrog</h1>
    <strong>A community-powered, agent-driven platform for financing and deploying EV charging infrastructure</strong>
</div>

<p align="center">
  <img src="https://github.com/user-attachments/assets/676d6e72-a57a-4d25-a5ab-89dda22a828b" width="3690" height="427" alt="Image" />
</p>

## 🐸 Our Deliverables

1. Our Demo Video (Youtube) [🌐Watch It!]()

2. Our Pitch Deck (PDF) [🌐Read It!]()

3. Our Demo DApp (Deployed on Hedera Testnet) [🌐Try It!]()

## TL;DR 👉 What is ChargeFrog?

ChargeFrog fixes two broken systems at once: Europe needs more EV chargers, and carbon markets need real proof. We turn EV stations into community-owned, compliant on-chain assets on Hedera, then use a Froggy multi-agent workflow to take a station from demand signal to deployment: `FroggyPlanner` validates neighborhood demand with mini-node registrations and charging data, drafts the investment proposal, `FroggyFoundry` handles approval, deployment, and ERC-1400/ERC-3643 Reg-S equity and bond issuance, and `FroggyGuardian` creates the policy-driven dMRV flow that proves carbon impact on-chain. The result is a single Super App where people can propose, fund, own, use, and audit EV infrastructure end-to-end.

### What’s New

- **Agentic infrastructure rollout:** ChargeFrog is not just tokenizing chargers, it is automating the full station lifecycle through public A2A-ready agents.
- **Demand before deployment:** New stations are proposed from real community demand signals, neighborhood interest thresholds, POI evidence, and charging availability data.
- **Compliance and carbon built in:** Every approved station can become a compliant investable asset, while every charging session can feed Guardian-backed CarbonFrog dMRV for verifiable CO₂ impact.

## What has Changed at the Product Level?

<img width="1763" height="991" alt="Image" src="https://github.com/user-attachments/assets/2be138b1-e1af-4726-b016-da5445b9167a" />

> **Old ChargeFrog** was mainly an on-chain EV infrastructure model.  
> **New ChargeFrog** is an agentic workflow product that can discover, structure, deploy, tokenize, and audit EV infrastructure end-to-end.

Instead of only proving that EV charging, tokenization, and carbon accounting can exist on-chain, ChargeFrog now turns those primitives into a usable product flow. The platform can move from **community demand** to **investment proposal**, from **proposal approval** to **station deployment and security token issuance**, and from **charging activity** to **station-specific Guardian compliance** through one connected workflow.

### From Protocol Primitives to Workflow Product

- **Froggy Agents are now the product surface.** `FroggyChat`, `FroggyPlanner`, `FroggyFoundry`, and `FroggyGuardian` turn ChargeFrog into hosted A2A-ready workflows for discovery, proposal generation, approval, issuance, and compliance.
- **Agentic site intelligence now drives network expansion.** Instead of manually guessing where to build, ChargeFrog uses mini-node demand registrations, neighborhood thresholds, POI discovery, geospatial reasoning, and charging availability data to identify high-conviction station opportunities.
- **Hedera asset tokenization is now lifecycle-native.** Once a proposal is approved, ChargeFrog can run a continuous flow for station deployment plus per-station equity and bond issuance using ATS-backed token workflows, making each charger an investable digital security asset.
- **Guardian is now operational at the station level.** Fully invested stations can trigger dedicated Guardian policy and schema creation, so carbon accounting is no longer abstract network-level reporting, it becomes a verifiable compliance layer tied to each real charging site.
- **ChargeFrog is now interoperable with agent ecosystems.** The Froggy agents expose public A2A endpoints, agent cards, and HOL Registry Broker compatibility, which makes ChargeFrog composable as an agent-powered infrastructure product rather than a closed demo app.

## 🌟 Proposing a Station (Old vs New)

https://github.com/user-attachments/assets/a1d06076-b3d7-40e7-b4c7-4c578093a50d

The original ChargeFrog flow introduced the idea of fractional EV charging investment, but the product experience was still relatively static. Users could browse opportunities, view proposal cards, and manually submit location suggestions, but much of the actual decision-making and progression still depended on separate admin action behind the scenes.

The new version transforms that experience into an agentic workflow.

Instead of relying on standalone UI screens and manual follow-up, users can now express investment intent conversationally. From there, the system can interpret the request, determine whether there is enough demand in a target area, and either record the interest or generate a proposal that moves forward for review. This makes the product feel less like a passive interface and more like an intelligent operating layer.

### Previous Experience

- Static investment and proposal screens
- Manual location submission flow
- Limited visibility into what happened after submission
- Heavier dependence on admin coordination
- Product validated the concept, but did not actively execute the workflow

### Improved Experience

- Conversational, intent-driven user flow
- Agent evaluates whether an area has sufficient investor interest
- Proposal creation becomes part of the product journey
- Clearer progression from user request to system action
- Product now participates in execution, not just presentation

## 🌟 Investing in a Station

https://github.com/user-attachments/assets/f615d89a-2ccc-465c-a129-d6013ba9c458

The original investment flow only supported **equity investment**. Users could select a station, confirm their purchase, and receive a success screen, but the experience was limited to a single asset path and did not expose much of the underlying execution logic.

The new version expands this into a more capable, agent-driven investment flow by giving **FroggyPlanner tooling access to the Hedera Asset Tokenization SDK**.

Instead of only handling equity purchases, FroggyPlanner can now understand investment intent, resolve the relevant station, and execute the correct tokenization flow for both **equity** and **bond** offerings. This turns the product from a fixed confirmation experience into a more flexible investment interface connected directly to real asset issuance workflows.

### Previous Experience

- Only supported **equity investment**
- Fixed, single-path purchase flow
- Limited visibility into how the investment was processed
- Token issuance flow remained mostly abstracted from the user
- Product experience ended at confirmation

### Improved Experience

- FroggyPlanner now has tooling capabilities powered by the **Hedera Asset Tokenization SDK**
- Supports both **equity** and **bond** investment flows
- Planner can interpret user intent and route to the correct asset flow
- Investment actions connect directly to minting and issuance workflows
- Product experience now reflects actual execution, not just final confirmation

## 🌟 Tokenization Flow

https://github.com/user-attachments/assets/94f67692-15cc-4bc1-91ac-c769392028f7

The original tokenization flow was heavily manual and mostly restricted to admin-only interfaces. Creating a new digital security token required filling out dedicated admin forms, while balance checks and approval actions were handled through separate operational panels. Although the system was functional, token creation, approval, and balance retrieval were still fragmented into manual backend workflows.

The new version turns these previously manual admin functions into conversational agent workflows powered by **FroggyPlanner** and **Hedera Asset Tokenization SDK tooling**.

Instead of relying on separate admin dashboards for token creation or balance retrieval, users and admins can now trigger these actions directly through natural-language requests. FroggyPlanner can resolve the relevant station and token context, retrieve **equity** or **bond** balances, and support admin-side operational actions that begin station deployment and digital asset creation with a single reply. This shifts token operations from isolated admin panels into a more accessible and workflow-driven product experience.

### Previous Experience

- Token balance lookup was primarily an **admin-only function**
- New digital security token creation required **manual form filling**
- Approval, balance, and tokenization actions were split across multiple admin views
- Operational flows were functional, but tedious and fragmented
- Most asset operations depended on manual admin interaction

### Improved Experience

- FroggyPlanner now exposes **token balance lookup** as a conversational workflow
- Supports checking both **equity** and **bond** token balances
- Admins can initiate station deployment and token creation through a single conversational flow
- Token operations are now connected more directly to **Hedera Asset Tokenization SDK** capabilities
- Product experience moves from manual admin tooling to agent-driven operational execution

## 🌟 Guardian Workflows

https://github.com/user-attachments/assets/4d8edc33-e226-4029-9ba4-934757994f94

The original Guardian workflow was heavily manual. Admins had to create new policies through the Guardian interface, manually create new schemas, and search through the dashboard to retrieve policy or schema information. While the system worked, policy management remained fragmented across multiple admin screens and required repeated operational effort for every new station.

The new version turns this into an agent-driven Guardian workflow.

Instead of manually creating and checking everything through the admin panel, **ChargeFrog Admin** can now trigger these flows conversationally. Once a station is ready, the system can identify eligible fully-invested stations, replicate the required **Guardian policies and schemas** for that station, and return verification output so admins can confirm that replication completed successfully. This shifts Guardian operations from manual setup into a more automated and repeatable workflow.

### Previous Experience

- Creating a new **policy** required manual admin work in Guardian
- Creating a new **schema** required manual admin work in Guardian
- Policy and schema information had to be retrieved manually from separate dashboards
- Admin workflows were repetitive and fragmented
- Operational scaling depended on manual Guardian setup for each station

### Improved Experience

- **ChargeFrog Admin** can trigger Guardian workflows conversationally
- System can identify stations that are ready for Guardian replication
- Policies and schemas can be **replicated** for a station through the new workflow
- Admins can **verify** that policy and schema replication completed successfully
- Guardian operations move from manual admin setup to a more automated, reusable process

## Tackling the Challenges of Real-World Asset Tokenization

### Most On-Chain RWAs Fail

<img width="1309" height="735" alt="Image" src="https://github.com/user-attachments/assets/5236a032-298c-440d-8953-e1e2786f7216" />

Most on-chain RWAs fail because they tokenize representation rather than enforceable rights. A token may be transferable on-chain, but the actual shareholder/bondholder rights—who is eligible, what they are entitled to, and how claims are enforced—remain off-chain, ambiguous, or manually administered. This breaks the full asset lifecycle: compliant issuance, identity-gated holding, jurisdiction-aware transfer validation, and deterministic entitlement calculation. Critically, corporate actions are rarely first-class: record dates, snapshots, distributions, redemptions, disclosures, and exceptional events (freezes, forced transfers, replacements, remediation) are often handled by ad-hoc scripts or centralized operators. The net effect is an “audit-after-the-fact” system with brittle controls, inconsistent standards, and high regulatory and counterparty risk—especially as regulators and market standards increasingly demand provable, policy-driven constraints rather than best-effort processes.

## Tackling the Problems of Europe's EV Market

### 1️⃣ The Imbalance Supply and Demand

Europe’s electric vehicle (EV) adoption is accelerating far faster than its charging infrastructure can keep up. In 2024, the region recorded approximately 8.8 million registered EVs, and by 2025 that number is projected to climb to 11.8 million, marking a 34% year-over-year increase. However, the expansion of charging infrastructure is lagging behind. Despite a 35% growth in charger installations, Europe will have only 1.09 million public and private chargers by 2025—nowhere near enough to support the rising volume of EVs on the road.

This mismatch is creating a widening structural gap: EV demand is scaling exponentially, while charging infrastructure grows linearly. At the current rate, the EU’s target of deploying 3.5 million chargers by 2030 appears increasingly unattainable. If this trend continues, Europe risks facing severe charging bottlenecks, slower EV adoption, and reduced consumer confidence—ultimately undermining its climate and mobility goals.

<img width="1309" height="726" alt="Image" src="https://github.com/user-attachments/assets/55ff1710-748f-45b6-9888-3f581b0fc84c" />

### 2️⃣ The Uneven Distributions

On top of the overall shortage, Europe’s charging infrastructure faces a serious distribution imbalance. The growth of chargers is not evenly spread across member states, creating regional accessibility gaps that worsen the EV charging deficit. A few countries dominate the network, while many others remain severely underserved.

For example, the Netherlands—home to just 17 million people—hosts more than 130,000 public chargers, accounting for over one-third of all public charging points in the EU. In stark contrast, Poland, with a significantly larger population, has only around 5,400 chargers, and Romania has just 2,700. These disparities illustrate that Europe’s EV charging challenge isn’t merely a shortage—it’s a distribution crisis.

This uneven deployment results in inconsistent charging access, discourages cross-border travel, and risks creating a multi-speed EV transition where progress is concentrated in a handful of countries. Without addressing both the quantity and geographic distribution of charging stations, Europe’s EV ecosystem will remain fragmented and insufficient to support the continent’s accelerating electrification.

<img width="1298" height="677" alt="Image" src="https://github.com/user-attachments/assets/01525db4-c1a4-456b-9160-23a6d44b3b12" />

### 3️⃣ High Barrier for EV Infra Investments

- **High upfront costs**: Deploying EV chargers—especially high-power DC fast chargers—requires significant capital. A 500 kW+ DC charging station can cost around €104,000, placing it well outside the reach of most individuals or small groups.

- **Limited financing options**: Traditional financing channels rarely accommodate small investors who wish to co-own or fractionalize charging infrastructure. Most funding flows toward established operators with strong balance sheets.

- **Capital-intensive market dynamics**: Because major charging networks require large-scale deployments, long-term power agreements, and ongoing maintenance, the market naturally gravitates toward big energy players.

- **Legal, regulatory, and technical barriers**: Navigating zoning rules, grid connection requirements, tariff structures, and compliance standards is complex. For citizens or small investors, these hurdles create a prohibitive entry barrier.

As a result, the EV charging landscape remains closed, centralized, and difficult for ordinary people to take part in, despite growing public interest in supporting green infrastructure. This disconnect slows innovation, limits community engagement, and prevents the creation of more distributed, community-driven charging networks. Without lowering these participation barriers, Europe risks missing a powerful opportunity for shared ownership, inclusive investment, and accelerated EV infrastructure growth.

## Tackling the Problems of the Carbon Market

### 1️⃣ Carbon Market Credibility Crisis

<p align="center">
  <img src="https://github.com/user-attachments/assets/926c4dfb-351d-4439-a803-38a0608940bf" width="500" alt="Image" />
</p>
The voluntary carbon market is growing, but its credibility is collapsing under scrutiny. Most offsets are considered “phantom” or of dubious quality; for example, roughly 94% of rainforest credits from a major certifier likely offered no real climate benefit, and 78% of the top 50 projects were judged “junk” or problematic. Failures include a lack of additionality, impermanence (like trees burning later), and double-counting of emission reductions. Consequently, companies fear every claimed carbon credit could be challenged.

- Systemic Distrust: High-profile analyses repeatedly find that a significant portion of carbon offsets fail to deliver their claimed environmental benefits. This pervasive skepticism undermines faith in the entire Voluntary Carbon Market (VCM), forcing even high-quality, genuine projects to defend their validity against a backdrop of industry-wide failures.

- The Digital MRV Gap: Current Monitoring, Reporting, and Verification (MRV) processes remain largely analog and retrospective. Third-party auditors often review data months or even years after the fact. Consequently, projects cannot instantly prove their impact. While positive environmental actions—such as renewable energy generation, carbon capture, or emissions avoidance—happen in real-time, legacy systems lack the infrastructure to immediately translate these events into unique, verifiable, on-chain carbon credits.

- Greenwashing Risk: Without immutable, cryptographic proof for every unit of impact, even earnest organizations risk being labeled as greenwashers. Regulators and consumers increasingly demand airtight Environmental, Social, and Governance (ESG) claims. Vague "carbon neutral" marketing has already triggered investigations and fines across various sectors. In this climate, any uncertainty regarding data provenance can be weaponized by competitors and critics alike.

- Audit Delays & Cost: Conventional verification is slow, labor-intensive, and expensive, providing stale, retrospective assurance rather than real-time confidence. This lag means that corporate sustainability reporting often trails actual operations by significant margins, creating a heavy administrative burden for finance and compliance teams trying to maintain up-to-date ESG records.

- Tokenization Hurdles: Without a unified digital ledger, carbon assets cannot be easily atomized or tokenized. This limitation prevents project developers from creating on-chain credits for specific impact events or retiring them in real-time. As a result, the market misses out on innovative financing models, increased liquidity, and the ability to create dynamic, incentive-based ecosystems.

## 💡 Motivation

Amid Europe’s accelerating EV adoption and persistent infrastructure gaps, there has never been a better moment to act. A powerful wave of EU policies and incentives is reshaping the landscape, creating ideal conditions for new, inclusive, and community-driven charging solutions like ChargeFrog.

Several major policy frameworks now serve as strong catalysts:

- **EU Green Deal** — The EU has committed to deploying 3.5 million public EV chargers by 2030, making large-scale charging expansion a central pillar of its climate agenda.

- **AFIR 2024 (Alternative Fuels Infrastructure Regulation)** — For the first time, the EU has introduced legally binding charger density mandates, including requirements for high-power charging every 60 km along major highways.

- **CEF–AFIF Funding** — Over €1 billion in grants is being directed toward building public fast-charging corridors across Europe’s core transport network, significantly lowering financial barriers for new operators.

- **Recast 2024: “Right to Plug”** — New rules simplify the installation of chargers in apartments, multi-unit buildings, and shared properties, empowering citizens and property owners to participate more easily.

- **LIFE Program Support** — EU funding is increasingly supporting citizen energy communities, enabling local groups, cooperatives, and neighborhoods to co-own renewable and charging infrastructure.

Together, these policies represent a rare alignment of political will, financial incentives, and regulatory clarity. They create a uniquely supportive environment for democratized, investor-friendly charging networks. ChargeFrog is positioned to ride this momentum, unlocking community participation, accelerating charger deployment, and helping Europe close its infrastructure gap before 2030.

## ChargeFrog: A New Operating Model on Hedera

<img width="1315" height="737" alt="Image" src="https://github.com/user-attachments/assets/e4fd7b1e-d16e-49f8-8613-238f13659f91" />

ChargeFrog introduces a community-led EV charging network model that is not just tokenized, but operationally agentic. Through `FroggyChat`, `FroggyPlanner`, `FroggyFoundry`, and `FroggyGuardian`, the product exposes public A2A workflows that can route natural-language requests across station discovery, proposal generation, deployment approval, asset issuance, and Guardian policy operations. What used to be fragmented admin work is now a connected product flow.

The network itself is fully on-chain on Hedera. Station ownership, revenue flow, equity activity, charging events, and governance are transparently recorded so the network can operate without gatekeepers or centralized monopolies. Each station can be formalized as a compliant digital security asset through per-station ERC-1400 & ERC-3643-compliant Reg-S equity and bond issuance, allowing the community to co-own real charging infrastructure with transparent asset histories.

ChargeFrog also introduces transparent charging economics through `$BOLT`, the network’s charging payment asset. `$BOLT` is used inside authorized ChargeFrog stations, making charging payments, station revenue flow, and investor distributions provable end-to-end. These assets are designed with utility as well: investors gain exposure not only to station revenue, but also to network perks and community-led expansion through the ability to propose and shape future station locations.

Digital security token holders receive multiple benefits:

- Revenue sharing from the stations they co-own

- Network perks, such as discounted charging

- Governance rights, including the ability to propose new station locations

> This transforms infrastructure growth into a community-driven expansion model, where investment, usage, and carbon impact are all transparently enforced on-chain empowering everyday individuals to co-invest, co-govern, and co-build Europe’s next generation of EV charging infrastructure.

## 🐸 We Pack Everything in Our All-in-One Super App

<img width="1130" height="1172" alt="Image" src="https://github.com/user-attachments/assets/8a122daa-3078-491f-a3bd-feffe531a207" />

At ChargeFrog, we have created a single Super App that unites EV charging, decentralized investment, and reward management. We built ChargeFrog on Hedera to be secure, transparent, and fully on-chain:

- Simplified Asset Management: Swap HBAR for Bolt charging credits, invest in ERC-1400 & ERC-3643 Compliant, Reg-S Station Equity tokens, claim your revenue share, and manage your profile—all in one place with verifiable on-chain records.

- Shaping the Network: Participate in the growth of our network by proposing new station locations and submitting them for the next investment round, empowering you to co-govern and co-build the network.

### ⚡️ A Unified Charging Experience

<p align="center">
  <img src="https://github.com/user-attachments/assets/01f57ab2-9286-44ba-8f3c-89ec04e469dd" width="424" height="686" alt="Image" />
</p>

We ensure charging your EV is smooth and simple:

- Finding Stations: We help you instantly Find the nearest ChargeFrog station with details on connector types (like 22kW AC and 100kW DC) and real-time availability.

### Buy & Spend

<img width="1486" height="829" alt="Image" src="https://github.com/user-attachments/assets/6d77b376-9bba-415f-a721-e8876e6b53d2" />

- Seamless Payments (Bolt Token): To pay, we facilitate an In-App Swap for Bolt credits. You can swap your HBAR tokens directly for Bolt credits (e.g., 1 HBAR=3 BOLT) to quickly start your charging session.

- On-Chain Tracking: We record your charging session on Hedera, providing a secure and verifiable transaction history.

### Invest in Upcoming Station Proposals

<img width="1309" height="735" alt="Image" src="https://github.com/user-attachments/assets/409c6b41-288b-43ca-8d84-b531e180aac5" />

Investment is now through a conversational, on-chain workflow with the help of FroggyPlanner. Instead of navigating fragmented admin screens or complex forms, users can discover investable station proposals, express investment intent in natural language, submit purchases in HBAR, and verify ownership directly on Hedera.

- **Conversational investment flow:** FroggyPlanner can surface the current investable station list, let users invest into a proposal like Prospect Park, and turn simple requests into structured purchase actions through the app.

- **Simple HBAR-to-share participation:** In the current demo flow, users can invest with a straightforward `1 HBAR = 1 share token` entry point, making early infrastructure ownership far more accessible to the community.

- **On-chain ownership and balance checks:** After investing, users can check their equity balances on Hedera, giving them transparent proof of how much of each station proposal they own.

- **Utility beyond ownership:** Station investors do not just hold a passive asset, they unlock network perks such as charging discounts while helping fund and shape ChargeFrog’s next station deployments.

### Claim (Revenue Distribution)

<img width="1481" height="831" alt="Image" src="https://github.com/user-attachments/assets/0bf0edd3-2614-49f3-9037-ffe2406a9be7" />

- Claiming Earnings: We make it easy to Claim your revenue distribution in one click. Your monthly payouts from your investments are transferred directly to your wallet in Hedera, fully tracked On-chain.

## The Architecture Behind ChargeFrog

<img width="1309" height="734" alt="Image" src="https://github.com/user-attachments/assets/b055aaed-2ec2-464b-9af5-4aa6e2f9a04c" />

ChargeFrog is no longer just a frontend connected to smart contracts. It is a multi-layer, agent-orchestrated system that connects natural-language workflows, public and internal A2A agents, smart-contract infrastructure, Hedera-native asset and compliance services, backend charging operations, and a real physical charging station pilot.

### ChargeFrog's A2A Routing Agent

`FroggyChat` is the public routing agent for ChargeFrog. It receives user or admin intent in natural language, classifies the request, and routes it to the correct public workflow agent. This is what turns the product from a static dApp into an agentic operating layer.

### Public A2A Agents

These are the hosted public agent surfaces exposed by ChargeFrog and wired into HOL Registry Broker workflows:

- **FroggyPlanner:** handles station discovery, proposal generation, investor purchases, and token balance lookups.
- **FroggyFoundry:** handles pending review, deployment approval, station deployment, and post-deployment asset issuance.
- **FroggyGuardian:** handles Guardian policy enquiry, readiness checks, and policy or schema creation workflows.

Together, these public agents make ChargeFrog interoperable as an A2A product surface rather than a closed application flow.

### Internal A2A Agents

Behind the public agents is a second layer of specialized worker agents that execute narrower tasks:

- **Station Finder:** evaluates area demand, charging evidence, and candidate locations.
- **Proposal Generator:** converts candidate station opportunities into structured investment proposals.
- **Station Asset Issuer:** creates station-linked equity and bond assets after approval and deployment.
- **Guardian Policy Summarizer:** retrieves and explains Guardian policy state for a station.
- **Guardian Policy Creator / Replicator:** creates or replicates station-specific Guardian policies and schemas for carbon and compliance workflows.

This split between public coordinators and internal workers keeps the product modular, auditable, and easier to scale.

### Smart Contract Layer

The smart-contract layer powers the economic core of the network:

- **Registry:** manages station registration and network state.
- **Shares:** represents station ownership and investor positions.
- **Bolt ERC-20 Token:** powers charging payments within the ChargeFrog network.
- **Station Contracts:** represent individual deployed charging stations and connect usage to revenue and ownership logic.

Users and admins access these flows through the ChargeFrog application, with wallet tooling such as HashScan and MetaMask bridging signing and transaction execution.

### Hedera Blockchain Layer

ChargeFrog uses Hedera-native services as the trust and compliance backbone:

- **Hedera Asset Tokenization:** supports compliant per-station equity and bond issuance, along with investment and balance workflows.
- **Hedera Guardian:** manages station-specific policy logic, schema workflows, and the carbon-accounting trail tied to charging activity.

This is the immutable layer that anchors ownership, issuance, revenue, and carbon accountability.

### Backend Orchestration Layer

This layer handles the operational logic that sits between users, agents, and stations:

- **Map and Navigation:** geolocation, station discovery, and routing context.
- **Charging Workflow:** session initiation, status handling, and charging UX.
- **Perks System:** applies investor discounts and network benefits based on ownership state.

It gives ChargeFrog a usable real-world product layer while keeping trust-critical state on Hedera.

### Physical Layer

The physical layer is where the digital system meets real EV infrastructure:

- **Prototype Station Deployment:** the current PoC pilot station, Genesis.
- **EVSE Hardware:** the charger hardware used to deliver energy in the real world.
- **OCPP Controller:** the control layer that connects charging hardware events back into the ChargeFrog system.

This is what closes the loop: agent workflows can lead to station deployment, stations generate charging activity, and those real-world events feed back into ownership, payments, and Guardian-backed carbon records.

ChargeFrog incorporates dedicated ledgers for transparent and automated revenue distribution.

### Principle (Trustless Settlement)

Each charging station is a complete economic unit with its own dedicated **on-chain fund** (**Station Fund Ledger**) and **investor registry** (**Investor Ledger**). This ensures that revenue, shares, and payouts are isolated per station and fully transparent, without requiring off-chain reconciliation.

### Key Features (Ledger and Claim Logic)

- **Station Fund Ledger:** Tracks revenue accumulation in both **HBAR** and **ERC-20 Bolt** from charging sessions.
- **Investor Ledger:** Records current share holdings per investor.
- **Pro-Rata Claim Tracking:** Calculates an investor's entitled payout as a percentage of total accumulated revenue based on their equity ownership.
- **Withdraw and Settlement:** Investors can claim their proportional share of HBAR and Bolt directly to their wallets.
- **Verifiable Revenue Claim:** Every payout is recorded on-chain, providing transparent, auditable proof of the transaction.

### Flow (Automated Distribution)

1. **EV Drivers** pay for charging using **HBAR** or **Bolt ERC-20**, which is credited to the **Station Fund Ledger**.
2. **Investors** hold **ERC-1400/ERC-3643 Compliant Station Equity Tokens** recorded in the **Investor Ledger**.
3. Investors submit a **Claim** request.
4. The system calculates their pro-rata share and initiates a **payout** in HBAR and/or Bolt directly to their wallet.

## Agent Overview: FroggyChat

<img width="1309" height="734" alt="Image" src="https://github.com/user-attachments/assets/07b99300-8a0d-43ef-87ae-03b51913a9aa" />

FroggyChat is ChargeFrog’s public A2A entry point. It accepts ChargeFrog requests in natural language, understands the user’s intent, and routes the request to the correct public workflow agent. This makes it the conversational control layer for the product, connecting users and admins to the right operational flow without forcing them to understand the internal system architecture.

### Communication Protocol

- **Protocol:** A2A
- **Role:** Public routing agent for ChargeFrog workflows
- **Function:** Intent classification, downstream agent selection, and workflow handoff

### Intent Routing

FroggyChat routes requests based on what the caller is trying to do:

- **Investment / finding a station:** routed to **FroggyPlanner**
- **Admin deployment or issuance actions:** routed to **FroggyFoundry**
- **Guardian-related actions:** routed to **FroggyGuardian**

This means a user can simply ask in natural language, while FroggyChat handles the routing logic behind the scenes.

### Core Capabilities

- **Knowledge retrieval and reasoning:** interprets ChargeFrog-specific requests and determines the right workflow path.
- **Data integration and visualization:** connects user intent to structured downstream agent results.
- **Multi-agent coordination:** acts as the handoff layer between the caller and ChargeFrog’s public A2A agents.
- **API integration and orchestration:** calls the correct public A2A endpoint for planner, foundry, or guardian workflows.
- **Workflow automation:** turns a chat request into a routed, executable ChargeFrog workflow.

### Why It Matters

Without FroggyChat, users and admins would need to know exactly which agent or endpoint to call for each task. With FroggyChat, ChargeFrog behaves like a single intelligent product surface: users ask, FroggyChat routes, and the correct public agent executes the workflow.

## Agent Overview: FroggyPlanner

<img width="1312" height="732" alt="Image" src="https://github.com/user-attachments/assets/b06628f2-8420-437d-8926-5132c1990fbc" />

FroggyPlanner is ChargeFrog’s public A2A coordinator for station opportunity discovery, investment proposal orchestration, and investor-facing station workflows. It turns user intent into structured EV infrastructure actions, combining geospatial discovery, proposal generation, tokenized investment flows, and on-chain balance retrieval in one planner surface powered by the Hedera Asset Tokenization SDK.

### Communication Protocol

- **Protocol:** A2A
- **Role:** Public planner and investment workflow coordinator
- **Function:** Discover station opportunities, generate proposals, present investment options, execute asset purchases, and retrieve token balances

### Core Capabilities

- **Station discovery based on mini-nodes:** evaluates community demand, neighborhood thresholds, and charging evidence to identify viable station opportunities.
- **Proposal generation engine:** coordinates internal worker agents and tool calls to turn a candidate location into a structured investment proposal.
- **Investment flow coordination:** surfaces available stations, presents investment choices, and routes the user into the correct equity or bond workflow.
- **Asset purchase and balance lookup:** connects planner-side investment requests to Hedera Asset Tokenization SDK-backed purchase execution and station-linked token balance retrieval.
- **Scalable EV planning:** lets ChargeFrog move from ad-hoc site selection to repeatable, evidence-based expansion planning.

### Workflow Orchestration

FroggyPlanner coordinates both internal A2A workers and predefined tools:

- **TomTom API + Station Finder:** resolve areas, evaluate nearby charging evidence, and identify candidate station locations.
- **Proposal Generator:** builds proposal payloads, metadata, and investment rationale for a new station opportunity.
- **On-chain + IPFS proposal publishing:** persists proposal context so it can move into approval and deployment workflows.
- **FroggyFoundry handoff:** once a proposal is ready for admin action, deployment and token creation are handed off to FroggyFoundry.
- **Proposal lookup + investable stations:** helps users find active station proposals that are open for investment.
- **Hedera Asset Tokenization SDK:** powers purchase execution and balance lookup for station-linked equity and bond assets.

### User Intent Flows

FroggyPlanner supports the main investor and planning intents inside ChargeFrog:

- **Opportunity discovery:** “find a station for proposal near X”
- **Investment options:** “what stations are available right now?”
- **Asset purchase:** “give me 10 equity tokens for this station”
- **Balance lookup:** “what is my equity balance for station 1?”

In practice, this means the same agent can help identify where the network should expand, package that opportunity into an investable proposal, and then let users buy into the station and verify their holdings on Hedera.

### Why It Matters

Without FroggyPlanner, discovery, proposal writing, token purchase, and balance retrieval would live in separate tools and admin-heavy flows. With FroggyPlanner, ChargeFrog gets a single planner surface that connects site intelligence, proposal orchestration, and tokenized station investment into one conversational product experience.

## Agent Overview: FroggyFoundry

<img width="1308" height="735" alt="Image" src="https://github.com/user-attachments/assets/0bfe85e4-c0c5-4f08-8ce7-2b2f318f2480" />

FroggyFoundry is ChargeFrog’s public A2A admin agent for turning approved station proposals into live infrastructure and issued digital assets. It handles the admin side of the station lifecycle: reviewing pending stations, resolving approvals, deploying station contracts on ChargeFrog testnet, and orchestrating equity and bond token creation through the Hedera Asset Tokenization SDK.

### Communication Protocol

- **Protocol:** A2A
- **Role:** Public admin deployment and issuance coordinator
- **Function:** Review pending stations, approve deployment, execute station deployment, and create station-linked security tokens

### Core Capabilities

- **Pending approval review:** lists stations that are waiting for admin action and summarizes the relevant proposal context.
- **Approval resolution:** allows admins to approve a pending station using a `stationId`, `proposalId`, or resolvable station name.
- **Station deployment execution:** runs the deployment flow for the approved station bundle on ChargeFrog testnet and persists the resulting deployment metadata.
- **Asset issuance automation:** triggers the internal station asset issuer to create both equity and bond tokens for the deployed station.
- **Admin workflow coordination:** connects queue review, deployment, issuance, and post-deployment records into one admin-facing workflow.

### Workflow Orchestration

FroggyFoundry coordinates internal A2A workers and predefined deployment or issuance tools:

- **Queue lookup + pending stations:** identifies which proposals are waiting for admin action.
- **Approval resolution:** maps admin intent to the correct pending station or proposal.
- **Deploy to ChargeFrog testnet:** executes station deployment using ChargeFrog contract deployment logic.
- **On-chain transaction hashes:** returns deployment transaction context so admins can verify execution.
- **Station Asset Issuer:** hands off to the internal issuance worker after deployment is complete.
- **Hedera Asset Tokenization SDK:** powers the creation of the station’s equity and bond tokens and records the on-chain issuance outputs.

### Admin Intent Flows

FroggyFoundry supports the main admin intents inside ChargeFrog:

- **Pending admin queue:** “which stations require my attention?”
- **Approval resolution:** “approve station 8” or “approve proposal <proposalId>”
- **Station deployment:** deploy the approved station bundle to ChargeFrog testnet
- **Security token creation:** issue the station’s equity and bond assets after deployment

In practice, this means admin users no longer need to move across disconnected dashboards to review, approve, deploy, and issue. FroggyFoundry turns those actions into one coordinated workflow.

### Why It Matters

Without FroggyFoundry, station deployment and token issuance remain fragmented backend operations. With FroggyFoundry, ChargeFrog gets a dedicated admin execution layer that converts approved proposals into deployed stations and on-chain security assets in a consistent, auditable workflow.

## Agent Overview: FroggyGuardian

<img width="1311" height="734" alt="Image" src="https://github.com/user-attachments/assets/74c99960-d6ae-406c-b32e-e279da801bd0" />

FroggyGuardian is ChargeFrog’s public A2A coordinator for station-specific Guardian policy enquiries and policy-creation workflows. It provides the compliance and verification surface of the product, coordinating internal worker agents and Hedera Guardian so admins can inspect station policies, summarize what those policies do, identify stations that are ready for Guardian workflows, and create or replicate the required policy and schema setup.

### Communication Protocol

- **Protocol:** A2A
- **Role:** Public Guardian policy and compliance workflow coordinator
- **Function:** Handle policy enquiry, policy summarization, station readiness checks, and controlled Guardian policy creation flows

### Core Capabilities

- **Policy discovery intelligence:** locates Guardian policies associated with a specific ChargeFrog station.
- **Station policy summaries:** retrieves and explains what a station’s Guardian policy controls, tracks, and enables.
- **Guardian policy creation:** initiates station-specific policy and schema creation or replication workflows for qualified stations.
- **Verified compliance workflows:** connects ChargeFrog station state to Guardian-backed carbon and compliance processes in a structured, auditable way.

### Workflow Orchestration

FroggyGuardian coordinates internal A2A workers and predefined Guardian tools:

- **List all Guardian policies:** discovers existing policy records that may relate to a station.
- **Match with station / policy name:** resolves the correct policy context from a station name or station record.
- **Guardian Policy Summarizer:** produces a full summary of the relevant policy and associated schema context.
- **Guardian Policy Replicator:** triggers the controlled creation or replication workflow for station-specific policy setup.
- **Origin policy and schema lookup:** finds the source carbon-offset and token-retire policies and schemas used as templates.
- **Create and publish workflow:** creates a new policy based on those origins, then publishes it with on-chain transaction outputs and Guardian role context.

### Admin Intent Flows

FroggyGuardian supports the main Guardian-oriented intents inside ChargeFrog:

- **Policy creation:** create Guardian policy and schema flows for a fully-invested station
- **Policy enquiry:** inspect the Guardian policy for a specific station
- **Policy summarization:** return a readable summary of the policy and schema state
- **Station readiness:** determine which fully-invested stations are ready for Guardian workflows

In practice, this means admins no longer have to manually navigate Guardian dashboards to inspect, compare, or recreate policy infrastructure for each station.

### Why It Matters

Without FroggyGuardian, policy inspection and replication remain manual compliance tasks buried inside Guardian’s admin workflows. With FroggyGuardian, ChargeFrog gets a dedicated agent surface for policy intelligence, replication, and verifiable compliance operations tied directly to real stations in the network.

## 🕵🏻 Auditing ChargeFrog on Hedera with Guardian

<p align="center">
  <img src="https://github.com/user-attachments/assets/f05f5e1a-4c59-428a-8399-909aab56224b" width="677" height="688" alt="Image" />
</p

ChargeFrog directly addresses the Voluntary Carbon Market (VCM) credibility crisis, where traditional "analog" Monitoring, Reporting, and Verification (MRV) processes are often retrospective, slow, and opaque. This lack of transparency makes genuine green claims vulnerable to "greenwashing" allegations and investor skepticism.

To solve this, **ChargeFrog leverages the Hedera Guardian platform** to implement a **Digital MRV (dMRV) system**. This creates a high-trust, automated environment where every charging session contributes to a full carbon accountability cycle: emissions are tracked, verified, and offset in real-time using immutable data.

### The Automated Carbon Lifecycle

The system operates through two distinct, policy-driven scenarios that generate an immutable audit trail via **Verifiable Credentials (VC)** and **Verifiable Presentations (VP)**.

### 1. Mint Scenario: Real-Time Accumulation

As users charge their EVs, the system tracks carbon offsets at a granular level.

- **The Trigger:** For every **100g of CO2 offset** via physical charging, the system triggers the Carbon Offset Policy.
- **The Action:** The policy automatically **mints a unique "CarbonFrog" NFT**.
- **The Flow:** This NFT is transferred from the ChargeFrog Treasury to a designated Admin account.
- **The Proof:** Simultaneously, a **VC-VP pair is generated on-chain**, linking the digital token directly to the physical charging data, proving the offset is real and unique.

### 2. Retire Scenario: Cyclical Finality

To ensure offsets are not double-counted or resold, the system enforces a **retirement logic**.

- **The Trigger:** Once the accumulated offsets reach **1kg of CO2**, the Token Retire Policy is activated.
- **The Action:** The system executes a **Retire Scenario**, which "wipes" (burns) the CarbonFrog NFT from the ledger in 1kg increments.
- **The Audit:** This retirement action is **permanently recorded on the Hedera ledger**.

### Transparency & Verification

This architecture provides an **irreversible proof of action**. By clicking on the generated Hashscan links within the ChargeFrog app, users and auditors can:

- View the Treasury’s operations in real-time
- Verify that a token was minted when a car was charged
- Confirm it was subsequently retired to finalize the offset

This eliminates the "black box" of traditional carbon credits, replacing it with a **transparent, on-chain history** that confirms high-integrity sustainability.

## 💳 Optimizing Charging Economics with BOLT (ERC-20 Token)

<p align="center">
  <img src="https://github.com/user-attachments/assets/d730a1d0-654f-4b01-aa77-0e119ee6aab2" width="713" height="586" alt="Image" />
</p>

**Bolt** is an **ERC-20 token** that powers the ChargeFrog network’s on-chain charging economy, ensuring payments are traceable and revenue flows back to the stations’ investors.

### Bolt Functions (Protocol Enforcement)

- **Token for Payment:** The token is the sole accepted medium for charging services.
- **Track Spending:** All Bolt spent is recorded on-chain and linked to the relevant charging session.
- **Transfer to Station Funds:** Spent Bolt is automatically credited to the Station Fund, forming the basis for investor revenue distribution.

### Workflow (Atomic State Transition)

1.  **Users** **Swap** HBAR for **Bolt** via a transparent in-app smart contract call.
2.  **Users** initiate charging, causing **Bolt** to be **Spent** to the station's address.
3.  The **Station** receives the **ERC-20 Token** and the corresponding smart contract **Records Revenue** in Hedera, converting the utility payment into the investment asset payment within the **Station Fund**.
4.  The accumulated revenue in the **Station Fund** is then made available for **Claim Revenue Distribution** by **Investors**.

## 🗃️ Orchestrating Station Lifecycle and On-Chain Governance

<p align="center">
  <img src="https://github.com/user-attachments/assets/374018eb-dfd4-493f-aba7-afc07b55a76a" width="591" height="620" alt="Image" />
</p>

The registry smart contract functions as a highly secure, immutable data structure—the on-chain **Station Registry**—critical for asset management and governance.

### Purpose (Data Integrity)

It acts as the single source of truth for all stations, tracking investment rounds, funding progress, and network state, ensuring every station is a verifiably tokenized & ERC-3643 Reg-S Station Equity asset on Hedera.

### Key Functions (State Management)

- **Register New Stations:** Records each new station proposal and assigns a unique on-chain ID.
- **Track Funding Progress:** Maintains the current state of investment rounds and amount of HBAR received.
- **Update Station State:** Tracks lifecycle transitions (e.g., `Proposal` → `Funding` → `Operational`).
- **On-Chain Registry:** Maintains a canonical list of all stations for transparency and auditing.
- **Log Events:** Timestamped records of major state changes for investor and network visibility.

### Structure (Lookup Mechanism)

The **Station Registry** maps each unique Station ID to a structured record containing:

- **Investment Details:** Funding goals and HBAR contributions.
- **Shares Issued:** Quantity of **ERC-1400 & ERC-3643 compliant Station Equity** tokens minted for investors.
- **Funding Progress:** Percentage of the funding goal achieved.
- **Operational Status:** Current lifecycle state, determining when the station is active and generating revenue.

## 🌍 The Business: Our Vision and Strategy

### The Market Is Ready — And So Are the People

<img width="1488" height="488" alt="Image" src="https://github.com/user-attachments/assets/41427f00-762f-4e79-8041-a35a706e1130" />

We recognize that the rapidly accelerating shift to EVs is creating strong, consistent demand for public charging infrastructure. Our unique, decentralized solution empowers everyday citizens and local EV owners to not only use the charging infrastructure but to actively co-invest in it, fostering a true sense of community ownership and alignment.

### We Serve Three Critical Stakeholders:

- **EV Drivers: Network Users:** They rely on our public charging network and benefit from the lowest charging costs possible because they are part of the community.
- **Community Investors: Ownership Layer:** We cater to individuals who seek profit from infrastructure but lack the high capital access. We transform EV infrastructure into an open, fractional investment class on Hedera.
- **Partners: Expansion & Network Flywheel:** We align commercial incentives with environmental and community goals, ensuring that growth benefits every participant in the ecosystem.

### Market Opportunity:

We are targeting a **Total Addressable Market (TAM)** of €34 billion in Europe, with a focused **Serviceable Available Market (SAM)** of €5 billion in our initial deployment regions. Our initial goal is to capture an **SOM (Serviceable Obtainable Market)** of €20 million worth of stations operated on ChargeFrog.

## 🛡️ We Enable Something No Other Network Does

<p align="center">
  <img src="https://github.com/user-attachments/assets/567a33b7-895d-4005-bf84-c458a40528cf" width="741" height="616" alt="Image" />
</p

We are not merely building a charging network; we are initiating a global movement to democratize the ownership of future energy infrastructure.

### Our Core Differentiators:

- **New Ownership Model:** We introduce verifiable community ownership and direct governance influence over charging assets.
- **Fractional Investment through Tokenization:** By leveraging the Hedera Asset Tokenization SDK, we facilitate low-barrier, ERC-1400/3643 compliant micro-investment, making infrastructure investment accessible to everyone.
- **Fully On-Chain Charging Economics:** Transparency is absolute. All regulated fund pooling, revenue distribution, and transfers are executed and recorded immutably on the Hedera distributed ledger.
- **Community-Driven Scaling Flywheel:** The community actively proposes and funds new locations, creating an organic, self-sustaining mechanism for network expansion.

This model allows ChargeFrog to effectively bridge the gap between low-barrier investment and asset ownership, unlike capital-intensive Corporate Ownership models.

## 💸 Sustainability & Revenue Model

<img width="1404" height="737" alt="Image" src="https://github.com/user-attachments/assets/2cb8b6c7-2c20-4eb0-b64d-2fd3ffa5059c" />

We have established a multi-pronged revenue model to guarantee the platform’s sustainability and provide stable, recurring income for our investors:

- **Charging Fees:** Revenue generated from EV charging sessions is automatically pooled per station and shared among its token holders, providing a direct, usage-based income stream.
- **ChargeFrog Pro:** We offer a premium membership in the form of an **NFT** minted on Hedera, granting users tiered benefits such as discounted charging rates, priority station access, and exclusive membership perks.
- **Value-Added Services:** Stations are utilized as physical advertising hubs, offering localized business promotions, co-branding opportunities, and other partnered deals, monetizing the high foot traffic they generate.

### Platform Sustainability:

We ensure the long-term operation, development, and expansion of the platform by retaining a modest **5% fee** taken directly from the gross station revenue.

## 🚀 Our Early Go-To-Market Strategy

<p align="center">
  <img src="https://github.com/user-attachments/assets/c6cf72bb-612a-4aa3-8c99-0a8956702aa2" width="674" height="685" alt="Image" />
</p>

Our initial strategy focuses on demonstrating the efficacy of our community ownership model while ensuring a frictionless user experience.

- **Community Ownership Proof:** We aim to quickly prove that co-ownership of physical charging infrastructure is viable, empowering users to directly influence network growth.
- **Web3 UX Abstraction:** We prioritize a seamless onboarding experience onto Hedera, abstracting the underlying blockchain complexity so users can enjoy its benefits (speed, security, transparency) without a steep learning curve.
- **Early Revenue and Trust:** We generate verifiable real revenue from the initial pilot charging sessions and transparently redistribute it on Hedera, rapidly building community trust and market momentum.

### Launching Pilot Stations:

We are launching our first pilot stations with a strong emphasis on community involvement. We allow users to **propose new charging locations**. The locations that garner the most community support will proceed to the investment rounds and be funded by our decentralized investment pool.

## 🤝 Our Strategic Partners Ecosystem

<p align="center">
  <img src="https://github.com/user-attachments/assets/71d2924d-3019-458e-bb24-b53e8df14f96" width="521" height="538" alt="Image" />
</p>

We recognize the necessity of collaboration to achieve massive scale. We are building a robust ecosystem of strategic partners essential for rapid, smart, and sustainable expansion across Europe.

This ecosystem includes:

- Leading charging hardware providers (e.g., EVBox) and Charge Point Operators (CPOs) to guarantee reliable infrastructure deployment.
- High-value location partners (e.g., APCOA Parking, Q-Park, Fastned, IONITY, EnBW, Allego) for premium, high-utilization charging sites.

## 🎯 Our Milestones & Roadmap

### How we measure our success for the coming months? (Post-Hackathon KPIs)

<img width="1490" height="839" alt="Image" src="https://github.com/user-attachments/assets/eacfc440-0f4d-4723-8522-48883fde500c" />

We focus on three core metrics to validate our model and drive adoption:

1.  **Sustainable Revenue Cycle:** We aim to complete one full revenue distribution cycle per month (at least on Hedera Testnet in early phase) to prove the functional integrity of our on-chain economics.
2.  **Product Validation via Usage:** We must consistently gather structured feedback from beta testers to refine the UX, onboarding, and investment/charging flows.
3.  **Real Physical Adoption:** For our pilot stations, we are targeting **30 charging sessions per week at the pilot site** to demonstrate real-world physical usage.

## 🛣️ What's next in our developer roadmap?

<img width="1306" height="735" alt="Image" src="https://github.com/user-attachments/assets/4b93badd-e794-45ee-9ed4-178ddb0f1e6b" />

We have successfully completed the **MVP + Pilot on Hedera Testnet**, featuring a mobile-based EV charging super app with real-life pilot station integration. Our next steps involve expanding functionality and preparing for mainnet launch:

### Shipped

- **MVP + Pilot on Hedera Testnet:** We have already shipped a mobile EV charging super app on Hedera testnet with real-world pilot station integration and compliant asset tokenization.
- **Introduce Agentic AI:** We have introduced public A2A agents registered on HOL Registry, expanding ChargeFrog with agentic planning, deployment, issuance, and Guardian workflow capabilities on Hedera.

### Next Up

- **Testnet to Mainnet:** Mainnet deployment of ChargeFrog smart contracts, equity tokens, and Guardian policies.
- **Community Hardware Expansion:** Release the open-source **ChargeFrog Pi** EVSE controller build on Raspberry Pi to extend the network through community-operated hardware.

And more releases are coming soon.

## 🤝 The Minds Behind ChargeFrog

<p align="center">
  <img src="https://github.com/user-attachments/assets/7dba4048-c18d-4991-a149-67548d2ad910" width="556" height="559" alt="Image" />
</p>
