import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from './db';
import { logSecurityEventBestEffort, type UserContext } from './auth';
import { writeMandatoryAudit } from './audit';
import { verifyPassword } from './iam/password';

// Electronic signatures (DEC-062). The signer re-enters their own password; the
// signature records who signed, as they were at that moment, what the signature
// means, and the SHA-256 of the exact content signed. Signature rows are
// append-only in the database.

export const SIGNATURE_MEANINGS = {
  REVIEWED: 'Reviewed',
  APPROVED: 'Approved',
} as const;

export type SignatureMeaning = keyof typeof SIGNATURE_MEANINGS;

const SIGNATURE_FAILURE_MESSAGES = {
  PASSWORD_REQUIRED: 'Your password is required to sign',
  PASSWORD_MISMATCH: 'The password did not match; nothing was signed',
} as const;

export class SignatureError extends Error {
  constructor(readonly reason: keyof typeof SIGNATURE_FAILURE_MESSAGES) {
    super(SIGNATURE_FAILURE_MESSAGES[reason]);
    this.name = 'SignatureError';
  }
}

export function signatureFailedResponse(failure: SignatureError) {
  return NextResponse.json(
    { error: { code: 'SignatureFailed', message: SIGNATURE_FAILURE_MESSAGES[failure.reason] } },
    { status: 403 },
  );
}

/** Confirms that the signed-in person, and nobody else, is signing. */
export async function verifySignerPassword(context: UserContext, password: unknown): Promise<void> {
  if (typeof password !== 'string' || !password) {
    throw new SignatureError('PASSWORD_REQUIRED');
  }
  const signer = await prisma.iamUser.findUnique({
    where: { id: context.iamUserId },
    select: { passwordHash: true, accountStatus: true },
  });
  if (!signer || signer.accountStatus !== 'ACTIVE' || !(await verifyPassword(password, signer.passwordHash))) {
    throw new SignatureError('PASSWORD_MISMATCH');
  }
}

/** Verifies the signer's password and leaves an audit trace of every failed attempt. */
export async function verifySignerOrRecordFailure(
  context: UserContext,
  password: unknown,
  versionId: string,
  request: { headers: Headers; nextUrl: { pathname: string } },
): Promise<void> {
  try {
    await verifySignerPassword(context, password);
  } catch (error) {
    if (error instanceof SignatureError) {
      await logSecurityEventBestEffort({
        tenantId: context.tenantId,
        userId: context.id,
        userEmail: context.email,
        userRole: context.membershipRole,
        action: 'SIGNATURE_FAILED',
        objectType: 'DocumentVersion',
        objectId: versionId,
        payload: { reason: error.reason },
        status: 'Failed',
        sourceIp: clientIp(request.headers) ?? undefined,
        requestUrl: request.nextUrl.pathname,
      });
    }
    throw error;
  }
}

/** Records a signature and its audit row inside the caller's tenant transaction. */
export async function recordSignature(
  tx: Prisma.TransactionClient,
  input: {
    context: UserContext;
    version: { id: string; documentId: string; versionNumber: number; hash: string };
    meaning: SignatureMeaning;
    comment?: string | null;
    sourceIp?: string | null;
    requestUrl?: string;
  },
) {
  const { context, version, meaning } = input;
  const signature = await tx.signatureManifest.create({
    data: {
      documentVersionId: version.id,
      tenantId: context.tenantId,
      signedBy: context.id,
      iamUserId: context.iamUserId,
      membershipId: context.membershipId,
      signerName: context.fullName,
      signerRole: context.membershipRole,
      meaning,
      hashSigned: version.hash,
      ipAddress: input.sourceIp || 'unknown',
      comment: input.comment || null,
    },
  });
  await writeMandatoryAudit(tx, {
    context,
    action: 'SIGNATURE_APPLIED',
    objectType: 'DocumentVersion',
    objectId: version.id,
    payload: {
      signatureId: signature.id,
      documentId: version.documentId,
      version: version.versionNumber,
      meaning,
      hashSigned: version.hash,
      signerName: context.fullName,
      signerRole: context.membershipRole,
    },
    sourceIp: input.sourceIp ?? undefined,
    requestUrl: input.requestUrl,
  });
  return signature;
}

export function clientIp(headers: Headers): string | null {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}
