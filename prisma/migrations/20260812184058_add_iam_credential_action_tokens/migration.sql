-- CreateEnum
CREATE TYPE "IamCredentialActionPurpose" AS ENUM ('PASSWORD_SETUP', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "IamCredentialActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "IamCredentialActionPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IamCredentialActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IamCredentialActionToken_tokenHash_key" ON "IamCredentialActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "IamCredentialActionToken_userId_purpose_idx" ON "IamCredentialActionToken"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "IamCredentialActionToken" ADD CONSTRAINT "IamCredentialActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "IamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
