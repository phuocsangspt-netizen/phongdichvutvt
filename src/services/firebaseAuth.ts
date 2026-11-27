import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export const BOOTSTRAPPED_ADMIN_EMAIL = 'phuocsangspt@gmail.com';

export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// Deterministic Firestore document ID matching `authStaffId()` in firestore.rules
export function emailToStaffId(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// In-memory OAuth access token cache for Google Sheets API (NEVER stored in localStorage)
let cachedAccessToken: string | null = null;

// Startup connectivity verification per Firebase guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (Firestore client is offline).');
    }
  }
}
testConnection();

/**
 * Subscribe to Firebase Authentication state changes.
 * Persists user sessions cleanly across page reloads.
 */
export const subscribeAuthState = (
  onChange: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
    }
    onChange(user);
  });
};

/**
 * Standard Google Sign-In for dealership staff login (no extra Workspace scopes needed).
 */
export const signInWithGoogleApp = async (): Promise<User> => {
  const appProvider = new GoogleAuthProvider();
  appProvider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, appProvider);
  return result.user;
};

/**
 * Elevated Google Sign-In requesting Google Sheets & Drive scopes (for Managers/authorized sync).
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  const sheetsProvider = new GoogleAuthProvider();
  SHEETS_SCOPES.forEach((scope) => sheetsProvider.addScope(scope));
  sheetsProvider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, sheetsProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Không thể lấy Access Token từ Google Authentication');
  }

  cachedAccessToken = credential.accessToken;
  return { user: result.user, accessToken: cachedAccessToken };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  cachedAccessToken = null;
  await signOut(auth);
};
