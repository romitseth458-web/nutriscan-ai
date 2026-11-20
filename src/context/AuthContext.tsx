import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  mapFirebaseAuthError,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  ensureUserProfileDocument,
  subscribeToUserProfile,
  updateUserProfileIdentity,
  type UserProfileRecord,
} from '../services/userMealsService';
import { DEFAULT_DAILY_GOALS } from '../utils/storage';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  userProfile: UserProfileRecord | null;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<boolean>;
  updateDisplayName: (newName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authRevision, setAuthRevision] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);

  useEffect(() => {
    void testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setUserProfile(null);
      return;
    }

    let unsubscribeProfile: (() => void) | undefined;

    if (user.emailVerified) {
      void ensureUserProfileDocument(user, DEFAULT_DAILY_GOALS)
        .then(() => {
          unsubscribeProfile = subscribeToUserProfile(user.uid, (profile) => {
            setUserProfile(profile);
          });
        })
        .catch(() => {
          // Handled via structured FirestoreErrorInfo logging
        });
    } else {
      setUserProfile({
        uid: user.uid,
        displayName:
          user.displayName?.trim() ||
          user.email?.split('@')[0]?.trim() ||
          'RosoFood Member',
        email: user.email || '',
        photoURL: user.photoURL || undefined,
        dailyGoals: DEFAULT_DAILY_GOALS,
      });
    }

    return () => {
      unsubscribeProfile?.();
    };
  }, [authReady, user, authRevision]);

  async function signInWithGoogle() {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.emailVerified) {
        await ensureUserProfileDocument(cred.user, DEFAULT_DAILY_GOALS);
      }
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  }

  async function signUpWithEmail(name: string, email: string, password: string) {
    const cleanName = name.trim().slice(0, 100);
    if (!cleanName) {
      throw new Error('Please enter your name.');
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: cleanName });
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Verification email sending failure should not block account creation
      }
      setUser(auth.currentUser);
      setAuthRevision((v) => v + 1);
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  }

  async function signInWithEmail(email: string, password: string) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user.emailVerified) {
        await ensureUserProfileDocument(cred.user, DEFAULT_DAILY_GOALS);
      }
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  }

  async function sendPasswordReset(email: string) {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      throw new Error('Please enter your registered email address.');
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  }

  async function resendVerificationEmail() {
    if (!auth.currentUser) {
      throw new Error('Please sign in first.');
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  }

  async function refreshAuthUser(): Promise<boolean> {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const refreshed = auth.currentUser;
    setUser(refreshed);
    setAuthRevision((v) => v + 1);
    if (refreshed?.emailVerified) {
      await ensureUserProfileDocument(refreshed, DEFAULT_DAILY_GOALS);
      return true;
    }
    return false;
  }

  async function updateDisplayName(newName: string) {
    if (!auth.currentUser) {
      throw new Error('Please sign in first.');
    }
    const cleanName = newName.trim().slice(0, 100);
    if (!cleanName) {
      throw new Error('Display name cannot be empty.');
    }
    await updateProfile(auth.currentUser, { displayName: cleanName });
    if (auth.currentUser.emailVerified) {
      await updateUserProfileIdentity(auth.currentUser, cleanName);
    }
    setUserProfile((prev) =>
      prev
        ? { ...prev, displayName: cleanName }
        : {
            uid: auth.currentUser!.uid,
            displayName: cleanName,
            email: auth.currentUser!.email || '',
            dailyGoals: DEFAULT_DAILY_GOALS,
          }
    );
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        userProfile,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        refreshAuthUser,
        updateDisplayName,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
