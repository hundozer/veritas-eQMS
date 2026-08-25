import { reportServerNotice } from './server-errors';

export async function ensureEUGMPKnowledgeBaseSeeded() {
  reportServerNotice('regulatory.knowledgeBaseStub');
  return { success: true };
}

export const EUGMPKnowledgeBase = {
  getChapters: () => [],
  getSections: () => [],
  getRequirements: () => [],
  ensureEUGMPKnowledgeBaseSeeded,
};
