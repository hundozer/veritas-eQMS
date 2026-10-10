import { NextResponse } from 'next/server';

export type ServerErrorEvent =
  | 'audit.export'
  | 'audit.query'
  | 'audit.writeFailed'
  | 'auth.setupPassword'
  | 'document.create'
  | 'document.approve'
  | 'document.delete'
  | 'document.get'
  | 'document.list'
  | 'document.pdf'
  | 'document.release'
  | 'document.retrieveControlledObject'
  | 'document.review'
  | 'document.revision'
  | 'document.submitReview'
  | 'document.update'
  | 'document.upload'
  | 'document.withdrawRevision'
  | 'notification.list'
  | 'storage.cleanupFailed'
  | 'training.list'
  | 'training.sign'
  | 'user.invite'
  | 'user.list'
  | 'user.resendInvitation'
  | 'role.list';

export function reportServerError(event: ServerErrorEvent) {
  const errorId = crypto.randomUUID();
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    event,
    errorId,
  }));
  return errorId;
}

export function unexpectedErrorResponse(
  event: ServerErrorEvent,
  code: 'InternalError' | 'InternalServerError' = 'InternalError',
) {
  const errorId = reportServerError(event);
  return NextResponse.json(
    { error: { code, message: 'An unexpected error occurred', errorId } },
    {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'X-Error-Id': errorId,
      },
    },
  );
}
