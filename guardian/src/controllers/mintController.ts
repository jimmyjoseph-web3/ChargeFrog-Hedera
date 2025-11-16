import { Request, Response } from "express";
import { mintCarbonFrog } from "../events/handleMinting";

export const mintCarbonFrogController = async (req: Request, res: Response) => {
  try {
    const mintPayload = req.body;
    const result = await mintCarbonFrog(mintPayload);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ success: false, message });
  }
};
