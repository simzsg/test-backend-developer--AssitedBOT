/*
  Warnings:

  - A unique constraint covering the columns `[symbol,minuteBucket]` on the table `PriceSnapshot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `PriceSnapshot_symbol_source_minuteBucket_key` ON `pricesnapshot`;

-- CreateIndex
CREATE UNIQUE INDEX `PriceSnapshot_symbol_minuteBucket_key` ON `PriceSnapshot`(`symbol`, `minuteBucket`);
