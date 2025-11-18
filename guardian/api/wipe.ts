import type { VercelRequest, VercelResponse } from "@vercel/node";
import { wipeCarbonFrog } from "../src/events/handleWipe";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJsonBody(req: VercelRequest): Promise<any> {
  if (req.body) return req.body;
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c: any) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }
  try {
    const body = await readJsonBody(req);
    // Accept empty field1 to trigger auto mode
    const field1 = "";
    const payload = { document: { field1: String(field1) } };
    const result = await wipeCarbonFrog(payload);
    return res.status(200).json({ ok: true, data: result });
  } catch (err: any) {
    const msg = err?.message || "Wipe failed";
    return res
      .status(/invalid|bad request|schema/i.test(msg) ? 400 : 500)
      .json({ ok: false, error: msg });
  }
}
