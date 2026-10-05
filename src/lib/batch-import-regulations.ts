import { reportServerNotice } from './server-errors';

export async function batchImportRegulations() {
  reportServerNotice('regulatory.batchImportStub');
  return { success: true };
}
