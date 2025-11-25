import type { FirebaseApp } from 'firebase/app';
import type { Auth, Persistence } from '@firebase/auth-types';

declare module '@firebase/auth' {
  export function initializeAuth(app: FirebaseApp, options: { persistence: Persistence }): Auth;
  export function getReactNativePersistence(storage: unknown): Persistence;
}

