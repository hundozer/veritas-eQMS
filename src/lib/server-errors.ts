import { NextResponse } from 'next/server';

export type ServerErrorEvent =
  | 'audit.query'
  | 'audit.writeFailed'
  | 'auditPlan.list'
  | 'document.create'
  | 'document.approve'
  | 'document.delete'
  | 'document.get'
  | 'document.list'
  | 'document.pdf'
  | 'document.retrieveControlledObject'
  | 'document.review'
  | 'document.revision'
  | 'document.submitReview'
  | 'document.update'
  | 'equipment.get'
  | 'equipment.list'
  | 'notification.list'
  | 'supplier.get'
  | 'supplier.list'
  | 'storage.cleanupFailed'
  | 'training.list'
  | 'user.list';

export type ServerNoticeEvent =
  | 'regulatory.autoMapStub'
  | 'regulatory.batchImportStub'
  | 'regulatory.knowledgeBaseStub';

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

export function reportServerNotice(event: ServerNoticeEvent) {
  const eventId = crypto.randomUUID();
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    event,
    eventId,
  }));
  return eventId;
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
