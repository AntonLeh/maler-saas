import { Router } from "express";
import { getOrderImages } from "./images.controller";

const router = Router();

router.get("/:id/images", getOrderImages);

export default router;