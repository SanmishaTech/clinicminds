-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT 'CONSULTATION';

-- AlterTable
ALTER TABLE `Consultation` MODIFY `casePaperUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `ConsultationMedicine` MODIFY `medicineId` INTEGER NULL;

-- AlterTable
ALTER TABLE `franchises` ADD COLUMN `franchiseFeeAmount` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `packages` ADD COLUMN `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sale_details` ADD COLUMN `batchNumber` VARCHAR(191) NULL,
    ADD COLUMN `expiryDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `services` ADD COLUMN `baseRate` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `gstPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `franchise_fee_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `franchiseId` INTEGER NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `paymentMode` VARCHAR(191) NOT NULL,
    `payerName` VARCHAR(191) NULL,
    `contactNumber` VARCHAR(191) NULL,
    `utrNumber` VARCHAR(191) NULL,
    `chequeDate` DATETIME(3) NULL,
    `chequeNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdByUserId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `franchise_fee_payments_franchiseId_idx`(`franchiseId`),
    INDEX `franchise_fee_payments_paymentDate_idx`(`paymentDate`),
    INDEX `franchise_fee_payments_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `franchiseId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `transporterName` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `transportFee` DECIMAL(10, 2) NULL,
    `receiptNumber` VARCHAR(191) NULL,
    `vehicleNumber` VARCHAR(191) NULL,
    `trackingNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `dispatchedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `stockPostedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transports_saleId_key`(`saleId`),
    INDEX `transports_franchiseId_idx`(`franchiseId`),
    INDEX `transports_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `txnType` VARCHAR(191) NOT NULL,
    `txnNo` VARCHAR(191) NOT NULL,
    `txnDate` DATETIME(3) NOT NULL,
    `franchiseId` INTEGER NOT NULL,
    `createdByUserId` INTEGER NOT NULL,
    `saleId` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_transactions_txnNo_key`(`txnNo`),
    UNIQUE INDEX `stock_transactions_saleId_key`(`saleId`),
    INDEX `stock_transactions_franchiseId_idx`(`franchiseId`),
    INDEX `stock_transactions_txnType_idx`(`txnType`),
    INDEX `stock_transactions_txnDate_idx`(`txnDate`),
    INDEX `stock_transactions_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transactionId` INTEGER NOT NULL,
    `franchiseId` INTEGER NOT NULL,
    `medicineId` INTEGER NOT NULL,
    `batchNumber` VARCHAR(191) NULL,
    `expiryDate` DATETIME(3) NULL,
    `qtyChange` INTEGER NOT NULL,
    `rate` DECIMAL(10, 2) NULL,
    `amount` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_ledger_transactionId_idx`(`transactionId`),
    INDEX `stock_ledger_franchiseId_idx`(`franchiseId`),
    INDEX `stock_ledger_medicineId_idx`(`medicineId`),
    INDEX `stock_ledger_franchiseId_medicineId_idx`(`franchiseId`, `medicineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_batch_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `franchiseId` INTEGER NOT NULL,
    `medicineId` INTEGER NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_batch_balances_franchiseId_idx`(`franchiseId`),
    INDEX `stock_batch_balances_medicineId_idx`(`medicineId`),
    INDEX `stock_batch_balances_franchiseId_medicineId_idx`(`franchiseId`, `medicineId`),
    INDEX `stock_batch_balances_expiryDate_idx`(`expiryDate`),
    UNIQUE INDEX `stock_batch_balances_franchiseId_medicineId_batchNumber_expi_key`(`franchiseId`, `medicineId`, `batchNumber`, `expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `franchiseId` INTEGER NOT NULL,
    `medicineId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_balances_franchiseId_idx`(`franchiseId`),
    INDEX `stock_balances_medicineId_idx`(`medicineId`),
    UNIQUE INDEX `stock_balances_franchiseId_medicineId_key`(`franchiseId`, `medicineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_recalls` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockTransactionId` INTEGER NOT NULL,
    `franchiseId` INTEGER NOT NULL,
    `medicineId` INTEGER NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdByUserId` INTEGER NOT NULL,
    `recalledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_recalls_franchiseId_idx`(`franchiseId`),
    INDEX `stock_recalls_medicineId_idx`(`medicineId`),
    INDEX `stock_recalls_expiryDate_idx`(`expiryDate`),
    INDEX `stock_recalls_recalledAt_idx`(`recalledAt`),
    INDEX `stock_recalls_createdByUserId_idx`(`createdByUserId`),
    INDEX `stock_recalls_franchiseId_medicineId_idx`(`franchiseId`, `medicineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicine_bills` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `franchiseId` INTEGER NULL,
    `billNumber` VARCHAR(191) NOT NULL,
    `billDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `patientId` INTEGER NULL,
    `discountPercent` INTEGER NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medicine_bills_saleId_key`(`saleId`),
    UNIQUE INDEX `medicine_bills_billNumber_key`(`billNumber`),
    INDEX `medicine_bills_saleId_idx`(`saleId`),
    INDEX `medicine_bills_billNumber_idx`(`billNumber`),
    INDEX `medicine_bills_franchiseId_idx`(`franchiseId`),
    INDEX `medicine_bills_patientId_idx`(`patientId`),
    INDEX `medicine_bills_billDate_idx`(`billDate`),
    INDEX `medicine_bills_franchiseId_billDate_idx`(`franchiseId`, `billDate`),
    INDEX `medicine_bills_patientId_billDate_idx`(`patientId`, `billDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicine_bill_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `medicineBillId` INTEGER NOT NULL,
    `medicineId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `mrp` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,

    INDEX `medicine_bill_details_medicineBillId_idx`(`medicineBillId`),
    INDEX `medicine_bill_details_medicineId_idx`(`medicineId`),
    INDEX `medicine_bill_details_medicineBillId_medicineId_idx`(`medicineBillId`, `medicineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `services_gstPercent_idx` ON `services`(`gstPercent`);

-- AddForeignKey
ALTER TABLE `franchise_fee_payments` ADD CONSTRAINT `franchise_fee_payments_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `franchise_fee_payments` ADD CONSTRAINT `franchise_fee_payments_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transports` ADD CONSTRAINT `transports_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transports` ADD CONSTRAINT `transports_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledger` ADD CONSTRAINT `stock_ledger_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `stock_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledger` ADD CONSTRAINT `stock_ledger_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledger` ADD CONSTRAINT `stock_ledger_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_batch_balances` ADD CONSTRAINT `stock_batch_balances_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_batch_balances` ADD CONSTRAINT `stock_batch_balances_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_recalls` ADD CONSTRAINT `stock_recalls_stockTransactionId_fkey` FOREIGN KEY (`stockTransactionId`) REFERENCES `stock_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_recalls` ADD CONSTRAINT `stock_recalls_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_recalls` ADD CONSTRAINT `stock_recalls_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_recalls` ADD CONSTRAINT `stock_recalls_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_bills` ADD CONSTRAINT `medicine_bills_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_bills` ADD CONSTRAINT `medicine_bills_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_bills` ADD CONSTRAINT `medicine_bills_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_bill_details` ADD CONSTRAINT `medicine_bill_details_medicineBillId_fkey` FOREIGN KEY (`medicineBillId`) REFERENCES `medicine_bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_bill_details` ADD CONSTRAINT `medicine_bill_details_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
