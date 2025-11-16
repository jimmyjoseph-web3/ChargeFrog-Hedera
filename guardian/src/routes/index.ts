import { Router } from "express";
import mintRouter from "./mint";

const router = Router();

// Each child router already defines its own path (e.g. "/mint", "/wipe")
router.use("/mint", mintRouter);


export default router;