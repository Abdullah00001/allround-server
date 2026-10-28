import {
  initializeApp,
  getApps,
  cert,
  App,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import logger from './logger.configs';
import { getFirebaseCredentials } from '@/app/utils/system.utils';

let firebaseApp: App | undefined;
let messaging: Messaging | undefined;

/**
 * Initialize Firebase Admin SDK with credentials from environment variables.
 * Should be called once during application startup.
 */
export function initializeFirebase(): void {
  try {
    const credentials = getFirebaseCredentials();

    // Validate required fields
    if (
      !credentials.project_id ||
      !credentials.private_key ||
      !credentials.client_email
    ) {
      throw new Error(
        'Missing required Firebase credentials: project_id, private_key, or client_email.'
      );
    }

    // Only initialize if not already initialized
    if (getApps().length === 0) {
      firebaseApp = initializeApp({
        credential: cert(credentials as ServiceAccount),
      });
      messaging = getMessaging(firebaseApp);
      logger.info('Firebase Admin SDK initialized successfully');
    } else {
      // Use existing app instance (e.g., from testing or hot‑reload)
      firebaseApp = getApps()[0];
      messaging = getMessaging(firebaseApp);
      logger.info(
        'Firebase Admin SDK already initialized, reusing existing instance.'
      );
    }
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    // Re‑throw to prevent app startup if Firebase is required
    throw error;
  }
}

/**
 * Get the initialized Firebase App instance.
 */
export function getFirebaseApp(): App | undefined {
  return firebaseApp;
}

/**
 * Get the Firebase Messaging instance for sending push notifications.
 */
export function getFirebaseMessaging(): Messaging | undefined {
  return messaging;
}
