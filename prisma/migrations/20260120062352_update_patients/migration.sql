/*
  Warnings:

  - You are about to drop the column `contactPerson` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `contactPersonMobile1` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `contactPersonMobile2` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `mobile1` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `mobile2` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `team` on the `patients` table. All the data in the column will be lost.
  - Added the required column `aadharNo` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bloodGroup` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `middleName` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mobile` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Made the column `address` on table `patients` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX `patients_mobile1_idx` ON `patients`;

-- DropIndex
DROP INDEX `patients_name_idx` ON `patients`;

-- DropIndex
DROP INDEX `patients_status_idx` ON `patients`;

-- DropIndex
DROP INDEX `patients_team_idx` ON `patients`;

-- AlterTable
ALTER TABLE `patients` DROP COLUMN `contactPerson`,
    DROP COLUMN `contactPersonMobile1`,
    DROP COLUMN `contactPersonMobile2`,
    DROP COLUMN `mobile1`,
    DROP COLUMN `mobile2`,
    DROP COLUMN `name`,
    DROP COLUMN `status`,
    DROP COLUMN `team`,
    ADD COLUMN `aadharNo` VARCHAR(191) NOT NULL,
    ADD COLUMN `bloodGroup` VARCHAR(191) NOT NULL,
    ADD COLUMN `bmi` VARCHAR(191) NULL,
    ADD COLUMN `contactPersonAddress` VARCHAR(191) NULL,
    ADD COLUMN `contactPersonEmail` VARCHAR(191) NULL,
    ADD COLUMN `contactPersonMobile` VARCHAR(191) NULL,
    ADD COLUMN `contactPersonName` VARCHAR(191) NULL,
    ADD COLUMN `firstName` VARCHAR(191) NOT NULL,
    ADD COLUMN `franchiseId` INTEGER NULL,
    ADD COLUMN `height` VARCHAR(191) NULL,
    ADD COLUMN `lastName` VARCHAR(191) NOT NULL,
    ADD COLUMN `maritalStatus` VARCHAR(191) NULL,
    ADD COLUMN `medicalInsurance` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `middleName` VARCHAR(191) NOT NULL,
    ADD COLUMN `mobile` VARCHAR(191) NOT NULL,
    ADD COLUMN `occupation` VARCHAR(191) NULL,
    ADD COLUMN `primaryInsuranceHolderName` VARCHAR(191) NULL,
    ADD COLUMN `primaryInsuranceId` VARCHAR(191) NULL,
    ADD COLUMN `primaryInsuranceName` VARCHAR(191) NULL,
    ADD COLUMN `secondaryInsuranceHolderName` VARCHAR(191) NULL,
    ADD COLUMN `secondaryInsuranceId` VARCHAR(191) NULL,
    ADD COLUMN `secondaryInsuranceName` VARCHAR(191) NULL,
    ADD COLUMN `teamId` INTEGER NULL,
    ADD COLUMN `weight` VARCHAR(191) NULL,
    MODIFY `address` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `packages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `packages_name_key`(`name`),
    INDEX `packages_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `packageId` INTEGER NOT NULL,
    `serviceId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `qty` INTEGER NOT NULL,
    `rate` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `package_details_packageId_idx`(`packageId`),
    INDEX `package_details_serviceId_idx`(`serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_medicines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `packageId` INTEGER NOT NULL,
    `medicineId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `rate` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `package_medicines_packageId_idx`(`packageId`),
    INDEX `package_medicines_medicineId_idx`(`medicineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `patients_firstName_idx` ON `patients`(`firstName`);

-- CreateIndex
CREATE INDEX `patients_middleName_idx` ON `patients`(`middleName`);

-- CreateIndex
CREATE INDEX `patients_lastName_idx` ON `patients`(`lastName`);

-- CreateIndex
CREATE INDEX `patients_franchiseId_idx` ON `patients`(`franchiseId`);

-- CreateIndex
CREATE INDEX `patients_mobile_idx` ON `patients`(`mobile`);

-- AddForeignKey
ALTER TABLE `package_details` ADD CONSTRAINT `package_details_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_details` ADD CONSTRAINT `package_details_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_medicines` ADD CONSTRAINT `package_medicines_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_medicines` ADD CONSTRAINT `package_medicines_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
