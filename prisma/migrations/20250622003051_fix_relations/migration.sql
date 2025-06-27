/*
  Warnings:

  - The primary key for the `Giveaway` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `twitchId` on the `Giveaway` table. All the data in the column will be lost.
  - The `id` column on the `Giveaway` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `giveawayId` on the `Entry` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `userId` to the `Giveaway` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastLoginAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Entry" DROP CONSTRAINT "Entry_giveawayId_fkey";

-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "giveawayId",
ADD COLUMN     "giveawayId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Giveaway" DROP CONSTRAINT "Giveaway_pkey",
DROP COLUMN "twitchId",
ADD COLUMN     "userId" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "command" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Entry_giveawayId_username_key" ON "Entry"("giveawayId", "username");

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
