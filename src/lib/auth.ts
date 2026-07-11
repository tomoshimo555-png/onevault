import {
  BrowserCacheLocation,
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
} from "@azure/msal-browser";

export const GRAPH_SCOPES = ["Files.ReadWrite.AppFolder"];
const clientId = import.meta.env.VITE_MS_CLIENT_ID?.trim();

export const authConfigured = Boolean(clientId && !clientId.startsWith("replace-"));

export const msal = authConfigured
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority: "https://login.microsoftonline.com/consumers",
        redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
        postLogoutRedirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
      cache: {
        cacheLocation: BrowserCacheLocation.SessionStorage,
      },
      system: {
        allowPlatformBroker: false,
      },
    })
  : null;

let initialized = false;

export async function initializeAuth(): Promise<AccountInfo | null> {
  if (!msal) return null;
  if (!initialized) {
    await msal.initialize();
    initialized = true;
  }
  const redirect = await msal.handleRedirectPromise();
  if (redirect?.account) msal.setActiveAccount(redirect.account);
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (account) msal.setActiveAccount(account);
  return account;
}

export async function signIn(): Promise<void> {
  if (!msal) throw new Error("VITE_MS_CLIENT_IDが設定されていません");
  await msal.loginRedirect({ scopes: GRAPH_SCOPES, prompt: "select_account" });
}

export async function signOut(): Promise<void> {
  if (!msal) return;
  await msal.logoutRedirect({ account: msal.getActiveAccount() ?? undefined });
}

export async function getAccessToken(): Promise<string> {
  if (!msal) throw new Error("Microsoft認証が設定されていません");
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
  if (!account) throw new Error("Microsoftアカウントへログインしてください");
  let result: AuthenticationResult;
  try {
    result = await msal.acquireTokenSilent({ account, scopes: GRAPH_SCOPES });
  } catch {
    await msal.acquireTokenRedirect({ account, scopes: GRAPH_SCOPES });
    throw new Error("Microsoft認証へ移動します");
  }
  return result.accessToken;
}
