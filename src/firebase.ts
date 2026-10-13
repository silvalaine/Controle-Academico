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

// In-memory access token cache for Google APIs (Workspace / Drive)
let cachedAccessToken: string | null = null;

// Clear cached token on sign-out
auth.onAuthStateChanged((user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedGoogleAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
};

export async function requestDriveAccessToken(emailHint?: string): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  
  const customParams: Record<string, string> = { prompt: 'consent' };
  if (emailHint && emailHint.includes('@')) {
    customParams.login_hint = emailHint;
  }
  provider.setCustomParameters(customParams);

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Não foi possível obter o token de autorização do Google Drive.');
  }

  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
}

export async function loginWithGoogle(): Promise<{ email: string; displayName?: string; accessToken?: string } | null> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    if (result.user && result.user.email) {
      return {
        email: result.user.email,
        displayName: result.user.displayName || undefined,
        accessToken: cachedAccessToken || undefined
      };
    }
  } catch (err: any) {
    console.warn('Login com Google cancelado ou não concluído:', err);
    throw err;
  }
  return null;
}

export async function logoutGoogle(): Promise<void> {
  try {
    cachedAccessToken = null;
    await signOut(auth);
  } catch (err) {
    console.error('Erro ao sair do Google:', err);
  }
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
