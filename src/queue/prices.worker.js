
import { Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { pollRestOnce } from "../workers/rest-poller.js";

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export function startPricesWorker() {
  const worker = new Worker(
    "prices",
    async (job) => {
      if (job.name === "poll-rest") {
        await pollRestOnce();
      }
    },
    {
      connection,
      concurrency: 1,            
      // limiter: { max: 10, duration: 1000 }, 
    }
  );

  const events = new QueueEvents("prices", { connection });
  events.on("completed", ({ jobId }) => {
   
  });
  events.on("failed", ({ jobId, failedReason }) => {
    console.error("[prices] failed", jobId, failedReason);
  });

  worker.on("error", (err) => console.error("[prices] worker error", err));

 
  const shutdown = async () => {
    try {
      await worker.close();
      await events.close();
      await connection.quit();
      
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return { worker, events };
}
