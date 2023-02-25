/*
  Warnings:

  - A unique constraint covering the columns `[session_token]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `accounts_user_id_idx` ON `accounts`;

-- DropIndex
DROP INDEX `sessions_session_token_key` ON `sessions`;

-- AlterTable
ALTER TABLE `sessions` MODIFY `session_token` TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `sessions_session_token_key` ON `sessions`(`session_token`(191));

-- CreateIndex
CREATE INDEX `sessions_user_id_idx` ON `sessions`(`user_id`);
