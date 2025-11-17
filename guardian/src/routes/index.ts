import { Router } from "express";
import mintRouter from "./mint";
import wipeRouter from "./wipe";

const router = Router();

// Each child router already defines its own path (e.g. "/mint", "/wipe")
router.use("/", mintRouter);
router.use("/", wipeRouter);

export default router;
