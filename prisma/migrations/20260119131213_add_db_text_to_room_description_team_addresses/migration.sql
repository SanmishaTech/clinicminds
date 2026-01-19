-- AlterTable
ALTER TABLE `rooms` MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `teams` MODIFY `addressLine1` TEXT NOT NULL,
    MODIFY `addressLine2` TEXT NULL;
