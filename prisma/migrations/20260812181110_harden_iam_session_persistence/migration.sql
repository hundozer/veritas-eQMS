/*
  Warnings:

  - You are about to drop the column `isActive` on the `IamSession` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `IamSession` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tokenHash]` on the table `IamSession` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiresAt` to the `IamSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `membershipId` to the `IamSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenHash` to the `IamSession` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "IamSession_refreshToken_key";

-- AlterTable
ALTER TABLE "IamSession" DROP COLUMN "isActive",
DROP COLUMN "refreshToken",
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "membershipId" TEXT NOT NULL,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "IamSession_tokenHash_key" ON "IamSession"("tokenHash");

-- AddForeignKey
ALTER TABLE "IamSession" ADD CONSTRAINT "IamSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "IamMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
