-- AlterTable
ALTER TABLE `User` ADD COLUMN `username` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Account_userId_idx` ON `Account`(`userId`);

-- CreateIndex
CREATE INDEX `Session_userId_idx` ON `Session`(`userId`);
