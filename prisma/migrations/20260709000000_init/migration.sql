CREATE TABLE "AppState" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "ExportedFile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "generatedResumeId" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportedFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExportedFile_userId_idx" ON "ExportedFile"("userId");
CREATE INDEX "ExportedFile_generatedResumeId_idx" ON "ExportedFile"("generatedResumeId");
