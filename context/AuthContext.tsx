import { API_BASE, X_KEY } from '@/config/api';
import { auth, iosClientIdGoogle, webClientIdGoogle } from '@/config/firebase';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Google Sign-In configuration for iOS and Web
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: iosClientIdGoogle,
    webClientId: webClientIdGoogle,
  });

  // Helper function to save/update user in MongoDB
  const saveUserToBackend = async (firebaseUser: User) => {
    try {
      console.log('Saving user to MongoDB backend...');
      const backendResponse = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-API-KEY': X_KEY 
        },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        }),
      });

      if (!backendResponse.ok) {
        const text = await backendResponse.text();
        console.error('Backend error posting user:', backendResponse.status, text);
      } else {
        const data = await backendResponse.json();
        console.log('User saved/updated in backend:', data);
      }
    } catch (error) {
      console.error('Error saving user to backend:', error);
      // Don't throw - allow auth to succeed even if backend fails
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser?.email || 'No user');
      setUser(currentUser);
      setLoading(false);
      
      // If user is authenticated, ensure they exist in MongoDB
      if (currentUser) {
        await saveUserToBackend(currentUser);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Google Sign-In response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(() => {
          console.log('Google sign-in successful');
        })
        .catch((error) => {
          console.error('Error signing in with Google credential:', error);
        });
    }
  }, [response]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting sign in with Firebase...');
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase sign in successful, UID:', result.user.uid);
      
      // Verify user exists in MongoDB backend
      try {
        const checkResponse = await fetch(`${API_BASE}/users/${result.user.uid}/pokemon-favorites`, {
            headers: {'X-API-KEY': X_KEY }
        });
        
        if (checkResponse.status === 404) {
          console.log('User not found in MongoDB, creating...');
          await saveUserToBackend(result.user);
        } else if (checkResponse.ok) {
          console.log('User found in MongoDB');
        } else {
          console.error('Unexpected response from MongoDB:', checkResponse.status);
        }
      } catch (backendError) {
        console.error('Error checking/creating user in MongoDB:', backendError);
        // Don't throw here - allow login even if backend fails
      }
      
      setUser(result.user);
      console.log('Sign in complete');
    } catch (error: any) {
      console.error('Sign in error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Provide more user-friendly error messages
      let errorMessage = 'Authentication failed';
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      console.log('Attempting sign up with Firebase...');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Firebase sign up successful, UID:', result.user.uid);
      
      // Update display name
      if (displayName && result.user) {
        await updateProfile(result.user, { displayName });
        // Update local state with display name
        setUser({ ...result.user, displayName } as User);
      }
      
      // Create user in MongoDB backend
      await saveUserToBackend(result.user);

      console.log('Sign up complete');
    } catch (error: any) {
      console.error('Sign up error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Provide more user-friendly error messages
      let errorMessage = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const signInWithGoogle = async () => {
    try {
      if (Platform.OS === 'web') {
        // On web, use popup
        console.log('Signing in with Google (web)...');
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        // Save user to MongoDB immediately after login
        if (result.user) {
          await saveUserToBackend(result.user);
        }
        console.log('Google sign-in successful');
      } else {
        // On iOS/Android, use expo-auth-session
        console.log('Signing in with Google (native)...');
        // The save will happen automatically in onAuthStateChanged
        await promptAsync();
      }
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      
      let errorMessage = 'Failed to sign in with Google';
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      await firebaseSignOut(auth);
      setUser(null);
      console.log('Sign out successful');
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message || 'Failed to sign out');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}