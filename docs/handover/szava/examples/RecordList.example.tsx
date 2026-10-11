// EXAMPLE (type-checked, not shipped): a record list page body built only from
// shared paper components. Loading, failure and empty are distinct states;
// the create button is shown only to holders of the create permission.
'use client';
import { useEffect, useState } from 'react';
import { Button, EmptyState, formatDate, Ledger, Mono, Note, Notice, PageIntro, Stamp } from '@/ui/paper';

interface ChangeRow { id: string; title: string; riskLevel: string; status: string; createdAt: string }

export default function ChangeRegister({ permissions, onOpen, onCreate }: {
  permissions: readonly string[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [rows, setRows] = useState<ChangeRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const canCreate = permissions.includes('change.create');

  useEffect(() => {
    fetch('/api/change-requests')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setRows((await res.json()).changes);
        setStatus('ready');
      })
      .catch(() => setStatus('failed'));
  }, []);

  return (
    <div>
      <PageIntro
        title="Change control register"
        lede={status === 'ready' ? `${rows.length} change control${rows.length === 1 ? '' : 's'}, newest first.` : undefined}
        actions={canCreate && <Button onClick={onCreate}>New change control</Button>}
      />
      {status === 'loading' && <Note>Loading change controls…</Note>}
      {status === 'failed' && <Notice tone="error">The register could not be loaded. Reload the page; if it persists, tell your administrator.</Notice>}
      {status === 'ready' && rows.length === 0 && (
        <EmptyState>No change controls yet. {canCreate ? 'Start one when a controlled document, process or system needs to change.' : 'They appear here once someone raises one.'}</EmptyState>
      )}
      {status === 'ready' && rows.length > 0 && (
        <Ledger caption="Change controls">
          <thead>
            <tr><th scope="col">Title</th><th scope="col">Risk</th><th scope="col">State</th><th scope="col">Raised</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><button type="button" onClick={() => onOpen(row.id)}>{row.title}</button></td>
                <td>{row.riskLevel}</td>
                <td><Stamp state={row.status} /></td>
                <td><Mono>{formatDate(row.createdAt)}</Mono></td>
              </tr>
            ))}
          </tbody>
        </Ledger>
      )}
    </div>
  );
}
