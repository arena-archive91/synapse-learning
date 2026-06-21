import { Router } from 'express';
import { authenticate, signAccessToken, signRefreshToken, verifyRefreshToken } from '../middleware/auth';
import {
  createAccountAsync,
  findByEmailAsync,
  getUsage,
  updatePasswordAsync,
  verifyPassword,
} from '../store/accounts';
import { consumeToken, issueToken } from '../store/tokenStore';

export const authRouter = Router();

function validCredentials(body: unknown): { email: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) return null;
  return { email, password };
}

async function authPayloadWithRefresh(account: { id: string; email: string; plan: string }) {
  const accessToken = signAccessToken(account.id);
  const refreshToken = await signRefreshToken(account.id);
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    account: { id: account.id, email: account.email, plan: account.plan },
  };
}

authRouter.post('/register', async (req, res) => {
  const creds = validCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: 'Valid email and password (min 8 chars) required' });
    return;
  }
  try {
    const account = await createAccountAsync(creds.email, creds.password);
    res.status(201).json(await authPayloadWithRefresh(account));
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

authRouter.post('/login', async (req, res) => {
  const creds = validCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: 'Valid email and password required' });
    return;
  }
  const account = await findByEmailAsync(creds.email);
  if (!account || !verifyPassword(account, creds.password)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  res.json(await authPayloadWithRefresh(account));
});

authRouter.post('/refresh', async (req, res) => {
  const raw = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  const accountId = await verifyRefreshToken(raw);
  if (!accountId) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }
  const accessToken = signAccessToken(accountId);
  res.json({
    token: accessToken,
    accessToken,
    refreshToken: await signRefreshToken(accountId),
  });
});

authRouter.post('/logout', authenticate, (_req, res) => {
  res.json({ ok: true });
});

authRouter.post('/forgot-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    res.status(400).json({ error: 'email required' });
    return;
  }
  const account = await findByEmailAsync(email);
  if (account) {
    const resetToken = await issueToken(account.id, 'password_reset', 60 * 60 * 1000);
    if (process.env.NODE_ENV !== 'production') {
      res.json({ ok: true, resetToken });
      return;
    }
  }
  res.json({ ok: true });
});

authRouter.post('/reset-password', async (req, res) => {
  const resetToken = typeof req.body?.resetToken === 'string' ? req.body.resetToken : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!resetToken || password.length < 8) {
    res.status(400).json({ error: 'resetToken and password (min 8) required' });
    return;
  }
  const accountId = await consumeToken(resetToken, 'password_reset');
  if (!accountId) {
    res.status(401).json({ error: 'Invalid or expired reset token' });
    return;
  }
  const ok = await updatePasswordAsync(accountId, password);
  if (!ok) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json({ ok: true });
});

authRouter.get('/me', authenticate, (req, res) => {
  const account = req.account!;
  res.json({
    account: { id: account.id, email: account.email, plan: account.plan },
    usage: getUsage(account),
  });
});
