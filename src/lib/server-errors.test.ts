import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportServerError, unexpectedErrorResponse } from './server-errors';

describe('controlled server errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ERROR-T003 logs only the approved schema and returns its correlation ID', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const errorId = reportServerError('document.get');

    expect(reportServerError).toHaveLength(1);
    expect(errorId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(log).toHaveBeenCalledTimes(1);
    const event = JSON.parse(String(log.mock.calls[0][0]));
    expect(Object.keys(event).sort()).toEqual(['errorId', 'event', 'level', 'timestamp']);
    expect(event).toMatchObject({ errorId, event: 'document.get', level: 'error' });
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
  });

  it('ERROR-T004 correlates a non-cacheable safe response with the log event', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = unexpectedErrorResponse('document.list', 'InternalServerError');
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Error-Id')).toBe(body.error.errorId);
    expect(body).toEqual({
      error: {
        code: 'InternalServerError',
        message: 'An unexpected error occurred',
        errorId: body.error.errorId,
      },
    });
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
      event: 'document.list',
      errorId: body.error.errorId,
    });
  });

});
