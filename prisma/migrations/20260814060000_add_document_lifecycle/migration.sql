ALTER TABLE "Document"
ADD COLUMN "documentNumber" TEXT,
ADD COLUMN "documentType" TEXT NOT NULL DEFAULT 'OTHER';

ALTER TABLE "DocumentVersion"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "effectiveDate" TIMESTAMP(3),
ADD COLUMN "changeSummary" TEXT,
ADD COLUMN "authoredById" TEXT;

ALTER TABLE "ApprovalRouteStep"
ADD COLUMN "stepType" TEXT NOT NULL DEFAULT 'APPROVAL',
ADD COLUMN "completedAt" TIMESTAMP(3);

-- Existing rows receive stable legacy identifiers without inspecting file content.
UPDATE "Document"
SET "documentNumber" = 'LEGACY-' || upper(substr(replace("id", '-', ''), 1, 8)),
    "documentType" = CASE
      WHEN upper("title") LIKE 'SOP-%' THEN 'SOP'
      WHEN upper("title") LIKE 'POL-%' THEN 'POLICY'
      WHEN upper("title") LIKE 'WI-%' THEN 'WORK_INSTRUCTION'
      WHEN upper("title") LIKE 'FRM-%' THEN 'FORM'
      ELSE 'OTHER'
    END
WHERE "documentNumber" IS NULL;

UPDATE "DocumentVersion" version
SET "authoredById" = document."ownerId",
    "status" = CASE
      WHEN version."versionNumber" = document."currentVersionNumber"
        AND document."status" IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'EFFECTIVE', 'SUPERSEDED', 'OBSOLETE')
        THEN document."status"
      WHEN version."versionNumber" < document."currentVersionNumber" THEN 'SUPERSEDED'
      ELSE 'DRAFT'
    END,
    "effectiveDate" = CASE WHEN document."status" = 'EFFECTIVE' THEN document."updatedAt" ELSE NULL END
FROM "Document" document
WHERE version."documentId" = document."id";

CREATE UNIQUE INDEX "Document_tenantId_documentNumber_key"
ON "Document"("tenantId", "documentNumber");

CREATE UNIQUE INDEX "DocumentVersion_one_effective_per_document_key"
ON "DocumentVersion"("documentId") WHERE "status" = 'EFFECTIVE';

ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_authoredById_fkey"
FOREIGN KEY ("authoredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
