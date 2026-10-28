import Stripe from 'stripe';

import { env } from '@/env';

/** Shared server-side Stripe client for approved Connect operations. */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
