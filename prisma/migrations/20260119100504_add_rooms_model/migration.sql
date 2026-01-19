/*
  Warnings:

  - You are about to drop the column `logoUrl` on the `franchises` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `services` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `services_unit_idx` ON `services`;

-- AlterTable
ALTER TABLE `franchises` DROP COLUMN `logoUrl`;

-- AlterTable
ALTER TABLE `services` DROP COLUMN `unit`;

-- CreateTable
CREATE TABLE `rooms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
