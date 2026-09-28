const RESTORABLE_PURCHASE_ERRORS = new Set<string>([
  '2', // STORE_PROBLEM_ERROR (Apple can use this after its already-subscribed sheet)
  '6', // PRODUCT_ALREADY_PURCHASED_ERROR
  '7', // RECEIPT_ALREADY_IN_USE_ERROR
  '13', // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR
]);

export function shouldRestoreAfterPurchaseError(code: string | undefined) {
  return Boolean(code && RESTORABLE_PURCHASE_ERRORS.has(code));
}

export function purchaseFailureMessage(code: string | undefined) {
  if (code === '2') { // STORE_PROBLEM_ERROR
    return 'The App Store could not complete the purchase. If you already subscribe, use Restore Purchases below.';
  }

  return "We couldn't complete the purchase. Please try again.";
}
