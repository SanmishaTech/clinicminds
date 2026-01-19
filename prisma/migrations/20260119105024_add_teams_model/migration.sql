-- CreateTable
CREATE TABLE `teams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `joiningDate` DATETIME(3) NOT NULL,
    `leavingDate` DATETIME(3) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `pincode` VARCHAR(191) NOT NULL,
    `contactNo` VARCHAR(191) NOT NULL,
    `contactEmail` VARCHAR(191) NOT NULL,
    `userMobile` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `teams_userId_key`(`userId`),
    INDEX `teams_name_idx`(`name`),
    INDEX `teams_city_idx`(`city`),
    INDEX `teams_state_idx`(`state`),
    INDEX `teams_contactNo_idx`(`contactNo`),
    INDEX `teams_contactEmail_idx`(`contactEmail`),
    INDEX `teams_userMobile_idx`(`userMobile`),
    INDEX `teams_joiningDate_idx`(`joiningDate`),
    INDEX `teams_leavingDate_idx`(`leavingDate`),
    INDEX `teams_createdAt_idx`(`createdAt`),
    INDEX `teams_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `teams_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
