-- AlterTable
ALTER TABLE `TrainingProgram` ADD COLUMN `titleKh` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL;

-- CreateTable
CREATE TABLE `TrainingCategory` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKh` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TrainingCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill: every distinct category already used by a TrainingProgram becomes
-- a selectable category row, so existing programs keep a matching option.
-- De-duplicate in a subquery first: DISTINCT next to UUID() would keep every
-- row, since each UUID() is different.
INSERT INTO `TrainingCategory` (`id`, `name`, `nameKh`)
SELECT UUID(), `c`.`category`, NULL
FROM (
    SELECT DISTINCT `category` FROM `TrainingProgram`
    WHERE `category` IS NOT NULL AND `category` <> ''
) AS `c`;
