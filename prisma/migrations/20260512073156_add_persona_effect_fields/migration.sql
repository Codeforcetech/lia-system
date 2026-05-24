-- AlterTable
ALTER TABLE "GeneratedMessageFeedback" ADD COLUMN     "adaptivePersonaApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "adaptivePersonaDirectiveCount" INTEGER,
ADD COLUMN     "adaptivePersonaTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "adaptivePersonaTone" TEXT;

-- CreateIndex
CREATE INDEX "GeneratedMessageFeedback_adaptivePersonaApplied_idx" ON "GeneratedMessageFeedback"("adaptivePersonaApplied");
