-- CreateTable
CREATE TABLE `sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceNo` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL,
    `franchiseId` INTEGER NOT NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sales_invoiceNo_idx`(`invoiceNo`),
    INDEX `sales_franchiseId_idx`(`franchiseId`),
    INDEX `sales_invoiceDate_idx`(`invoiceDate`),
    INDEX `sales_franchiseId_invoiceDate_idx`(`franchiseId`, `invoiceDate`),
    INDEX `sales_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `medicineId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `rate` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sale_details_saleId_idx`(`saleId`),
    INDEX `sale_details_medicineId_idx`(`medicineId`),
    INDEX `sale_details_saleId_medicineId_idx`(`saleId`, `medicineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `medicines_name_idx` ON `medicines`(`name`);

-- CreateIndex
CREATE INDEX `medicines_brand_idx` ON `medicines`(`brand`);

-- CreateIndex
CREATE INDEX `medicines_rate_idx` ON `medicines`(`rate`);

-- CreateIndex
CREATE INDEX `medicines_mrp_idx` ON `medicines`(`mrp`);

-- CreateIndex
CREATE INDEX `medicines_createdAt_idx` ON `medicines`(`createdAt`);

-- CreateIndex
CREATE INDEX `services_name_idx` ON `services`(`name`);

-- CreateIndex
CREATE INDEX `services_unit_idx` ON `services`(`unit`);

-- CreateIndex
CREATE INDEX `services_rate_idx` ON `services`(`rate`);

-- CreateIndex
CREATE INDEX `services_createdAt_idx` ON `services`(`createdAt`);

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_details` ADD CONSTRAINT `sale_details_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_details` ADD CONSTRAINT `sale_details_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
