/*
  Warnings:

  - You are about to drop the column `contactEmail` on the `teams` table. All the data in the column will be lost.
  - You are about to drop the column `contactNo` on the `teams` table. All the data in the column will be lost.
  - Made the column `addressLine1` on table `teams` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX `teams_contactEmail_idx` ON `teams`;

-- DropIndex
DROP INDEX `teams_contactNo_idx` ON `teams`;

-- DropIndex
DROP INDEX `teams_name_idx` ON `teams`;

-- AlterTable
ALTER TABLE `teams` DROP COLUMN `contactEmail`,
    DROP COLUMN `contactNo`,
    MODIFY `joiningDate` DATETIME(3) NULL,
    MODIFY `addressLine1` VARCHAR(191) NOT NULL;
