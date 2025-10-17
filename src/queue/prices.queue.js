
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const pricesQueue = new Queue("prices", { connection });


export async function schedulePricesJob() {
  await pricesQueue.add(
    "poll-rest",
    {},
    {
      repeat: { every: 60_000 },       
      removeOnComplete: 100,           
      removeOnFail: false,
      jobId: "prices:poll-rest:every-1m",
    }
  );
}
