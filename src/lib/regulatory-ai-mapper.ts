import { reportServerNotice } from './server-errors';

export async function autoMapDeviationAndCreateCapa(deviationId: string, userContext?: any) {
  reportServerNotice('regulatory.autoMapStub');
  return { success: true };
}

export const RegulatoryAIMapper = {
  suggestMappings: () => [],
  mapRequirement: () => ({ success: true }),
  autoMapDeviationAndCreateCapa,
};
