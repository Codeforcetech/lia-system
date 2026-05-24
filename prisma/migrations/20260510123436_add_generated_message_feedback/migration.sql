-- CreateTable
CREATE TABLE "GeneratedMessageFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "generatedMessageId" TEXT,
    "selectedIndex" INTEGER,
    "aiOriginalText" TEXT NOT NULL,
    "finalAdoptedText" TEXT NOT NULL,
    "wasEdited" BOOLEAN NOT NULL DEFAULT false,
    "editDistance" INTEGER,
    "purpose" "MessagePurpose",
    "tone" "MessageTone",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedMessageFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedMessageFeedback_userId_idx" ON "GeneratedMessageFeedback"("userId");

-- CreateIndex
CREATE INDEX "GeneratedMessageFeedback_customerId_idx" ON "GeneratedMessageFeedback"("customerId");

-- CreateIndex
CREATE INDEX "GeneratedMessageFeedback_createdAt_idx" ON "GeneratedMessageFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "GeneratedMessageFeedback" ADD CONSTRAINT "GeneratedMessageFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMessageFeedback" ADD CONSTRAINT "GeneratedMessageFeedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMessageFeedback" ADD CONSTRAINT "GeneratedMessageFeedback_generatedMessageId_fkey" FOREIGN KEY ("generatedMessageId") REFERENCES "GeneratedMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
