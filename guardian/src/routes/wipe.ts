import { Router } from "express";
import { wipeCarbonFrog } from "../events/handleWipe";

const router = Router();

router.post("/wipe", async (req, res) => {
  try {
    const mintPayload = req.body;
    const result = await wipeCarbonFrog(mintPayload);
    res.status(200).json({ message: "Wiping successful", data: result });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "An error occurred",
    });
  }
});

export default router;
