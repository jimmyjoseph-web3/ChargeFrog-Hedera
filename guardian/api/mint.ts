import type { VercelRequest, VercelResponse } from "@vercel/node";
import { mintCarbonFrog } from "../src/events/handleMinting";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJsonBody(req: VercelRequest): Promise<any> {
  if (req.body) return req.body;
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: any) => (data += chunk));
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

    // Basic shape validation
    if (
      !body ||
      typeof body !== "object" ||
      typeof body.document !== "object" ||
      body.document === null
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid payload: expected {"document":{...}}',
        example: {
          document: {
            field0: "",
            field1: "",
            field2: "",
            field3: "",
            field4: "",
          },
        },
      });
    }

    const doc = body.document as Record<string, unknown>;
    const required = [
      "field0",
      "field1",
      "field2",
      "field3",
      "field4",
    ] as const;

    // Ensure all fields exist and are strings (empty string allowed)
    const missing = required.filter((k) => !(k in doc));
    const wrongType = required.filter((k) => typeof doc[k] !== "string");

    if (missing.length || wrongType.length) {
      return res.status(400).json({
        ok: false,
        error: "Invalid document fields",
        details: {
          missing,
          wrongType, // must be string
        },
        example: {
          document: {
            field0: "",
            field1: "",
            field2: "",
            field3: "",
            field4: "",
          },
        },
      });
    }

    // Only pass the expected shape through
    const payload = {
      document: {
        field0: doc.field0 as string,
        field1: doc.field1 as string,
        field2: doc.field2 as string,
        field3: doc.field3 as string,
        field4: doc.field4 as string,
      },
    };

    const result = await mintCarbonFrog(payload);
    return res.status(200).json({ ok: true, data: result });
  } catch (err: any) {
    const msg = err?.message || "Mint failed";
    const code = /invalid|bad request|schema/i.test(msg) ? 400 : 500;
    return res.status(code).json({ ok: false, error: msg });
  }
}
