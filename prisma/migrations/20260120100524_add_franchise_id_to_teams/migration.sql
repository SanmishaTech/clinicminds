/*
  Warnings:

  - Added the required column `franchiseId` to the `teams` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `teams` ADD COLUMN `franchiseId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `teams_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
