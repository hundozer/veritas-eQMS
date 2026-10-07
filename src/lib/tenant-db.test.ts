import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeRaw, transaction } = vi.hoisted(() => {
  const executeRaw = vi.fn();
  const transaction = vi.fn(async (work: (tx: unknown) => unknown) => work({ $executeRaw: executeRaw }));
  return { executeRaw, transaction };
});
vi.mock('./db', () => ({ default: { $transaction: transaction } }));

import { tenantRead, tenantTransaction } from './tenant-db';

describe('tenant database helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TENANTDB-T001 sets the tenant inside the transaction before running the work', async () => {
    const order: string[] = [];
    executeRaw.mockImplementation(async () => { order.push('set'); });

    const result = await tenantRead('tenant-a', async () => { order.push('work'); return 'rows'; });

    expect(result).toBe('rows');
    expect(order).toEqual(['set', 'work']);
    expect(executeRaw.mock.calls[0].slice(1)).toEqual(['tenant-a']);
  });

  it('TENANTDB-T002 refuses to run without a tenant', async () => {
    for (const tenantId of ['', '  ', undefined as unknown as string]) {
      await expect(tenantTransaction(tenantId, async () => 'never')).rejects.toThrow('Tenant context is required');
    }
    expect(transaction).not.toHaveBeenCalled();
  });
});
