import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import pricesRouter from "./prices";
import tradingRouter from "./trading";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(pricesRouter);
router.use(tradingRouter);
router.use(aiRouter);

export default router;
