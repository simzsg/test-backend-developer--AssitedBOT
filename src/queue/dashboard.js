
import { ExpressAdapter, createBullBoard } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { pricesQueue } from "./prices.queue.js";

export function mountQueueBoard(app) {
  const adapter = new ExpressAdapter();
  createBullBoard({
    queues: [new BullMQAdapter(pricesQueue)],
    serverAdapter: adapter,
  });
  adapter.setBasePath("/admin/queues");
  app.use("/admin/queues", adapter.getRouter());
}
