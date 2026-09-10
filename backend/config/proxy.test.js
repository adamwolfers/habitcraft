/**
 * Reverse-proxy Configuration Tests
 *
 * The hop count is a security control: it decides how much of a
 * caller-supplied X-Forwarded-For chain becomes req.ip, and every IP rate
 * limiter keys on req.ip (habitcraft-jxo).
 */

const { DEFAULT_TRUSTED_PROXY_HOPS, getTrustedProxyHops } = require('./proxy');

describe('getTrustedProxyHops', () => {
  it('defaults to one hop, matching Cloud Run with no load balancer', () => {
    expect(getTrustedProxyHops({})).toBe(1);
    expect(DEFAULT_TRUSTED_PROXY_HOPS).toBe(1);
  });

  it('treats an unset or empty TRUSTED_PROXY_HOPS as absent', () => {
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: undefined })).toBe(DEFAULT_TRUSTED_PROXY_HOPS);
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: '' })).toBe(DEFAULT_TRUSTED_PROXY_HOPS);
  });

  it('reads an override for a deployment with more proxies in front', () => {
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: '2' })).toBe(2);
  });

  it('allows zero hops, for running with no proxy at all', () => {
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: '0' })).toBe(0);
  });

  it('never returns a boolean, which would trust the whole forwarded chain', () => {
    for (const raw of ['true', 'false']) {
      expect(() => getTrustedProxyHops({ TRUSTED_PROXY_HOPS: raw })).toThrow(
        /non-negative integer/
      );
    }
  });

  it.each(['-1', '1.5', 'one', 'Infinity', '1,2'])(
    'throws rather than falling back on the unusable value %p',
    (raw) => {
      expect(() => getTrustedProxyHops({ TRUSTED_PROXY_HOPS: raw })).toThrow(
        /TRUSTED_PROXY_HOPS must be a non-negative integer/
      );
    }
  );

  it('reads process.env when no environment is passed', () => {
    const original = process.env.TRUSTED_PROXY_HOPS;
    process.env.TRUSTED_PROXY_HOPS = '3';
    try {
      expect(getTrustedProxyHops()).toBe(3);
    } finally {
      if (original === undefined) {
        delete process.env.TRUSTED_PROXY_HOPS;
      } else {
        process.env.TRUSTED_PROXY_HOPS = original;
      }
    }
  });
});
