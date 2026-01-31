/*
  Warnings:

  - You are about to drop the column `saleId` on the `medicine_bills` table. All the data in the column will be lost.
  - You are about to drop the column `referedBy` on the `patients` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[medicineBillId]` on the table `stock_transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[consultationId]` on the table `stock_transactions` will be added. If there are existing duplicate values, this will fail.
  - Made the column `age` on table `patients` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey (if exists)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'medicine_bills' 
   AND CONSTRAINT_NAME = 'medicine_bills_saleId_fkey') > 0,
  'ALTER TABLE `medicine_bills` DROP FOREIGN KEY `medicine_bills_saleId_fkey`',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropForeignKey (if exists)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'transports' 
   AND CONSTRAINT_NAME = 'transports_saleId_fkey') > 0,
  'ALTER TABLE `transports` DROP FOREIGN KEY `transports_saleId_fkey`',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropIndex (if exists)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'medicine_bills' 
   AND INDEX_NAME = 'medicine_bills_franchiseId_billDate_idx') > 0,
  'DROP INDEX `medicine_bills_franchiseId_billDate_idx` ON `medicine_bills`',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropIndex (if exists)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'medicine_bills' 
   AND INDEX_NAME = 'medicine_bills_patientId_billDate_idx') > 0,
  'DROP INDEX `medicine_bills_patientId_billDate_idx` ON `medicine_bills`',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropIndex (if exists)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'medicine_bills' 
   AND INDEX_NAME = 'medicine_bills_saleId_key') > 0,
  'DROP INDEX `medicine_bills_saleId_key` ON `medicine_bills`',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropIndex (if exists)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'transports' 
   AND INDEX_NAME = 'transports_saleId_key') > 0,
  'DROP INDEX `transports_saleId_key` ON `transports`',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable
ALTER TABLE `Consultation` ADD COLUMN `totalReceivedAmount` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `medicine_bills` DROP COLUMN `saleId`;

-- AlterTable
ALTER TABLE `medicines` ADD COLUMN `baseRate` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `gstPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `packages` ADD COLUMN `duration` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `patients` DROP COLUMN `referedBy`,
    ADD COLUMN `isReferredToHo` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `labId` INTEGER NULL,
    ADD COLUMN `mobile2` VARCHAR(191) NULL,
    ADD COLUMN `referredBy` VARCHAR(191) NULL,
    MODIFY `age` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `services` ADD COLUMN `isProcedure` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `stock_transactions` ADD COLUMN `consultationId` INTEGER NULL,
    ADD COLUMN `medicineBillId` INTEGER NULL;

-- AlterTable
ALTER TABLE `transports` ADD COLUMN `dispatchedQuantity` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `transport_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transportId` INTEGER NOT NULL,
    `saleDetailId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `transport_details_transportId_idx`(`transportId`),
    INDEX `transport_details_saleDetailId_idx`(`saleDetailId`),
    UNIQUE INDEX `transport_details_transportId_saleDetailId_key`(`transportId`, `saleDetailId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patient_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `name` VARCHAR(191) NULL,
    `url` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `patient_reports_patientId_idx`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsultationReceipt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receiptNumber` VARCHAR(191) NOT NULL,
    `consultationId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `paymentMode` VARCHAR(191) NOT NULL,
    `payerName` VARCHAR(191) NULL,
    `contactNumber` VARCHAR(191) NULL,
    `upiName` VARCHAR(191) NULL,
    `utrNumber` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `chequeDate` DATETIME(3) NULL,
    `chequeNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdByUserId` INTEGER NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConsultationReceipt_receiptNumber_key`(`receiptNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_stock_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `medicineId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_stock_balances_medicineId_key`(`medicineId`),
    INDEX `admin_stock_balances_medicineId_idx`(`medicineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_stock_batch_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `medicineId` INTEGER NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `admin_stock_batch_balances_medicineId_idx`(`medicineId`),
    INDEX `admin_stock_batch_balances_expiryDate_idx`(`expiryDate`),
    UNIQUE INDEX `admin_stock_batch_balances_medicineId_batchNumber_expiryDate_key`(`medicineId`, `batchNumber`, `expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lab` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `medicines_gstPercent_idx` ON `medicines`(`gstPercent`);

-- CreateIndex
CREATE UNIQUE INDEX `stock_transactions_medicineBillId_key` ON `stock_transactions`(`medicineBillId`);

-- CreateIndex
CREATE UNIQUE INDEX `stock_transactions_consultationId_key` ON `stock_transactions`(`consultationId`);

-- AddForeignKey
ALTER TABLE `transport_details` ADD CONSTRAINT `transport_details_transportId_fkey` FOREIGN KEY (`transportId`) REFERENCES `transports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_details` ADD CONSTRAINT `transport_details_saleDetailId_fkey` FOREIGN KEY (`saleDetailId`) REFERENCES `sale_details`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_labId_fkey` FOREIGN KEY (`labId`) REFERENCES `Lab`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patient_reports` ADD CONSTRAINT `patient_reports_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationReceipt` ADD CONSTRAINT `ConsultationReceipt_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationReceipt` ADD CONSTRAINT `ConsultationReceipt_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_medicineBillId_fkey` FOREIGN KEY (`medicineBillId`) REFERENCES `medicine_bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_stock_balances` ADD CONSTRAINT `admin_stock_balances_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_stock_batch_balances` ADD CONSTRAINT `admin_stock_batch_balances_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
