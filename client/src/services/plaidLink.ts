// Plaid Link on phones: not wired up yet. It needs react-native-plaid-link-sdk and a
// development build (PLAID.md, step 4). Until then phones keep the demo banks.
// The website version is plaidLink.web.ts; Expo picks the right file per platform.

export type PlaidConnect = {
  /** False where Plaid Link can't open yet. */
  available: boolean;
  start: () => void;
  loading: boolean;
};

export function usePlaidConnect(_onSuccess: (publicToken: string) => void, _onError: (message: string) => void): PlaidConnect {
  return { available: false, start: () => {}, loading: false };
}
