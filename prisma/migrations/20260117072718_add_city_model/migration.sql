/*
  Warnings:

  - You are about to drop the `companies` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[city,stateId]` on the table `cities` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `companies` DROP FOREIGN KEY `companies_cityId_fkey`;

-- DropIndex
DROP INDEX `cities_city_key` ON `cities`;

-- AlterTable
ALTER TABLE `cities` ADD COLUMN `stateId` INTEGER NULL;

-- AlterTable
ALTER TABLE `services` MODIFY `description` TEXT NULL;

-- DropTable
DROP TABLE `companies`;

-- CreateIndex
CREATE INDEX `cities_stateId_idx` ON `cities`(`stateId`);

-- CreateIndex
CREATE UNIQUE INDEX `cities_city_stateId_key` ON `cities`(`city`, `stateId`);

-- AddForeignKey
ALTER TABLE `cities` ADD CONSTRAINT `cities_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
