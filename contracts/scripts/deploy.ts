import { network } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
// ----------------------------------------------------------
// Helpers for units (wei only)
// ----------------------------------------------------------
const ONE_HBAR_WEIBAR = 10n ** 18n; // 1 HBAR = 1e18 weibar
const BOLT_PER_HBAR = 3n;

const { ethers } = await network.connect({
  network: "testnet",
});

function weibar(hbar: number | bigint) {
  return BigInt(hbar) * ONE_HBAR_WEIBAR;
}

// newline-prefixed logger for cleaner spacing
function logN(...args: any[]) {
  console.log("\n", ...args);
}

// ----------------------------------------------------------
// Main Flow
// ----------------------------------------------------------
async function main() {
  // Small helper to consistently log tx hashes
  const logTx = async (tx: any, label: string) => {
    try {
      logN(`${label} tx hash:`, tx.hash);
      const receipt = await tx.wait();
      // Ethers v6 receipt.hash is also the transaction hash
      logN(
        `${label} confirmed in block ${receipt.blockNumber}, hash:`,
        receipt.hash
      );
      return receipt;
    } catch (e) {
      logN(`${label} failed. Last known tx hash:`, tx?.hash);
      throw e;
    }
  };
  // ----------------------------------------------------------
  // Actors
  // ----------------------------------------------------------
  const signers = await ethers.getSigners();
  const admin = signers[0];
  const investor = signers[1];
  const spender = signers[2];

  logN("==============================================");
  logN("admin:    ", admin.address);
  logN("investor: ", investor.address);
  logN("spender:  ", spender.address);
  logN("==============================================\n");

  // ----------------------------------------------------------
  // Native HBAR flow (wei) with current contracts
  // ----------------------------------------------------------
  // Helper: ensure an address has enough native HBAR to run the flow
  const ensureHbar = async (from: any, to: string, neededWei: bigint) => {
    const bal = await ethers.provider.getBalance(to);
    if (bal < neededWei) {
      const topUp = neededWei - bal + weibar(1n);
      logN(`Funding ${to} with`, topUp.toString(), "wei from admin");
      const tx = await from.sendTransaction({ to, value: topUp });
      await logTx(tx, `Fund ${to}`);
    }
  };

  // Top up investor and spender for this demo
  await ensureHbar(admin, investor.address, weibar(5n));
  await ensureHbar(admin, spender.address, weibar(5n));

  // ----------------------------------------------------------
  // (1) Deploy core contracts: Registry and Bolt
  // ----------------------------------------------------------
  logN("\n== Deploying Registry ==");
  const Registry = await ethers.getContractFactory("Registry", admin);
  const registry = await Registry.deploy();
  // Log deploy tx hash before awaiting deployment
  const registryDeployTx =
    registry.deploymentTransaction?.() ??
    (registry as any).deploymentTransaction?.();
  if (registryDeployTx) {
    logN("Registry deploy tx hash:", registryDeployTx.hash);
  }
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  logN("✅ Registry deployed:", registryAddress);

  // Initialize registry-level admin (set to admin signer address)
  await logTx(
    await (registry as any).initializeAdmin(admin.address),
    "Initialize Registry Admin"
  );
  logN("🔐 Registry admin initialized:", admin.address);

  logN("\n== Deploying Bolt (ERC-20) ==");
  const Bolt = await ethers.getContractFactory("Bolt", admin);
  const bolt = await Bolt.deploy("Bolt", "BOLT");
  const boltDeployTx =
    bolt.deploymentTransaction?.() ?? (bolt as any).deploymentTransaction?.();
  if (boltDeployTx) {
    logN("Bolt deploy tx hash:", boltDeployTx.hash);
  }
  await bolt.waitForDeployment();
  const boltAddress = await bolt.getAddress();
  logN("✅ Bolt deployed:", boltAddress);

  // ----------------------------------------------------------
  // (2) Create multiple Stations in Registry
  // ----------------------------------------------------------
  const stationDefinitions: {
    name: string;
    website: string;
    targetHbar: bigint; // expressed in whole HBAR; we'll convert to wei (1e18)
    meta: Uint8Array;
  }[] = [
    {
      name: "ChargeFrog Station: Nottingham",
      website: "https://chargefrog.vercel.app/stations/nottingham",
      targetHbar: 10n,
      meta: ethers.toUtf8Bytes("meta-nottingham"),
    },
    {
      name: "ChargeFrog Station: Majestic Labs",
      website: "https://chargefrog.vercel.app/stations/majestic-labs",
      targetHbar: 10n,
      meta: ethers.toUtf8Bytes("meta-majestic"),
    },
    {
      name: "ChargeFrog Station: Mount Austin",
      website: "https://chargefrog.vercel.app/stations/mount-austin",
      targetHbar: 10n,
      meta: ethers.toUtf8Bytes("meta-mount-austin"),
    },
    {
      name: "ChargeFrog Station: Eco-Majestic",
      website: "https://chargefrog.vercel.app/",
      targetHbar: 10n,
      meta: ethers.toUtf8Bytes("meta-eco-majestic"),
    },
  ];

  interface DeployedStationInfo {
    id: string; // string to avoid bigint serialization issues uniformly
    name: string;
    address: string;
    shares: string;
    website: string;
    targetWei: string;
  }
  const deployedStations: DeployedStationInfo[] = [];

  logN("\n== Deploying Stations ==");
  const Station = await ethers.getContractFactory("Station", admin);
  const Shares = await ethers.getContractFactory("Shares", admin);

  let primaryStation: any = null;
  let primaryStationId: bigint = 0n;
  let primaryStationAddress = "";
  let primarySharesAddress = "";

  for (const def of stationDefinitions) {
    const targetWei = weibar(def.targetHbar);
    const createTx = await registry.createStation(
      targetWei,
      1000,
      def.meta,
      admin.address
    );
    await logTx(createTx, `Create Station Record: ${def.name}`);
    const nextIdAfter = await registry.nextId();
    const stationId = nextIdAfter - 1n;
    logN(
      `➡️ Station record created (id=${stationId.toString()}) for ${def.name}`
    );

    const stationContract = await Station.deploy(
      stationId,
      targetWei,
      registryAddress,
      boltAddress,
      def.name,
      def.website
    );
    const stationDeployTx =
      stationContract.deploymentTransaction?.() ??
      (stationContract as any).deploymentTransaction?.();
    if (stationDeployTx) {
      logN(
        `Station deploy tx hash (id=${stationId.toString()}):`,
        stationDeployTx.hash
      );
    }
    await stationContract.waitForDeployment();
    const stationAddr = await stationContract.getAddress();
    logN(`✅ Station deployed: ${stationAddr} (${def.name})`);

    // Deploy Shares tracker per station & wire
    const sharesContract = await Shares.deploy(stationAddr);
    const sharesDeployTx =
      sharesContract.deploymentTransaction?.() ??
      (sharesContract as any).deploymentTransaction?.();
    if (sharesDeployTx) {
      logN(
        `Shares deploy tx hash (stationId=${stationId.toString()}):`,
        sharesDeployTx.hash
      );
    }
    await sharesContract.waitForDeployment();
    const sharesAddr = await sharesContract.getAddress();
    await logTx(
      await stationContract.connect(admin).setSharesTracker(sharesAddr),
      `Set Shares Tracker (stationId=${stationId.toString()})`
    );
    logN(`🔗 Shares wired: ${sharesAddr}`);

    // Initialize station admin & update fund address inside registry
    await logTx(
      await (registry as any).initializeStationAdmin(stationId, stationAddr),
      `Initialize Station Admin (stationId=${stationId.toString()})`
    );
    await logTx(
      await registry.updateFundAddress(stationId, stationAddr),
      `Update Fund Address (stationId=${stationId.toString()})`
    );
    // Register station in Bolt allowlist
    await logTx(
      await bolt.registerStation(stationId, stationAddr),
      `Register Station in Bolt (stationId=${stationId.toString()})`
    );
    logN(`✅ Station registered in Bolt: ${stationAddr}`);

    deployedStations.push({
      id: stationId.toString(),
      name: def.name,
      address: stationAddr,
      shares: sharesAddr,
      website: def.website,
      targetWei: targetWei.toString(),
    });

    if (!primaryStation) {
      primaryStation = stationContract;
      primaryStationId = stationId;
      primaryStationAddress = stationAddr;
      primarySharesAddress = sharesAddr;
    }
  }

  // Select Station 2 (Majestic Labs) for the investment + spend + claim flow as requested
  const targetStationInfo = deployedStations.find((s) => s.id === "2");
  if (!targetStationInfo) {
    throw new Error(
      "Station 2 (Majestic Labs) not found; deployment ordering assumption failed."
    );
  }
  const station2Id = 2n;
  const station2Address = targetStationInfo.address;
  const station2 = await Station.attach(station2Address);
  // Pull target directly from chain (already a bigint) to avoid parsing issues
  const station2TargetWei = await station2.totalInvestmentTarget();

  async function logStation2Balances(label: string) {
    console.log(
      `\n== Station 2 Balances (${targetStationInfo!.name}) : ${label} ==`
    );
    const hbarWallet = await ethers.provider.getBalance(station2Address);
    console.log(
      "HBAR wallet (wei):",
      hbarWallet.toString(),
      "| HBAR:",
      ethers.formatUnits(hbarWallet, 18)
    );
    const raisedWei = await station2.raisedAmount();
    // Revenue is derived from BOLT spend; HBAR-equivalent = totalRevenueBolt/3
    console.log(
      "Raised (wei):",
      raisedWei.toString(),
      "| HBAR:",
      ethers.formatUnits(raisedWei, 18)
    );
    const revenueBolt = await station2.totalRevenueBolt();
    const revenueHbarEqWei = revenueBolt / 3n;
    console.log(
      "Revenue HBAR-eq (wei via BOLT/3):",
      revenueHbarEqWei.toString(),
      "| HBAR:",
      ethers.formatUnits(revenueHbarEqWei, 18)
    );
    const boltBalStation = await bolt.balanceOf(station2Address);
    // revenueBolt already fetched above
    console.log(
      "BOLT balance (raw 18):",
      boltBalStation.toString(),
      "| BOLT:",
      ethers.formatUnits(boltBalStation, 18)
    );
    console.log(
      "Revenue BOLT (raw 18):",
      revenueBolt.toString(),
      "| BOLT:",
      ethers.formatUnits(revenueBolt, 18)
    );
  }

  // ----------------------------------------------------------
  // (3) Investor fully funds Station 2 (Majestic Labs)
  // ----------------------------------------------------------
  logN("\n== Investor Fully Investing in Station 2 (Majestic Labs) ==");
  // Ensure investor has enough balance for full target (plus buffer 1 HBAR)
  await ensureHbar(admin, investor.address, station2TargetWei + weibar(2n));
  const intendedInvest = station2TargetWei;
  logN("Station 2 target (wei) read:", station2TargetWei.toString());
  logN("Intended invest (wei):", intendedInvest.toString());
  // Attempt full-target investment
  const investTx = await station2
    .connect(investor)
    .invest({ value: intendedInvest });
  await logTx(investTx, "Investor Full Invest Station 2 (attempt 1)");
  let raisedAfter = await station2.raisedAmount();
  logN(
    "Raised after attempt 1 (wei):",
    raisedAfter.toString(),
    "| HBAR:",
    ethers.formatUnits(raisedAfter, 18)
  );
  // If raised is unexpectedly lower (unit mismatch or truncation), top up the delta exactly once.
  if (raisedAfter < station2TargetWei) {
    const delta = station2TargetWei - raisedAfter;
    logN(
      `Raised < target; investing delta: ${delta.toString()} wei (HBAR ${ethers.formatUnits(
        delta,
        18
      )})`
    );
    await ensureHbar(admin, investor.address, delta + weibar(1n));
    const investTx2 = await station2.connect(investor).invest({ value: delta });
    await logTx(investTx2, "Investor Top-up Station 2 (attempt 2)");
    raisedAfter = await station2.raisedAmount();
    logN(
      "Raised after attempt 2 (wei):",
      raisedAfter.toString(),
      "| HBAR:",
      ethers.formatUnits(raisedAfter, 18)
    );
  }
  if (raisedAfter === station2TargetWei) {
    logN("✅ Station 2 fully funded (raised == target)");
  } else {
    console.warn(
      "⚠️ Station 2 still not fully funded. Claim math will scale invested/target; entitlement may truncate."
    );
  }
  await logStation2Balances("after funding logic");

  // Ensure Station 2 is fully funded: if raised < target, top up the delta in wei
  {
    const currentTarget = await station2.totalInvestmentTarget();
    const currentRaised = await station2.raisedAmount();
    if (currentRaised < currentTarget) {
      const deltaWei = currentTarget - currentRaised;
      logN(
        `Station 2 funding delta detected: ${deltaWei.toString()} wei (HBAR: ${ethers.formatUnits(
          deltaWei,
          18
        )})`
      );
      // Make sure investor has enough balance to cover the delta
      await ensureHbar(admin, investor.address, deltaWei + weibar(1n));
      await logTx(
        await station2.connect(investor).invest({ value: deltaWei }),
        "Investor Top-up Station 2"
      );
      const raisedPost = await station2.raisedAmount();
      logN(
        "Station 2 Raised after top-up (wei):",
        raisedPost.toString(),
        "| HBAR:",
        ethers.formatUnits(raisedPost, 18)
      );
    }
  }

  // ----------------------------------------------------------
  // (4) Spender buys Bolt using native HBAR
  // ----------------------------------------------------------
  const buyAmtWei = weibar(2n); // 2 HBAR => 6 BOLT (18 decimals)
  logN("buyAmtWei:", buyAmtWei.toString());
  logN("\n== Buying Bolt (HBAR -> BOLT) ==");
  await logTx(
    await bolt.connect(spender).buyBolt({ value: buyAmtWei }),
    "Buy BOLT with HBAR"
  );
  // Prefer the explicit getBalance helper (falls back to balanceOf if unavailable)
  const boltBal = await bolt.balanceOf(spender.address);
  logN("Spender BOLT balance (raw 18 decimals):", boltBal.toString());
  // Human readable via ethers formatting
  logN("Spender BOLT balance (human):", ethers.formatUnits(boltBal, 18));

  // ----------------------------------------------------------
  // (5) Spend Bolt at Station 2 (approve then spend)
  // ----------------------------------------------------------
  logN("\n== Spending Bolt at Station 2 (Majestic Labs) ==");
  const station2BoltBefore = await bolt.balanceOf(station2Address);
  logN(
    "Station 2 BOLT balance before (raw):",
    station2BoltBefore.toString(),
    "| human:",
    ethers.formatUnits(station2BoltBefore, 18)
  );
  const spendEquivalentWei = weibar(18n); // spend equivalent of 1 HBAR worth of BOLT
  logN(
    `Attempting to spend Bolt at Station 2... ${spendEquivalentWei.toString()} wei (1 HBAR equivalent)`
  );
  const boltToSpend2 = spendEquivalentWei * BOLT_PER_HBAR; // 1 HBAR => 3e18 BOLT units
  await logTx(
    await bolt.connect(spender).approve(boltAddress, boltToSpend2),
    "Approve BOLT Allowance (Station 2)"
  );
  await logTx(
    await bolt.connect(spender).spendBolt(station2Id, boltToSpend2),
    "Spend BOLT at Station 2"
  );
  logN("🧾 Bolt spent at Station 2 (raw units):", boltToSpend2.toString());
  logN(
    "🧾 Bolt spent at Station 2 (human):",
    ethers.formatUnits(boltToSpend2, 18)
  );
  const revenueBolt2 = await station2.totalRevenueBolt();
  logN(
    "Station 2 revenue (BOLT) raw:",
    revenueBolt2.toString(),
    "| human:",
    ethers.formatUnits(revenueBolt2, 18)
  );
  const station2BoltAfter = await bolt.balanceOf(station2Address);
  const station2BoltDelta = station2BoltAfter - station2BoltBefore;
  logN(
    "Station 2 BOLT balance after (raw):",
    station2BoltAfter.toString(),
    "| human:",
    ethers.formatUnits(station2BoltAfter, 18)
  );
  logN(
    "Station 2 BOLT delta (raw):",
    station2BoltDelta.toString(),
    "| human:",
    ethers.formatUnits(station2BoltDelta, 18)
  );
  await logStation2Balances("after spend");

  // ----------------------------------------------------------
  // (6) Activate claims (no direct HBAR deposit; revenue comes from BOLT spend)
  // ----------------------------------------------------------
  await logTx(
    await station2.connect(admin).setStationActive(true),
    "Set Station 2 Active"
  );
  logN("✅ Station 2 claims activated (BOLT spend supplies revenue)");
  await logStation2Balances("after activation");

  // // ----------------------------------------------------------
  // // (7) Investor claims proportional HBAR from Station 2
  // // ----------------------------------------------------------
  logN("\n== Claiming Rewards from Station 2 (Majestic Labs) ==");
  const s2Target = await station2.totalInvestmentTarget();
  const s2Raised = await station2.raisedAmount();
  const s2RevenueBolt = await station2.totalRevenueBolt();
  const s2Invested = await station2.investedAmount(investor.address);
  logN(
    "Station 2 Target (wei):",
    s2Target.toString(),
    "| HBAR:",
    ethers.formatUnits(s2Target, 18)
  );
  logN(
    "Station 2 Raised (wei):",
    s2Raised.toString(),
    "| HBAR:",
    ethers.formatUnits(s2Raised, 18)
  );
  logN(
    "Station 2 Revenue BOLT (raw 18):",
    s2RevenueBolt.toString(),
    "| BOLT:",
    ethers.formatUnits(s2RevenueBolt, 18)
  );
  const s2RevenueHbarEqWei = s2RevenueBolt / 3n;
  logN(
    "Station 2 Revenue HBAR-eq (wei via BOLT/3):",
    s2RevenueHbarEqWei.toString(),
    "| HBAR:",
    ethers.formatUnits(s2RevenueHbarEqWei, 18)
  );
  logN(
    "Station 2 Investor invested (wei):",
    s2Invested.toString(),
    "| HBAR:",
    ethers.formatUnits(s2Invested, 18)
  );
  let s2EntitledWei = 0n;
  if (s2Target > 0n) {
    // Match new contract claim math: invested / target * (totalRevenueBolt/3)
    s2EntitledWei = (s2Invested * (s2RevenueBolt / 3n)) / s2Target;
    logN(
      "Station 2 Expected entitlement (wei):",
      s2EntitledWei.toString(),
      "| HBAR:",
      ethers.formatUnits(s2EntitledWei, 18)
    );
  } else {
    logN("Station 2 Expected entitlement (wei): 0 | HBAR: 0");
  }
  const s2PendingWei = await station2.unclaimed(investor.address);
  logN(
    "Station 2 Claimable (wei):",
    s2PendingWei.toString(),
    "| HBAR:",
    ethers.formatUnits(s2PendingWei, 18)
  );
  if (s2PendingWei > 0n) {
    await logTx(
      await station2.connect(investor).claim(),
      "Investor Claim Station 2"
    );
    logN("✅ Investor claimed successfully from Station 2!");
    await logStation2Balances("after claim");
  } else {
    logN("Nothing to claim yet on Station 2.");
  }

  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------
  logN("\n==============================================");
  logN("🌐 FULL DEPLOYMENT + FLOW COMPLETE (native HBAR)");
  logN("==============================================");
  logN("Registry:", registryAddress);
  logN("Bolt:    ", boltAddress);
  for (const s of deployedStations) {
    logN(`Station[${s.id}]: ${s.address} -> ${s.name}`);
    logN(`  Shares: ${s.shares}`);
  }
  logN("==============================================\n");

  // ----------------------------------------------------------
  // (8) Persist deployment info to JSON file
  // ----------------------------------------------------------
  const net = await ethers.provider.getNetwork();
  const output = {
    network: { name: (net as any).name, chainId: net.chainId.toString() },
    registry: registryAddress,
    bolt: boltAddress,
    stations: deployedStations,
    timestamp: new Date().toISOString(),
  } as const;
  const outDir = path.resolve(process.cwd(), "deployments");
  try {
    mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, `deployment-${Date.now()}.json`);
    writeFileSync(filePath, JSON.stringify(output, null, 2), {
      encoding: "utf-8",
    });
    logN(`📝 Deployment JSON written to ${filePath}`);
  } catch (err) {
    console.error("Failed to write deployment JSON", err);
  }

  // ----------------------------------------------------------
  await main().catch((err) => {
    console.error("❌ Deployment error:", err);
  });
}
