// In-memory sliding window rate limiter
// Zero external dependencies, safe and lightweight

function createRateLimiter({ windowMs, max, message, keyGenerator }) {
  const hits = new Map();

  // Periodic cleanup every 2 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now - record.resetTime > windowMs) {
        hits.delete(key);
      }
    }
  }, 2 * 60 * 1000);
  cleanupTimer.unref(); // Do not block event loop shutdown

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const key = keyGenerator ? keyGenerator(req) : ip;
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        error: message || 'Too many requests, please try again later.',
        retryAfter: resetSeconds
      });
    }

    next();
  };
}

// 1. Auth Limiter (Login, Register, Org Register)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
});

// 2. Strict Password Verify Limiter
const passwordVerifyLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 attempts per 5 minutes
  keyGenerator: (req) => `pw_verify_${req.user?.userId || req.ip}`,
  message: 'Too many password verification attempts. Please wait 5 minutes.'
});

// 3. Token Refresh Limiter
const refreshLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 refresh calls per minute per IP
  message: 'Too many token refresh requests. Please slow down.'
});

// 4. Invite Members Limiter
const inviteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 invites per 10 minutes
  keyGenerator: (req) => `invite_${req.user?.organization_id || req.user?.orgId || req.ip}`,
  message: 'Too many invitation requests. Please try again later.'
});

// 5. AI Summary Generation Limiter
const aiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 AI generations per minute
  keyGenerator: (req) => `ai_${req.user?.userId || req.ip}`,
  message: 'AI summary request limit exceeded. Please wait a minute.'
});

// 6. File Upload Limiter
const uploadLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 uploads per minute
  keyGenerator: (req) => `upload_${req.user?.userId || req.ip}`,
  message: 'File upload rate limit exceeded. Please try again in a minute.'
});

// 7. CSV Export Limiter
const exportLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 exports per 5 minutes
  keyGenerator: (req) => `export_${req.user?.userId || req.user?.organization_id || req.ip}`,
  message: 'CSV export rate limit exceeded. Please wait 5 minutes before exporting again.'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  passwordVerifyLimiter,
  refreshLimiter,
  inviteLimiter,
  aiLimiter,
  uploadLimiter,
  exportLimiter
};

