/*
  Warnings:

  - You are about to drop the column `userName` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `users` DROP COLUMN `userName`,
    ADD COLUMN `name` VARCHAR(191) NULL,
    MODIFY `password` VARCHAR(191) NULL;
