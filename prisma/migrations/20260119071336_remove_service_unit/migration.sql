/*
  Warnings:

  - You are about to drop the column `unit` on the `services` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `services_unit_idx` ON `services`;

-- AlterTable
ALTER TABLE `services` DROP COLUMN `unit`;

-- CreateTable
CREATE TABLE `patients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientNo` VARCHAR(191) NOT NULL,
    `team` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `age` INTEGER NULL,
    `gender` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `address` VARCHAR(191) NULL,
    `stateId` INTEGER NOT NULL,
    `cityId` INTEGER NOT NULL,
    `pincode` VARCHAR(191) NULL,
    `mobile1` VARCHAR(191) NOT NULL,
    `mobile2` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactPersonRelation` VARCHAR(191) NULL,
    `contactPersonMobile1` VARCHAR(191) NULL,
    `contactPersonMobile2` VARCHAR(191) NULL,
    `balanceAmount` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `patients_patientNo_key`(`patientNo`),
    INDEX `patients_patientNo_idx`(`patientNo`),
    INDEX `patients_name_idx`(`name`),
    INDEX `patients_team_idx`(`team`),
    INDEX `patients_gender_idx`(`gender`),
    INDEX `patients_status_idx`(`status`),
    INDEX `patients_stateId_idx`(`stateId`),
    INDEX `patients_cityId_idx`(`cityId`),
    INDEX `patients_mobile1_idx`(`mobile1`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patient_sequences` (
    `dateKey` VARCHAR(191) NOT NULL,
    `lastNumber` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`dateKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
