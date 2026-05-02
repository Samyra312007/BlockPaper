import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import pricesRouter from "./prices";
import tradingRouter from "./trading";
import aiRouter from "./ai";
import walletRouter from "./wallet";
import sentinelRouter from "./sentinel";
import roomsRouter from "./rooms";
import gamificationRouter from "./gamification";
import backtestRouter from "./backtest";
import heatmapRouter from "./heatmap";
import sentimentRouter from "./sentiment";
import alertsRouter from "./alerts";
import feedRouter from "./feed";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(pricesRouter);
router.use(tradingRouter);
router.use(aiRouter);
router.use(walletRouter);
router.use(sentinelRouter);
router.use(roomsRouter);
router.use(gamificationRouter);
router.use(backtestRouter);
router.use(heatmapRouter);
router.use(sentimentRouter);
router.use(alertsRouter);
router.use(feedRouter);

export default router;
