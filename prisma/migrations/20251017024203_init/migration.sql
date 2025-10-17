-- CreateTable
CREATE TABLE `PriceSnapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(191) NOT NULL,
    `price` DECIMAL(20, 8) NOT NULL,
    `bid` DECIMAL(20, 8) NULL,
    `ask` DECIMAL(20, 8) NULL,
    `volume` DECIMAL(28, 8) NULL,
    `source` ENUM('REST', 'WS') NOT NULL,
    `eventTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `minuteBucket` DATETIME(3) NOT NULL,

    INDEX `PriceSnapshot_symbol_minuteBucket_idx`(`symbol`, `minuteBucket`),
    UNIQUE INDEX `PriceSnapshot_symbol_source_minuteBucket_key`(`symbol`, `source`, `minuteBucket`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CurrentPrice` (
    `symbol` VARCHAR(191) NOT NULL,
    `price` DECIMAL(20, 8) NOT NULL,
    `bid` DECIMAL(20, 8) NULL,
    `ask` DECIMAL(20, 8) NULL,
    `volume` DECIMAL(28, 8) NULL,
    `eventTime` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`symbol`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
