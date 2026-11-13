import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'firebase/auth';
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

function buildDriveProvider(forceAccountSelect: boolean = true, loginHint?: string): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');

  const customParams: Record<string, string> = {
    prompt: forceAccountSelect ? 'select_account' : 'consent'
  };
  const hint = loginHint || (!forceAccountSelect ? auth.currentUser?.email || undefined : undefined);
  if (hint) {
    customParams.login_hint = hint;
  }
  provider.setCustomParameters(customParams);
  return provider;
}

export function toDriveAuthError(err: any): DriveAuthError {
  if (err instanceof DriveAuthError) {
    return err;
  }
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || err || '');
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (code === 'auth/popup-closed-by-user' || msg.includes('auth/popup-closed-by-user')) {
    return new DriveAuthError(
      'popup-closed',
      inIframe
        ? 'A janela de login do Google foi fechada antes de concluir a autorização. Como o sistema está aberto dentro do painel incorporado, clique em "Abrir em Nova Aba" para conectar sua conta Google normalmente.'
        : 'A autorização com o Google não foi concluída. Se o Google exibiu "Acesso bloqueado" para outra conta (ex.: modo de teste), entre com lab.tecnologia.amparo@gmail.com ou adicione o e-mail em "Usuários de teste" no Google Cloud. Se a janela fechou após clicar em Permitir, permita cookies de terceiros no ícone de ajustes (🎛️) à esquerda do endereço.'
    );
  }
  if (code === 'auth/popup-blocked' || msg.includes('auth/popup-blocked')) {
    return new DriveAuthError(
      'popup-blocked',
      inIframe
        ? 'O navegador bloqueou a janela de login do Google neste painel. Clique em "Abrir em Nova Aba" para conectar sem bloqueios.'
        : 'O navegador bloqueou a abertura da janela de login do Google. Libere os pop-ups ou clique em "Conectar sem Pop-up (Redirecionar)".'
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
      'Este endereço ainda não está autorizado para login Google. Clique em "Abrir em Nova Aba" ou tente novamente.'
    );
  }
  if (
    code === 'auth/operation-not-supported-in-this-environment' ||
    msg.includes('auth/operation-not-supported-in-this-environment') ||
    code === 'auth/internal-error' ||
    msg.includes('auth/internal-error')
  ) {
    return new DriveAuthError(
      'popup-blocked',
      inIframe
        ? 'Este navegador restringiu o login incorporado dentro deste painel. Clique em "Abrir em Nova Aba" para conectar sua conta Google diretamente.'
        : 'Não foi possível abrir o pop-up de login neste navegador. Use o botão "Conectar sem Pop-up (Redirecionar)".'
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

async function requestAccessTokenViaFirebase(
  forceAccountSelect: boolean = true,
  loginHint?: string
): Promise<{ accessToken: string; account: ConnectedGoogleAccount }> {
  const provider = buildDriveProvider(forceAccountSelect, loginHint);

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
    throw toDriveAuthError(err);
  }
}

export async function connectGoogleDriveViaRedirect(
  forceAccountSelect: boolean = true,
  loginHint?: string
): Promise<void> {
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  if (inIframe) {
    throw new DriveAuthError(
      'popup-blocked',
      'O redirecionamento direto do Google precisa ser executado em uma aba própria. Clique em "Abrir em Nova Aba" para conectar.'
    );
  }
  try {
    sessionStorage.setItem('diario_pending_drive_redirect', '1');
  } catch (_) {}
  const provider = buildDriveProvider(forceAccountSelect, loginHint);
  await signInWithRedirect(auth, provider);
}

export async function checkGoogleRedirectResult(): Promise<{
  status: 'connected' | 'none' | 'dropped';
  accessToken?: string;
  account?: ConnectedGoogleAccount;
}> {
  const hasFlag =
    typeof window !== 'undefined' && sessionStorage.getItem('diario_pending_drive_redirect') === '1';
  try {
    const result = await getRedirectResult(auth);
    if (hasFlag) {
      try {
        sessionStorage.removeItem('diario_pending_drive_redirect');
      } catch (_) {}
    }
    if (!result) {
      return { status: hasFlag ? 'dropped' : 'none' };
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      return { status: hasFlag ? 'dropped' : 'none' };
    }

    const account: ConnectedGoogleAccount = {
      email: result.user.email || undefined,
      displayName: result.user.displayName || undefined,
      photoURL: result.user.photoURL || undefined
    };
    cachedAccessToken = credential.accessToken;
    cachedGoogleAccount = account;
    authSource = 'firebase';
    return { status: 'connected', accessToken: cachedAccessToken, account };
  } catch (err: any) {
    try {
      sessionStorage.removeItem('diario_pending_drive_redirect');
    } catch (_) {}
    throw toDriveAuthError(err);
  }
}

export async function connectGoogleDrive(options?: {
  forceAccountSelect?: boolean;
  loginHint?: string;
}): Promise<{ accessToken: string; account: ConnectedGoogleAccount }> {
  const forceAccountSelect = options?.forceAccountSelect ?? true;
  const loginHint = options?.loginHint;

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
      return await requestAccessTokenViaFirebase(forceAccountSelect, loginHint);
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
  const currentSource = authSource;
  cachedAccessToken = null;
  cachedGoogleAccount = null;
  authSource = null;

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
