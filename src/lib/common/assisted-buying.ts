/** Cookie set briefly after assisted buying so NextAuth can complete sign-in. */
export const ASSISTED_BUYING_PENDING_COOKIE = 'ab-auth-pending';

/** Value passed as the `assistedBuying` credential to the Credentials provider. */
export const ASSISTED_BUYING_CREDENTIAL_FLAG = 'assisted-buying';

/** How long the pending cookie remains valid (seconds). */
export const ASSISTED_BUYING_PENDING_MAX_AGE_SECONDS = 60;

/** Query flag: server processed tokens but NextAuth sign-in still needed (client fallback). */
export const ASSISTED_BUYING_SIGN_IN_PARAM = 'abSignIn';

/** Same-request flag: `cookies().set()` for the pending cookie is not readable until the next request. */
const assistedBuyingSignInPending = new Set<string>();
const ASSISTED_BUYING_SIGN_IN_PENDING_KEY = 'default';

export function markAssistedBuyingSignInPending(): void {
  assistedBuyingSignInPending.add(ASSISTED_BUYING_SIGN_IN_PENDING_KEY);
}

export function isAssistedBuyingSignInPending(): boolean {
  return assistedBuyingSignInPending.has(ASSISTED_BUYING_SIGN_IN_PENDING_KEY);
}

export function consumeAssistedBuyingSignInPending(): boolean {
  if (assistedBuyingSignInPending.has(ASSISTED_BUYING_SIGN_IN_PENDING_KEY)) {
    assistedBuyingSignInPending.delete(ASSISTED_BUYING_SIGN_IN_PENDING_KEY);
    return true;
  }
  return false;
}

export const ASSISTED_BUYING_URL_PARAMS = {
  accessToken: 'customerToken',
  expiresIn: 'customerTokenExpiresIn',
  saasToken: 'saasToken',
} as const;

/** Alternate query names seen in API responses or older integrations. */
const ASSISTED_BUYING_ACCESS_TOKEN_KEYS = ['customerToken', 'accessToken', 'customer_token'] as const;
const ASSISTED_BUYING_EXPIRES_IN_KEYS = ['customerTokenExpiresIn', 'expiresIn'] as const;
const ASSISTED_BUYING_SAAS_TOKEN_KEYS = ['saasToken', 'saas_token'] as const;

export const ASSISTED_BUYING_TOKEN_PARAM_NAMES: readonly string[] = [
  ...ASSISTED_BUYING_ACCESS_TOKEN_KEYS,
  ...ASSISTED_BUYING_EXPIRES_IN_KEYS,
  ...ASSISTED_BUYING_SAAS_TOKEN_KEYS,
];

export type AssistedBuyingTokenPayload = {
  accessToken: string;
  expiresIn: number;
  saasToken: string;
};

function getFirstSearchParam(searchParams: URLSearchParams, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = searchParams.get(key)?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

export function parseAssistedBuyingTokenParams(searchParams: URLSearchParams): AssistedBuyingTokenPayload | null {
  const accessToken = getFirstSearchParam(searchParams, ASSISTED_BUYING_ACCESS_TOKEN_KEYS) ?? '';
  const saasToken = getFirstSearchParam(searchParams, ASSISTED_BUYING_SAAS_TOKEN_KEYS) ?? '';
  const expiresInRaw = getFirstSearchParam(searchParams, ASSISTED_BUYING_EXPIRES_IN_KEYS);
  const expiresIn = expiresInRaw ? Number(expiresInRaw) : NaN;

  if (!accessToken || !saasToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return null;
  }

  return { accessToken, expiresIn, saasToken };
}

export function hasAssistedBuyingTokenParams(searchParams: URLSearchParams): boolean {
  return parseAssistedBuyingTokenParams(searchParams) !== null;
}

function copyNonTokenSearchParams(target: URL, searchParams: URLSearchParams, extraSkip: string[] = []): void {
  const skip = new Set([...ASSISTED_BUYING_TOKEN_PARAM_NAMES, 'returnPath', ...extraSkip]);
  for (const [key, value] of searchParams) {
    if (!skip.has(key)) {
      target.searchParams.set(key, value);
    }
  }
}

/** Redirect target after token processing — tokens stripped, optional client sign-in flag. */
export function buildAssistedBuyingReturnUrl(
  origin: string,
  returnPath: string,
  searchParams: URLSearchParams,
  options?: { requireClientSignIn?: boolean },
): URL {
  const url = new URL(returnPath, origin);
  copyNonTokenSearchParams(url, searchParams);
  if (options?.requireClientSignIn) {
    url.searchParams.set(ASSISTED_BUYING_SIGN_IN_PARAM, '1');
  }
  return url;
}

export function buildAssistedBuyingProcessUrl(origin: string, searchParams: URLSearchParams, returnPath: string): URL {
  const url = new URL('/api/auth/assisted-buying/process', origin);
  for (const [key, value] of searchParams) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('returnPath', returnPath);
  return url;
}

export function stripAssistedBuyingParamsFromSearchParams(params: URLSearchParams): void {
  for (const key of ASSISTED_BUYING_TOKEN_PARAM_NAMES) {
    params.delete(key);
  }
  params.delete(ASSISTED_BUYING_SIGN_IN_PARAM);
}
