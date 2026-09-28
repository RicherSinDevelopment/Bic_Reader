import {
  purchaseFailureMessage,
  shouldRestoreAfterPurchaseError,
} from '@/services/revenueCatPurchaseRecovery';

describe('RevenueCat purchase recovery', () => {
  test.each([
    '2', // STORE_PROBLEM_ERROR
    '6', // PRODUCT_ALREADY_PURCHASED_ERROR
    '7', // RECEIPT_ALREADY_IN_USE_ERROR
    '13', // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR
  ])('restores an existing receipt for recoverable error %s', (code) => {
    expect(shouldRestoreAfterPurchaseError(code)).toBe(true);
  });

  test('does not restore for an unrelated network failure', () => {
    expect(shouldRestoreAfterPurchaseError('10')).toBe(false);
  });

  test('guides existing subscribers to the restore action after a store problem', () => {
    expect(purchaseFailureMessage('2')).toContain(
      'Restore Purchases',
    );
  });
});
