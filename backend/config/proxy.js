/**
 * Reverse-proxy Configuration
 *
 * Express derives req.ip from X-Forwarded-For, a header the caller fully
 * controls. How much of that chain to believe is a security decision, because
 * every IP rate limiter in middleware/rateLimiter.js keys on req.ip.
 */

// Requests reach this service through Cloud Run with a domain mapping and no
// external load balancer (infrastructure/terraform/gcp/prod has no forwarding
// rule or URL map), so exactly one Google front end sits in front of the
// container. It appends the connecting address to X-Forwarded-For, making the
// last entry the only one a client cannot forge.
const DEFAULT_TRUSTED_PROXY_HOPS = 1;

/**
 * Returns the number of proxy hops to trust, i.e. Express's 'trust proxy'
 * setting. Blanket `true` must never be used here: it trusts the whole
 * client-supplied chain, so any caller can choose their own req.ip and defeat
 * every IP rate limiter (habitcraft-jxo).
 *
 * TRUSTED_PROXY_HOPS overrides the default so a topology change -- putting a
 * load balancer in front, which adds a hop -- can be corrected with a config
 * revision rather than a code change. An unusable value throws at startup
 * rather than falling back, because a silently wrong hop count either restores
 * the bypass or collapses every client into one rate-limit bucket.
 */
function getTrustedProxyHops(env = process.env) {
  const raw = env.TRUSTED_PROXY_HOPS;

  if (raw === undefined || raw === '') {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }

  const hops = Number(raw);

  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(
      `FATAL: TRUSTED_PROXY_HOPS must be a non-negative integer, got "${raw}". ` +
        'It is the number of proxies in front of this service (Cloud Run alone: 1).'
    );
  }

  return hops;
}

module.exports = {
  DEFAULT_TRUSTED_PROXY_HOPS,
  getTrustedProxyHops,
};
