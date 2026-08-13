-- Establish explicit IAM-organization-to-QMS-tenant and membership-to-QMS-user
-- relationships. Email is used only for this deterministic one-time backfill.
ALTER TABLE "IamOrganization" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "IamMembership" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "IamMembership" ADD COLUMN "operationalUserId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT organization."id"
    FROM "IamOrganization" AS organization
    LEFT JOIN "IamMembership" AS membership
      ON membership."organizationId" = organization."id"
    LEFT JOIN "IamUser" AS iam_user ON iam_user."id" = membership."userId"
    LEFT JOIN "User" AS operational_user
      ON lower(operational_user."email") = lower(iam_user."email")
    GROUP BY organization."id"
    HAVING count(DISTINCT operational_user."tenantId") <> 1
  ) THEN
    RAISE EXCEPTION 'Cannot establish exactly one QMS tenant linkage for every IAM organization';
  END IF;
END $$;

UPDATE "IamOrganization" AS organization
SET "tenantId" = candidate."tenantId"
FROM (
  SELECT membership."organizationId", min(operational_user."tenantId") AS "tenantId"
  FROM "IamMembership" AS membership
  JOIN "IamUser" AS iam_user ON iam_user."id" = membership."userId"
  JOIN "User" AS operational_user
    ON lower(operational_user."email") = lower(iam_user."email")
  GROUP BY membership."organizationId"
) AS candidate
WHERE candidate."organizationId" = organization."id";

UPDATE "IamMembership" AS membership
SET "tenantId" = organization."tenantId"
FROM "IamOrganization" AS organization
WHERE organization."id" = membership."organizationId";

DO $$
BEGIN
  IF EXISTS (
    SELECT membership."id"
    FROM "IamMembership" AS membership
    JOIN "IamUser" AS iam_user ON iam_user."id" = membership."userId"
    LEFT JOIN "User" AS operational_user
      ON lower(operational_user."email") = lower(iam_user."email")
     AND operational_user."tenantId" = membership."tenantId"
    GROUP BY membership."id"
    HAVING count(operational_user."id") <> 1
  ) THEN
    RAISE EXCEPTION 'Cannot establish exactly one operational-user linkage for every IAM membership';
  END IF;
END $$;

UPDATE "IamMembership" AS membership
SET "operationalUserId" = operational_user."id"
FROM "IamUser" AS iam_user
JOIN "User" AS operational_user
  ON lower(operational_user."email") = lower(iam_user."email")
WHERE membership."userId" = iam_user."id"
  AND operational_user."tenantId" = membership."tenantId";

ALTER TABLE "IamOrganization" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "IamMembership" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "IamMembership" ALTER COLUMN "operationalUserId" SET NOT NULL;

CREATE UNIQUE INDEX "User_id_tenantId_key" ON "User"("id", "tenantId");
CREATE UNIQUE INDEX "IamOrganization_tenantId_key" ON "IamOrganization"("tenantId");
CREATE UNIQUE INDEX "IamOrganization_id_tenantId_key" ON "IamOrganization"("id", "tenantId");
CREATE UNIQUE INDEX "IamMembership_operationalUserId_tenantId_key"
ON "IamMembership"("operationalUserId", "tenantId");

ALTER TABLE "IamOrganization"
ADD CONSTRAINT "IamOrganization_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IamMembership" DROP CONSTRAINT "IamMembership_organizationId_fkey";

ALTER TABLE "IamMembership"
ADD CONSTRAINT "IamMembership_organizationId_tenantId_fkey"
FOREIGN KEY ("organizationId", "tenantId")
REFERENCES "IamOrganization"("id", "tenantId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamMembership"
ADD CONSTRAINT "IamMembership_operationalUserId_tenantId_fkey"
FOREIGN KEY ("operationalUserId", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
