import Stripe from 'stripe';
import { env } from '@/env';

/** Shared worker-side Stripe client for approved operations (e.g. Seller Transfer) */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
