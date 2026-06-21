import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { config, type Plan } from '../config';
import { authenticate } from '../middleware/auth';
import { findByStripeCustomerIdAsync, setPlanAsync } from '../store/accounts';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!config.stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  if (!stripeClient) stripeClient = new Stripe(config.stripeSecretKey);
  return stripeClient;
}

function priceIdForPlan(plan: Plan): string | undefined {
  if (plan === 'pro') return config.stripePricePro;
  if (plan === 'team') return config.stripePriceTeam;
  return undefined;
}

export const billingRouter = Router();

billingRouter.get('/billing/status', (_req: Request, res: Response) => {
  res.json({
    enabled: Boolean(config.stripeSecretKey),
    webhookConfigured: Boolean(config.stripeWebhookSecret),
    plans: Object.keys(config.quotas),
    prices: {
      pro: Boolean(config.stripePricePro),
      team: Boolean(config.stripePriceTeam),
    },
  });
});

billingRouter.post('/billing/checkout', authenticate, async (req: Request, res: Response) => {
  try {
    const plan = (req.body as { plan?: string })?.plan;
    if (plan !== 'pro' && plan !== 'team') {
      res.status(400).json({ error: 'plan must be "pro" or "team"' });
      return;
    }
    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      res.status(503).json({ error: `Stripe price not configured for ${plan}` });
      return;
    }

    const account = req.account!;
    const stripe = getStripe();
    const successUrl =
      typeof (req.body as { successUrl?: string }).successUrl === 'string'
        ? (req.body as { successUrl: string }).successUrl
        : `${config.clientAppUrl}/?billing=success`;
    const cancelUrl =
      typeof (req.body as { cancelUrl?: string }).cancelUrl === 'string'
        ? (req.body as { cancelUrl: string }).cancelUrl
        : `${config.clientAppUrl}/?billing=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: account.email === 'anonymous@local' ? undefined : account.email,
      client_reference_id: account.id,
      metadata: { accountId: account.id, plan },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl
        : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Checkout failed' });
  }
});

async function applyCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const accountId = session.client_reference_id ?? session.metadata?.accountId;
  const plan = session.metadata?.plan as Plan | undefined;
  if (!accountId || (plan !== 'pro' && plan !== 'team')) return;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? undefined;
  await setPlanAsync(accountId, plan, customerId);
  console.log(`[billing] upgraded account ${accountId} → ${plan}`);
}

async function applySubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;
  const account = await findByStripeCustomerIdAsync(customerId);
  if (!account) return;
  await setPlanAsync(account.id, 'free');
  console.log(`[billing] downgraded account ${account.id} → free`);
}

/** Stripe webhook — verifies signature when STRIPE_WEBHOOK_SECRET is set. */
export async function billingWebhookHandler(req: Request, res: Response): Promise<void> {
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw)) {
    res.status(400).json({ error: 'Expected raw body' });
    return;
  }

  let event: Stripe.Event;
  try {
    const sig = req.headers['stripe-signature'];
    if (config.stripeWebhookSecret && typeof sig === 'string') {
      event = getStripe().webhooks.constructEvent(raw, sig, config.stripeWebhookSecret);
    } else {
      event = JSON.parse(raw.toString('utf8')) as Stripe.Event;
      console.warn('[billing] webhook processed without signature verification (dev mode)');
    }
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid webhook payload' });
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await applyCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.deleted':
      await applySubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      console.log(`[billing] webhook ${event.type} id=${event.id}`);
  }

  res.json({ received: true });
}
