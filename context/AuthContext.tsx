import { API_BASE, X_KEY } from '@/config/api';
import { auth } from '@/config/firebase';
import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  User,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth state changed:', currentUser?.email || 'No user');
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
          // If user doesn't exist in MongoDB, create them
          const createResponse = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': X_KEY },
            body: JSON.stringify({
              firebaseUid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
            }),
          });
          
          if (createResponse.ok) {
            console.log('User created in MongoDB successfully');
          } else {
            console.error('Failed to create user in MongoDB');
          }
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
      
      // Create user in MongoDB backend
      console.log('Creating user in MongoDB backend...');
      const backendResponse = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': X_KEY },
        body: JSON.stringify({
          firebaseUid: result.user.uid,
          email: result.user.email,
          displayName: displayName,
        }),
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json().catch(() => ({}));
        console.error('Backend user creation failed:', errorData);
        throw new Error('Failed to create user profile in database');
      }

      console.log('User created in MongoDB successfully');
      setUser(result.user);
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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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