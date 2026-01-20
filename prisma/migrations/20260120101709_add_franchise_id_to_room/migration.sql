/*
  Warnings:

  - Added the required column `franchiseId` to the `rooms` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `rooms` ADD COLUMN `franchiseId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
