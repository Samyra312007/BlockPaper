import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { startPriceSimulation } from "./lib/prices";
import { seedCandles } from "./lib/candles";
import { startSentinelMonitor } from "./routes/sentinel";
import { startWsServer } from "./lib/ws-server";
import { startWeeklyMonitor } from "./lib/gamification";
import { seedDailyCandles } from "./lib/candles";
import { startSentimentMonitor } from "./routes/sentiment";
import { startAlertMonitor } from "./lib/alert-monitor";
import { startFeedBroadcaster } from "./lib/feed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = http.createServer(app);
startWsServer(httpServer);

httpServer.listen(port, async () => {
  logger.info({ port }, "Server listening");

  startPriceSimulation();
  startSentinelMonitor();
  startSentimentMonitor();
  startAlertMonitor();
  startFeedBroadcaster();
  startWeeklyMonitor();

  try {
    await seedCandles();
    await seedDailyCandles();
  } catch (e) {
    logger.warn({ err: e }, "Could not seed candles (DB may not be ready)");
  }
});
