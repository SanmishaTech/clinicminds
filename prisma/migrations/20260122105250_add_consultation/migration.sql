-- DropForeignKey
ALTER TABLE `patients` DROP FOREIGN KEY `patients_cityId_fkey`;

-- DropForeignKey
ALTER TABLE `patients` DROP FOREIGN KEY `patients_stateId_fkey`;

-- AlterTable
ALTER TABLE `patients` ADD COLUMN `referedBy` VARCHAR(191) NULL,
    MODIFY `gender` VARCHAR(191) NULL,
    MODIFY `address` TEXT NULL,
    MODIFY `stateId` INTEGER NULL,
    MODIFY `cityId` INTEGER NULL,
    MODIFY `aadharNo` VARCHAR(191) NULL,
    MODIFY `bloodGroup` VARCHAR(191) NULL,
    MODIFY `middleName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `patient_medical_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `reasonForVisit` TEXT NULL,
    `heardAboutUs` TEXT NULL,
    `pharmacyName` TEXT NULL,
    `pharmacyLocation` TEXT NULL,
    `diet` TEXT NULL,
    `smokes` BOOLEAN NOT NULL DEFAULT false,
    `smokingUnitsPerDay` TEXT NULL,
    `drinksAlcohol` BOOLEAN NOT NULL DEFAULT false,
    `alcoholHowMuch` TEXT NULL,
    `alcoholFrequency` TEXT NULL,
    `hasCurrentMedications` BOOLEAN NOT NULL DEFAULT false,
    `currentMedications` JSON NULL,
    `hasMedicationAllergies` BOOLEAN NOT NULL DEFAULT false,
    `otherAllergies` TEXT NULL,
    `hadAllergyTest` BOOLEAN NOT NULL DEFAULT false,
    `allergyTestDetails` TEXT NULL,
    `medicalHistory` JSON NULL,
    `medicalHistoryOther` TEXT NULL,
    `hasSurgicalHistory` BOOLEAN NOT NULL DEFAULT false,
    `surgicalHistory` JSON NULL,
    `familyHistory` JSON NULL,
    `familyHistoryOther` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `patient_medical_histories_patientId_key`(`patientId`),
    INDEX `patient_medical_histories_patientId_idx`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `franchiseId` INTEGER NOT NULL,
    `patientId` INTEGER NOT NULL,
    `appointmentDateTime` DATETIME(3) NOT NULL,
    `teamId` INTEGER NOT NULL,
    `visitPurpose` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Consultation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `appointmentId` INTEGER NOT NULL,
    `complaint` TEXT NULL,
    `remarks` TEXT NULL,
    `diagnosis` TEXT NULL,
    `casePaperUrl` VARCHAR(191) NULL,
    `nextFollowUpDate` DATETIME(3) NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Consultation_appointmentId_key`(`appointmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsultationDetail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultationId` INTEGER NOT NULL,
    `serviceId` INTEGER NULL,
    `description` TEXT NULL,
    `qty` INTEGER NOT NULL,
    `rate` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsultationMedicine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultationId` INTEGER NOT NULL,
    `medicineId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `mrp` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `doses` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patient_medical_histories` ADD CONSTRAINT `patient_medical_histories_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_franchiseId_fkey` FOREIGN KEY (`franchiseId`) REFERENCES `franchises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationDetail` ADD CONSTRAINT `ConsultationDetail_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationDetail` ADD CONSTRAINT `ConsultationDetail_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationMedicine` ADD CONSTRAINT `ConsultationMedicine_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationMedicine` ADD CONSTRAINT `ConsultationMedicine_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
