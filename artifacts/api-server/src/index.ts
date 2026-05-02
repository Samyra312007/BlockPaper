import app from "./app";
import { logger } from "./lib/logger";
import { startPriceSimulation } from "./lib/prices";
import { seedCandles } from "./lib/candles";
import { startSentinelMonitor } from "./routes/sentinel";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  startPriceSimulation();
  startSentinelMonitor();

  try {
    await seedCandles();
  } catch (e) {
    logger.warn({ err: e }, "Could not seed candles (DB may not be ready)");
  }
});
