import { Router } from "express";
import { getOrders, getOrder, postOrder } from "./orders.controller";

const router = Router();

router.get("/", getOrders);
router.get("/:id", getOrder);
router.post("/", postOrder);

export default router;