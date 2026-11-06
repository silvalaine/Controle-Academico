import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Must use firestoreDatabaseId
const firestoreDatabaseId = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-diriodoprofessor-453fc64e-b3e0-412e-a048-f5c840a4d37b';
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);

// Configure Firestore log level to avoid excessive backend retry warning logs in console
try {
  setLogLevel('silent');
} catch (_) {}

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

export interface ConnectedGoogleAccount {
  email?: string;
  displayName?: string;
  photoURL?: string;
}

export type DriveAuthErrorCode =
  | 'popup-closed'
  | 'popup-blocked'
  | 'cancelled'
  | 'unauthorized-domain'
  | 'network'
  | 'expired'
  | 'config'
  | 'unknown';

export class DriveAuthError extends Error {
  code: DriveAuthErrorCode;
  constructor(code: DriveAuthErrorCode, message: string) {
    super(message);
    this.name = 'DriveAuthError';
    this.code = code;
  }
}

// In-memory access token & account cache for Google APIs (Workspace / Drive)
// Never persisted in localStorage or sessionStorage.
let cachedAccessToken: string | null = null;
let cachedGoogleAccount: ConnectedGoogleAccount | null = null;
let authSource: 'firebase' | 'gsi' | null = null;
let isSigningIn = false;
let pendingAuthPromise: Promise<{ accessToken: string; account: ConnectedGoogleAccount }> | null = null;

// Clear cached token on Firebase sign-out
auth.onAuthStateChanged((user) => {
  if (!user && authSource === 'firebase') {
    cachedAccessToken = null;
    cachedGoogleAccount = null;
    authSource = null;
  } else if (user && authSource === 'firebase' && !cachedGoogleAccount?.email) {
    cachedGoogleAccount = {
      email: user.email || undefined,
      displayName: user.displayName || undefined,
      photoURL: user.photoURL || undefined
    };
  }
});

export const initGoogleDriveAuth = (
  onAuthSuccess?: (account: ConnectedGoogleAccount, token: string) => void,
  onAuthFailure?: () => void
) => {
  return auth.onAuthStateChanged((user) => {
    if (cachedAccessToken) {
      onAuthSuccess?.(
        cachedGoogleAccount || {
          email: user?.email || undefined,
          displayName: user?.displayName || undefined,
          photoURL: user?.photoURL || undefined
        },
        cachedAccessToken
      );
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      cachedGoogleAccount = null;
      onAuthFailure?.();
    }
  });
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getConnectedGoogleUser = (): ConnectedGoogleAccount | null => {
  if (cachedGoogleAccount) return cachedGoogleAccount;
  if (authSource === 'firebase' && auth.currentUser) {
    return {
      email: auth.currentUser.email || undefined,
      displayName: auth.currentUser.displayName || undefined,
      photoURL: auth.currentUser.photoURL || undefined
    };
  }
  return null;
};

export const setCachedGoogleAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
  if (!token) {
    cachedGoogleAccount = null;
    authSource = null;
  }
};

export function toDriveAuthError(err: any): DriveAuthError {
  if (err instanceof DriveAuthError) {
    return err;
  }
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || err || '');

  if (code === 'auth/popup-closed-by-user' || msg.includes('auth/popup-closed-by-user')) {
    return new DriveAuthError(
      'popup-closed',
      'A janela de login do Google foi fechada antes de concluir a autorização. Para conectar ao Google Drive, selecione sua conta Google na janela pop-up e clique em Permitir.'
    );
  }
  if (code === 'auth/popup-blocked' || msg.includes('auth/popup-blocked')) {
    return new DriveAuthError(
      'popup-blocked',
      'O navegador bloqueou a abertura da janela de login do Google. Habilite os pop-ups para este site ou use o botão "OAuth Direto" abaixo.'
    );
  }
  if (code === 'auth/cancelled-popup-request' || msg.includes('auth/cancelled-popup-request')) {
    return new DriveAuthError(
      'cancelled',
      'Uma solicitação anterior de login já estava aberta. Aguarde a janela do Google ou clique novamente para conectar.'
    );
  }
  if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
    return new DriveAuthError(
      'unauthorized-domain',
      'Este endereço ainda não está autorizado no Firebase Auth. Use o botão "OAuth Direto" ou abra o aplicativo em uma nova aba.'
    );
  }
  if (code === 'auth/network-request-failed' || msg.includes('auth/network-request-failed')) {
    return new DriveAuthError(
      'network',
      'Falha de conexão com os servidores do Google. Verifique sua internet e tente novamente.'
    );
  }
  return new DriveAuthError(
    'unknown',
    msg || 'Não foi possível concluir a autenticação com o Google Drive.'
  );
}

async function fetchDriveAccountInfo(accessToken: string): Promise<ConnectedGoogleAccount> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.user) {
        return {
          email: json.user.emailAddress || undefined,
          displayName: json.user.displayName || undefined,
          photoURL: json.user.photoLink || undefined
        };
      }
    }
  } catch (_) {
    // Optional profile metadata
  }
  return {};
}

async function requestAccessTokenViaGsi(
  forceAccountSelect: boolean = true
): Promise<{ accessToken: string; account: ConnectedGoogleAccount }> {
  const clientId = (firebaseConfig as any).oAuthClientId;
  if (!clientId) {
    throw new DriveAuthError('config', 'Client ID OAuth do Google não está configurado neste projeto.');
  }

  const googleObj = typeof window !== 'undefined' ? (window as any).google : undefined;
  if (!googleObj?.accounts?.oauth2?.initTokenClient) {
    throw new DriveAuthError(
      'popup-blocked',
      'A biblioteca de autenticação direta do Google ainda não foi carregada ou foi bloqueada pelo navegador. Tente novamente ou abra o app em uma nova aba.'
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    try {
      const tokenClient = googleObj.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        prompt: forceAccountSelect ? 'select_account' : '',
        callback: async (tokenResponse: any) => {
          if (settled) return;
          settled = true;

          if (tokenResponse?.error) {
            if (tokenResponse.error === 'popup_closed_by_user' || tokenResponse.error === 'access_denied') {
              reject(
                new DriveAuthError(
                  'popup-closed',
                  'A autorização com o Google Drive foi cancelada ou a janela foi fechada antes da confirmação.'
                )
              );
            } else if (tokenResponse.error === 'popup_failed_to_open') {
              reject(
                new DriveAuthError(
                  'popup-blocked',
                  'O navegador bloqueou a janela pop-up de autorização do Google. Libere os pop-ups e tente novamente.'
                )
              );
            } else {
              reject(
                new DriveAuthError(
                  'unknown',
                  `Falha na autorização Google: ${tokenResponse.error_description || tokenResponse.error}`
                )
              );
            }
            return;
          }

          if (!tokenResponse?.access_token) {
            reject(new DriveAuthError('unknown', 'O Google não retornou um token de acesso válido para o Drive.'));
            return;
          }

          const accessToken = String(tokenResponse.access_token);
          cachedAccessToken = accessToken;
          authSource = 'gsi';

          const account = await fetchDriveAccountInfo(accessToken);
          cachedGoogleAccount = account;
          resolve({ accessToken, account });
        },
        error_callback: (err: any) => {
          if (settled) return;
          settled = true;
          const errType = String(err?.type || '');
          if (errType === 'popup_closed') {
            reject(
              new DriveAuthError(
                'popup-closed',
                'A janela de login do Google foi fechada antes de concluir a autorização.'
              )
            );
          } else if (errType === 'popup_failed_to_open') {
            reject(
              new DriveAuthError(
                'popup-blocked',
                'O navegador bloqueou a abertura da janela de login do Google. Libere os pop-ups para este site.'
              )
            );
          } else {
            reject(
              new DriveAuthError(
                'unknown',
                `Erro ao abrir janela do Google: ${err?.message || errType || 'tente novamente'}`
              )
            );
          }
        }
      });

      tokenClient.requestAccessToken();
    } catch (err: any) {
      if (!settled) {
        settled = true;
        reject(new DriveAuthError('unknown', err?.message || 'Erro ao iniciar autenticação Google OAuth.'));
      }
    }
  });
}

async function requestAccessTokenViaFirebase(
  forceAccountSelect: boolean = true
): Promise<{ accessToken: string; account: ConnectedGoogleAccount }> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');

  // Always allow selecting the user's own Google account instead of forcing a channel email
  const customParams: Record<string, string> = {
    prompt: forceAccountSelect ? 'select_account' : 'consent'
  };
  if (!forceAccountSelect && auth.currentUser?.email) {
    customParams.login_hint = auth.currentUser.email;
  }
  provider.setCustomParameters(customParams);

  const startedAt = Date.now();
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new DriveAuthError('unknown', 'Não foi possível obter o token de autorização do Google Drive.');
    }

    const account: ConnectedGoogleAccount = {
      email: result.user.email || undefined,
      displayName: result.user.displayName || undefined,
      photoURL: result.user.photoURL || undefined
    };

    cachedAccessToken = credential.accessToken;
    cachedGoogleAccount = account;
    authSource = 'firebase';
    return { accessToken: cachedAccessToken, account };
  } catch (err: any) {
    const elapsedMs = Date.now() - startedAt;
    const rawCode = String(err?.code || '').toLowerCase();

    // If Firebase's authDomain handler popup closed immediately (< 1.5s) due to iframe cookie/storage
    // partitioning or unauthorized-domain, automatically fall back to Google Identity Services direct OAuth
    const shouldFallbackToGsi =
      rawCode === 'auth/unauthorized-domain' ||
      rawCode === 'auth/operation-not-supported-in-this-environment' ||
      rawCode === 'auth/internal-error' ||
      ((rawCode === 'auth/popup-closed-by-user' || rawCode === 'auth/popup-blocked') && elapsedMs < 1500);

    if (shouldFallbackToGsi && typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2?.initTokenClient) {
      return await requestAccessTokenViaGsi(forceAccountSelect);
    }

    throw toDriveAuthError(err);
  }
}

export async function connectGoogleDrive(options?: {
  forceAccountSelect?: boolean;
  preferDirectOAuth?: boolean;
}): Promise<{ accessToken: string; account: ConnectedGoogleAccount }> {
  const forceAccountSelect = options?.forceAccountSelect ?? true;
  const preferDirectOAuth = options?.preferDirectOAuth ?? false;

  if (!forceAccountSelect && cachedAccessToken) {
    return {
      accessToken: cachedAccessToken,
      account: getConnectedGoogleUser() || {}
    };
  }

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  isSigningIn = true;
  pendingAuthPromise = (async () => {
    try {
      if (preferDirectOAuth) {
        return await requestAccessTokenViaGsi(forceAccountSelect);
      }
      return await requestAccessTokenViaFirebase(forceAccountSelect);
    } finally {
      isSigningIn = false;
      pendingAuthPromise = null;
    }
  })();

  return pendingAuthPromise;
}

export async function requestDriveAccessToken(_emailHint?: string): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const res = await connectGoogleDrive({ forceAccountSelect: true });
  return res.accessToken;
}

export async function loginWithGoogle(): Promise<{ email: string; displayName?: string; accessToken?: string } | null> {
  try {
    const res = await connectGoogleDrive({ forceAccountSelect: true });
    if (res.account?.email) {
      return {
        email: res.account.email,
        displayName: res.account.displayName,
        accessToken: res.accessToken
      };
    }
    return {
      email: 'Conta Google Conectada',
      accessToken: res.accessToken
    };
  } catch (err: any) {
    console.warn('Login com Google não concluído:', err);
    throw toDriveAuthError(err);
  }
}

export async function disconnectGoogleDrive(): Promise<void> {
  const tokenToRevoke = cachedAccessToken;
  const currentSource = authSource;
  cachedAccessToken = null;
  cachedGoogleAccount = null;
  authSource = null;

  try {
    const googleObj = typeof window !== 'undefined' ? (window as any).google : undefined;
    if (tokenToRevoke && googleObj?.accounts?.oauth2?.revoke) {
      googleObj.accounts.oauth2.revoke(tokenToRevoke, () => {});
    }
  } catch (_) {}

  try {
    if (currentSource === 'firebase' || auth.currentUser) {
      await signOut(auth);
    }
  } catch (err) {
    console.error('Erro ao desconectar conta Google:', err);
  }
}

export async function logoutGoogle(): Promise<void> {
  await disconnectGoogleDrive();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot as mandated by the skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();
