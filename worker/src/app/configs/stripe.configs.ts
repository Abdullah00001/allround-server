import Stripe from 'stripe';

/**
 * Optional Stripe secret for future billing/Connect work.
 * Not required for the current Allround worker slice.
 */
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || '';

/**
 * Shared Stripe client. Remains `null` when `STRIPE_SECRET_KEY` is unset
 * so TypeScript and runtime both stay green without Stripe as a core dependency.
 */
export const stripe: Stripe | null = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;
