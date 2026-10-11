import { afterEach, describe, expect, it, vi } from 'vitest';
import DesignSystemPage from './page';

// The gate is what is under test; the showcase itself renders in the browser.
vi.mock('./Showcase', () => ({ default: () => null }));

describe('component showcase', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('DS-T020 production builds answer 404 for the showcase', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => DesignSystemPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it('DS-T021 development renders the showcase', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(DesignSystemPage()).toBeTruthy();
  });
});
