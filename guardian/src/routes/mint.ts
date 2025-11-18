import { Router } from "express";
import { mintCarbonFrog } from "../events/handleMinting";

const router = Router();

router.post("/mint", async (req, res) => {
  try {
    const mintPayload = req.body;
    const result = await mintCarbonFrog(mintPayload);
    res.status(200).json({ message: "Minting successful", data: result });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "An error occurred",
    });
  }
});

export default router;
