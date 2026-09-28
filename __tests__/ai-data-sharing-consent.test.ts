const mockGetItemSync = jest.fn();
const mockSetItemSync = jest.fn();

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: mockGetItemSync, setItemSync: mockSetItemSync },
}));

describe('AI data sharing consent', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetItemSync.mockReset();
    mockSetItemSync.mockReset();
  });

  it('defaults to unset when no decision is stored', () => {
    mockGetItemSync.mockReturnValue(null);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAIDataSharingStore } = require('@/stores/aiDataSharingStore');

    expect(useAIDataSharingStore.getState().consent).toBe('unset');
  });

  it('restores a previously allowed decision', () => {
    mockGetItemSync.mockReturnValue('allowed');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAIDataSharingStore } = require('@/stores/aiDataSharingStore');

    expect(useAIDataSharingStore.getState().consent).toBe('allowed');
  });

  it('persists consent changes on this device', () => {
    mockGetItemSync.mockReturnValue(null);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAIDataSharingStore } = require('@/stores/aiDataSharingStore');
    useAIDataSharingStore.getState().setConsent('denied');

    expect(mockSetItemSync).toHaveBeenCalledWith(
      'bic-reader-ai-data-sharing-consent-v1',
      'denied',
    );
    expect(useAIDataSharingStore.getState().consent).toBe('denied');
  });
});
