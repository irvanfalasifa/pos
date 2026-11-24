-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginEvent_email_createdAt_idx" ON "LoginEvent"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_userId_idx" ON "LoginEvent"("userId");
