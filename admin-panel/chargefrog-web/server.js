// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = 7546;

app.use(cors());
app.use(express.json());

app.post("/api", async (req, res) => {
  try {
    const body = req.body;
    // Forward the request to Hedera Hashio RPC testnet
    const rpcResponse = await fetch("https://testnet.hashio.io/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await rpcResponse.json();
    res.json(data);
  } catch (err) {
    console.error("Bridge error:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Local Hedera bridge running at http://127.0.0.1:${PORT}/api`)
);
