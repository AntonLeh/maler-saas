import { Router } from "express";
import { getOrderProgress, postProgress } from "./progress.controller";

const router = Router();

router.get("/:id/progress", getOrderProgress);
router.post("/:id/progress", postProgress);

export default router;