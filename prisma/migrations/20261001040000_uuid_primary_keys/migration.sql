-- Replace every numeric AUTO_INCREMENT id (and every foreign key that points at
-- one) with a UUID, keeping all existing rows and relationships.
--
-- Hand-written: Prisma cannot generate a data-preserving version of this change.
-- MySQL DDL is not transactional, so TAKE A BACKUP BEFORE APPLYING and apply it
-- with the API stopped. If a statement fails part-way, restore the backup rather
-- than re-running.
--
-- Existing rows get a UUIDv7-shaped value built from the migration time, the old
-- numeric id and 40 random bits, so ORDER BY id still returns them in their old
-- order and rows created afterwards (real UUIDv7) sort after them.
--
-- Certificate numbers keep their TTRI-<training>-<n> shape:
--   * TrainingSession.serialNo keeps the training's old numeric id and continues
--     counting from there (AUTO_INCREMENT).
--   * Certificate.serialNo is a running number per training. Existing certificates
--     keep the number they were issued with (the participant's old numeric id).

-- ── 1. Drop foreign keys ─────────────────────────────────────────────────────
ALTER TABLE `User` DROP FOREIGN KEY `User_departmentId_fkey`;
ALTER TABLE `User` DROP FOREIGN KEY `User_staffRoleId_fkey`;
ALTER TABLE `StaffRolePermission` DROP FOREIGN KEY `StaffRolePermission_staffRoleId_fkey`;
ALTER TABLE `StaffRolePermission` DROP FOREIGN KEY `StaffRolePermission_moduleId_fkey`;
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_userId_fkey`;
ALTER TABLE `TrainingSession` DROP FOREIGN KEY `TrainingSession_programId_fkey`;
ALTER TABLE `TrainerOnSession` DROP FOREIGN KEY `TrainerOnSession_userId_fkey`;
ALTER TABLE `TrainerOnSession` DROP FOREIGN KEY `TrainerOnSession_sessionId_fkey`;
ALTER TABLE `Enrollment` DROP FOREIGN KEY `Enrollment_userId_fkey`;
ALTER TABLE `Enrollment` DROP FOREIGN KEY `Enrollment_sessionId_fkey`;
ALTER TABLE `Certificate` DROP FOREIGN KEY `Certificate_userId_fkey`;
ALTER TABLE `Certificate` DROP FOREIGN KEY `Certificate_sessionId_fkey`;
ALTER TABLE `SessionAgendaItem` DROP FOREIGN KEY `SessionAgendaItem_sessionId_fkey`;
ALTER TABLE `SessionMaterial` DROP FOREIGN KEY `SessionMaterial_sessionId_fkey`;
ALTER TABLE `SessionAssessment` DROP FOREIGN KEY `SessionAssessment_sessionId_fkey`;
ALTER TABLE `AssessmentQuestion` DROP FOREIGN KEY `AssessmentQuestion_assessmentId_fkey`;
ALTER TABLE `QuestionOption` DROP FOREIGN KEY `QuestionOption_questionId_fkey`;
ALTER TABLE `SessionSurveyQuestion` DROP FOREIGN KEY `SessionSurveyQuestion_sessionId_fkey`;
ALTER TABLE `SurveyQuestionOption` DROP FOREIGN KEY `SurveyQuestionOption_questionId_fkey`;
ALTER TABLE `AssessmentResponse` DROP FOREIGN KEY `AssessmentResponse_enrollmentId_fkey`;
ALTER TABLE `AssessmentResponse` DROP FOREIGN KEY `AssessmentResponse_assessmentId_fkey`;
ALTER TABLE `AssessmentAnswer` DROP FOREIGN KEY `AssessmentAnswer_responseId_fkey`;
ALTER TABLE `AssessmentAnswer` DROP FOREIGN KEY `AssessmentAnswer_questionId_fkey`;
ALTER TABLE `SurveyResponse` DROP FOREIGN KEY `SurveyResponse_enrollmentId_fkey`;
ALTER TABLE `SurveyResponse` DROP FOREIGN KEY `SurveyResponse_sessionId_fkey`;
ALTER TABLE `SurveyAnswer` DROP FOREIGN KEY `SurveyAnswer_responseId_fkey`;
ALTER TABLE `SurveyAnswer` DROP FOREIGN KEY `SurveyAnswer_questionId_fkey`;

-- ── 2. Give every row its UUID ───────────────────────────────────────────────
ALTER TABLE `Department` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `Department` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `User` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `User` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `StaffRole` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `StaffRole` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `PermissionModule` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `PermissionModule` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `LoginAttempt` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `LoginAttempt` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `AuditLog` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `AuditLog` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `TrainingProgram` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `TrainingProgram` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `TrainingSession` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `TrainingSession` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `Enrollment` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `Enrollment` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `Certificate` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `Certificate` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `SessionAgendaItem` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `SessionAgendaItem` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `SessionMaterial` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `SessionMaterial` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `SessionAssessment` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `SessionAssessment` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `AssessmentQuestion` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `AssessmentQuestion` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `QuestionOption` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `QuestionOption` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `SessionSurveyQuestion` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `SessionSurveyQuestion` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `SurveyQuestionOption` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `SurveyQuestionOption` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `AssessmentResponse` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `AssessmentResponse` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `AssessmentAnswer` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `AssessmentAnswer` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `SurveyResponse` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `SurveyResponse` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));
ALTER TABLE `SurveyAnswer` ADD COLUMN `id_uuid` CHAR(36) NULL;
UPDATE `SurveyAnswer` SET `id_uuid` = CONCAT(INSERT(LPAD(LOWER(HEX(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000))), 12, '0'), 9, 0, '-'), '-7', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 1, 3), '-8', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 4, 3), '-', SUBSTR(LPAD(LOWER(HEX(`id`)), 8, '0'), 7, 2), LOWER(HEX(RANDOM_BYTES(5))));

-- ── 3. Point every foreign key at the new UUIDs ──────────────────────────────
ALTER TABLE `User` ADD COLUMN `departmentId_uuid` CHAR(36) NULL;
UPDATE `User` c JOIN `Department` p ON p.`id` = c.`departmentId` SET c.`departmentId_uuid` = p.`id_uuid`;
ALTER TABLE `User` ADD COLUMN `staffRoleId_uuid` CHAR(36) NULL;
UPDATE `User` c JOIN `StaffRole` p ON p.`id` = c.`staffRoleId` SET c.`staffRoleId_uuid` = p.`id_uuid`;
ALTER TABLE `StaffRolePermission` ADD COLUMN `staffRoleId_uuid` CHAR(36) NULL;
UPDATE `StaffRolePermission` c JOIN `StaffRole` p ON p.`id` = c.`staffRoleId` SET c.`staffRoleId_uuid` = p.`id_uuid`;
ALTER TABLE `StaffRolePermission` ADD COLUMN `moduleId_uuid` CHAR(36) NULL;
UPDATE `StaffRolePermission` c JOIN `PermissionModule` p ON p.`id` = c.`moduleId` SET c.`moduleId_uuid` = p.`id_uuid`;
ALTER TABLE `AuditLog` ADD COLUMN `userId_uuid` CHAR(36) NULL;
UPDATE `AuditLog` c JOIN `User` p ON p.`id` = c.`userId` SET c.`userId_uuid` = p.`id_uuid`;
ALTER TABLE `TrainingSession` ADD COLUMN `programId_uuid` CHAR(36) NULL;
UPDATE `TrainingSession` c JOIN `TrainingProgram` p ON p.`id` = c.`programId` SET c.`programId_uuid` = p.`id_uuid`;
ALTER TABLE `TrainerOnSession` ADD COLUMN `userId_uuid` CHAR(36) NULL;
UPDATE `TrainerOnSession` c JOIN `User` p ON p.`id` = c.`userId` SET c.`userId_uuid` = p.`id_uuid`;
ALTER TABLE `TrainerOnSession` ADD COLUMN `sessionId_uuid` CHAR(36) NULL;
UPDATE `TrainerOnSession` c JOIN `TrainingSession` p ON p.`id` = c.`sessionId` SET c.`sessionId_uuid` = p.`id_uuid`;
ALTER TABLE `Enrollment` ADD COLUMN `userId_uuid` CHAR(36) NULL;
UPDATE `Enrollment` c JOIN `User` p ON p.`id` = c.`userId` SET c.`userId_uuid` = p.`id_uuid`;
ALTER TABLE `Enrollment` ADD COLUMN `sessionId_uuid` CHAR(36) NULL;
UPDATE `Enrollment` c JOIN `TrainingSession` p ON p.`id` = c.`sessionId` SET c.`sessionId_uuid` = p.`id_uuid`;
ALTER TABLE `Certificate` ADD COLUMN `userId_uuid` CHAR(36) NULL;
UPDATE `Certificate` c JOIN `User` p ON p.`id` = c.`userId` SET c.`userId_uuid` = p.`id_uuid`;
ALTER TABLE `Certificate` ADD COLUMN `sessionId_uuid` CHAR(36) NULL;
UPDATE `Certificate` c JOIN `TrainingSession` p ON p.`id` = c.`sessionId` SET c.`sessionId_uuid` = p.`id_uuid`;
ALTER TABLE `SessionAgendaItem` ADD COLUMN `sessionId_uuid` CHAR(36) NULL;
UPDATE `SessionAgendaItem` c JOIN `TrainingSession` p ON p.`id` = c.`sessionId` SET c.`sessionId_uuid` = p.`id_uuid`;
ALTER TABLE `SessionMaterial` ADD COLUMN `sessionId_uuid` CHAR(36) NULL;
UPDATE `SessionMaterial` c JOIN `TrainingSession` p ON p.`id` = c.`sessionId` SET c.`sessionId_uuid` = p.`id_uuid`;
ALTER TABLE `SessionAssessment` ADD COLUMN `sessionId_uuid` CHAR(36) NULL;
UPDATE `SessionAssessment` c JOIN `TrainingSession` p ON p.`id` = c.`sessionId` SET c.`sessionId_uuid` = p.`id_uuid`;
ALTER TABLE `AssessmentQuestion` ADD COLUMN `assessmentId_uuid` CHAR(36) NULL;
UPDATE `AssessmentQuestion` c JOIN `SessionAssessment` p ON p.`id` = c.`assessmentId` SET c.`assessmentId_uuid` = p.`id_uuid`;
ALTER TABLE `QuestionOption` ADD COLUMN `questionId_uuid` CHAR(36) NULL;
UPDATE `QuestionOption` c JOIN `AssessmentQuestion` p ON p.`id` = c.`questionId` SET c.`questionId_uuid` = p.`id_uuid`;
ALTER TABLE `SessionSurveyQuestion` ADD COLUMN `sessionId_uuid` CHAR(36) NULL;
UPDATE `SessionSurveyQuestion` c JOIN `TrainingSession` p ON p.`id` = c.`sessionId` SET c.`sessionId_uuid` = p.`id_uuid`;
ALTER TABLE `SurveyQuestionOption` ADD COLUMN `questionId_uuid` CHAR(36) NULL;
UPDATE `SurveyQuestionOption` c JOIN `SessionSurveyQuestion` p ON p.`id` = c.`questionId` SET c.`questionId_uuid` = p.`id_uuid`;
ALTER TABLE `AssessmentResponse` ADD COLUMN `enrollmentId_uuid` CHAR(36) NULL;
UPDATE `AssessmentResponse` c JOIN `Enrollment` p ON p.`id` = c.`enrollmentId` SET c.`enrollmentId_uuid` = p.`id_uuid`;
ALTER TABLE `AssessmentResponse` ADD COLUMN `assessmentId_uuid` CHAR(36) NULL;
UPDATE `AssessmentResponse` c JOIN `SessionAssessment` p ON p.`id` = c.`assessmentId` SET c.`assessmentId_uuid` = p.`id_uuid`;
ALTER TABLE `AssessmentAnswer` ADD COLUMN `responseId_uuid` CHAR(36) NULL;
UPDATE `AssessmentAnswer` c JOIN `AssessmentResponse` p ON p.`id` = c.`responseId` SET c.`responseId_uuid` = p.`id_uuid`;
ALTER TABLE `AssessmentAnswer` ADD COLUMN `questionId_uuid` CHAR(36) NULL;
UPDATE `AssessmentAnswer` c JOIN `AssessmentQuestion` p ON p.`id` = c.`questionId` SET c.`questionId_uuid` = p.`id_uuid`;
ALTER TABLE `SurveyResponse` ADD COLUMN `enrollmentId_uuid` CHAR(36) NULL;
UPDATE `SurveyResponse` c JOIN `Enrollment` p ON p.`id` = c.`enrollmentId` SET c.`enrollmentId_uuid` = p.`id_uuid`;
ALTER TABLE `SurveyResponse` ADD COLUMN `sessionId_uuid` CHAR(36) NULL;
UPDATE `SurveyResponse` c JOIN `TrainingSession` p ON p.`id` = c.`sessionId` SET c.`sessionId_uuid` = p.`id_uuid`;
ALTER TABLE `SurveyAnswer` ADD COLUMN `responseId_uuid` CHAR(36) NULL;
UPDATE `SurveyAnswer` c JOIN `SurveyResponse` p ON p.`id` = c.`responseId` SET c.`responseId_uuid` = p.`id_uuid`;
ALTER TABLE `SurveyAnswer` ADD COLUMN `questionId_uuid` CHAR(36) NULL;
UPDATE `SurveyAnswer` c JOIN `SessionSurveyQuestion` p ON p.`id` = c.`questionId` SET c.`questionId_uuid` = p.`id_uuid`;

-- ── 4. Certificate running number (existing certificates keep their number) ──
ALTER TABLE `Certificate` ADD COLUMN `serialNo` INTEGER NULL;
UPDATE `Certificate` SET `serialNo` = `userId`;

-- ── 5. Swap the numeric columns for the UUID ones ────────────────────────────
ALTER TABLE `Department`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`);
ALTER TABLE `User`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `departmentId`,
    DROP COLUMN `staffRoleId`,
    CHANGE COLUMN `departmentId_uuid` `departmentId` CHAR(36) NULL,
    CHANGE COLUMN `staffRoleId_uuid` `staffRoleId` CHAR(36) NULL;
ALTER TABLE `StaffRole`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`);
ALTER TABLE `PermissionModule`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`);
ALTER TABLE `StaffRolePermission`
    DROP PRIMARY KEY,
    DROP COLUMN `staffRoleId`,
    DROP COLUMN `moduleId`,
    CHANGE COLUMN `staffRoleId_uuid` `staffRoleId` CHAR(36) NOT NULL,
    CHANGE COLUMN `moduleId_uuid` `moduleId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`staffRoleId`, `moduleId`);
ALTER TABLE `LoginAttempt`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`);
ALTER TABLE `AuditLog`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `userId`,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NULL;
ALTER TABLE `TrainingProgram`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`);
ALTER TABLE `TrainingSession`
    DROP PRIMARY KEY,
    CHANGE COLUMN `id` `serialNo` INTEGER NOT NULL AUTO_INCREMENT,
    ADD UNIQUE INDEX `TrainingSession_serialNo_key`(`serialNo`),
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `programId`,
    CHANGE COLUMN `programId_uuid` `programId` CHAR(36) NOT NULL;
ALTER TABLE `TrainerOnSession`
    DROP PRIMARY KEY,
    DROP COLUMN `userId`,
    DROP COLUMN `sessionId`,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NOT NULL,
    CHANGE COLUMN `sessionId_uuid` `sessionId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`userId`, `sessionId`);
ALTER TABLE `Enrollment`
    DROP INDEX `Enrollment_userId_sessionId_key`,
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `userId`,
    DROP COLUMN `sessionId`,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NOT NULL,
    CHANGE COLUMN `sessionId_uuid` `sessionId` CHAR(36) NOT NULL,
    ADD UNIQUE INDEX `Enrollment_userId_sessionId_key`(`userId`, `sessionId`);
ALTER TABLE `Certificate`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `userId`,
    DROP COLUMN `sessionId`,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NOT NULL,
    CHANGE COLUMN `sessionId_uuid` `sessionId` CHAR(36) NOT NULL,
    MODIFY COLUMN `serialNo` INTEGER NOT NULL,
    ADD UNIQUE INDEX `Certificate_userId_sessionId_key`(`userId`, `sessionId`),
    ADD UNIQUE INDEX `Certificate_sessionId_serialNo_key`(`sessionId`, `serialNo`);
ALTER TABLE `SessionAgendaItem`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `sessionId`,
    CHANGE COLUMN `sessionId_uuid` `sessionId` CHAR(36) NOT NULL;
ALTER TABLE `SessionMaterial`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `sessionId`,
    CHANGE COLUMN `sessionId_uuid` `sessionId` CHAR(36) NOT NULL;
ALTER TABLE `SessionAssessment`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `sessionId`,
    CHANGE COLUMN `sessionId_uuid` `sessionId` CHAR(36) NOT NULL;
ALTER TABLE `AssessmentQuestion`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `assessmentId`,
    CHANGE COLUMN `assessmentId_uuid` `assessmentId` CHAR(36) NOT NULL;
ALTER TABLE `QuestionOption`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `questionId`,
    CHANGE COLUMN `questionId_uuid` `questionId` CHAR(36) NOT NULL;
ALTER TABLE `SessionSurveyQuestion`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `sessionId`,
    CHANGE COLUMN `sessionId_uuid` `sessionId` CHAR(36) NOT NULL;
ALTER TABLE `SurveyQuestionOption`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `questionId`,
    CHANGE COLUMN `questionId_uuid` `questionId` CHAR(36) NOT NULL;
ALTER TABLE `AssessmentResponse`
    DROP INDEX `AssessmentResponse_enrollmentId_assessmentId_key`,
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `enrollmentId`,
    DROP COLUMN `assessmentId`,
    CHANGE COLUMN `enrollmentId_uuid` `enrollmentId` CHAR(36) NOT NULL,
    CHANGE COLUMN `assessmentId_uuid` `assessmentId` CHAR(36) NOT NULL,
    ADD UNIQUE INDEX `AssessmentResponse_enrollmentId_assessmentId_key`(`enrollmentId`, `assessmentId`);
ALTER TABLE `AssessmentAnswer`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `responseId`,
    DROP COLUMN `questionId`,
    CHANGE COLUMN `responseId_uuid` `responseId` CHAR(36) NOT NULL,
    CHANGE COLUMN `questionId_uuid` `questionId` CHAR(36) NOT NULL;
ALTER TABLE `SurveyResponse`
    DROP INDEX `SurveyResponse_enrollmentId_sessionId_key`,
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `enrollmentId`,
    DROP COLUMN `sessionId`,
    CHANGE COLUMN `enrollmentId_uuid` `enrollmentId` CHAR(36) NOT NULL,
    CHANGE COLUMN `sessionId_uuid` `sessionId` CHAR(36) NOT NULL,
    ADD UNIQUE INDEX `SurveyResponse_enrollmentId_sessionId_key`(`enrollmentId`, `sessionId`);
ALTER TABLE `SurveyAnswer`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL FIRST,
    ADD PRIMARY KEY (`id`),
    DROP COLUMN `responseId`,
    DROP COLUMN `questionId`,
    CHANGE COLUMN `responseId_uuid` `responseId` CHAR(36) NOT NULL,
    CHANGE COLUMN `questionId_uuid` `questionId` CHAR(36) NOT NULL;

-- ── 6. Re-create the foreign keys ────────────────────────────────────────────
ALTER TABLE `User` ADD CONSTRAINT `User_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `User` ADD CONSTRAINT `User_staffRoleId_fkey` FOREIGN KEY (`staffRoleId`) REFERENCES `StaffRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `StaffRolePermission` ADD CONSTRAINT `StaffRolePermission_staffRoleId_fkey` FOREIGN KEY (`staffRoleId`) REFERENCES `StaffRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `StaffRolePermission` ADD CONSTRAINT `StaffRolePermission_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `PermissionModule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TrainingSession` ADD CONSTRAINT `TrainingSession_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `TrainingProgram`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TrainerOnSession` ADD CONSTRAINT `TrainerOnSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TrainerOnSession` ADD CONSTRAINT `TrainerOnSession_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TrainingSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TrainingSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Certificate` ADD CONSTRAINT `Certificate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Certificate` ADD CONSTRAINT `Certificate_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TrainingSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SessionAgendaItem` ADD CONSTRAINT `SessionAgendaItem_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TrainingSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SessionMaterial` ADD CONSTRAINT `SessionMaterial_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TrainingSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SessionAssessment` ADD CONSTRAINT `SessionAssessment_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TrainingSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssessmentQuestion` ADD CONSTRAINT `AssessmentQuestion_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `SessionAssessment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QuestionOption` ADD CONSTRAINT `QuestionOption_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `AssessmentQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SessionSurveyQuestion` ADD CONSTRAINT `SessionSurveyQuestion_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TrainingSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SurveyQuestionOption` ADD CONSTRAINT `SurveyQuestionOption_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `SessionSurveyQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssessmentResponse` ADD CONSTRAINT `AssessmentResponse_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssessmentResponse` ADD CONSTRAINT `AssessmentResponse_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `SessionAssessment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssessmentAnswer` ADD CONSTRAINT `AssessmentAnswer_responseId_fkey` FOREIGN KEY (`responseId`) REFERENCES `AssessmentResponse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssessmentAnswer` ADD CONSTRAINT `AssessmentAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `AssessmentQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TrainingSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SurveyAnswer` ADD CONSTRAINT `SurveyAnswer_responseId_fkey` FOREIGN KEY (`responseId`) REFERENCES `SurveyResponse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SurveyAnswer` ADD CONSTRAINT `SurveyAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `SessionSurveyQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
