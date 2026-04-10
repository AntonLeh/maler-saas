import { Router } from "express";
import { getCustomers, postCustomer } from "./customers.controller";

const router = Router();

router.get("/", getCustomers);
router.post("/", postCustomer);

export default router;