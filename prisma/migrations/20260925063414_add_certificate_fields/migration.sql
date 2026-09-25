-- AlterTable
ALTER TABLE `TrainingSession` ADD COLUMN `batchNo` INTEGER NULL,
    ADD COLUMN `organizersEn` TEXT NULL,
    ADD COLUMN `organizersKh` TEXT NULL,
    ADD COLUMN `titleKh` VARCHAR(191) NULL;
