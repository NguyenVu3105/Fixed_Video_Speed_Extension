import { describe, expect, it } from 'vitest';
import {
  detectSiteFromHost,
  findCustomSite,
  isDomainOrSubdomain,
  isHostSupported,
  normalizeCustomDomain,
  normalizeHostname,
} from './sites';

describe('normalizeHostname', () => {
  it('trims, lowercases and strips surrounding dots', () => {
    expect(normalizeHostname('  WWW.Example.COM. ')).toBe('www.example.com');
  });
});

describe('isDomainOrSubdomain', () => {
  it('matches the exact domain', () => {
    expect(isDomainOrSubdomain('example.com', 'example.com')).toBe(true);
  });

  it('matches subdomains', () => {
    expect(isDomainOrSubdomain('www.example.com', 'example.com')).toBe(true);
  });

  it('does not match unrelated domains sharing a suffix', () => {
    expect(isDomainOrSubdomain('notexample.com', 'example.com')).toBe(false);
  });
});

describe('detectSiteFromHost', () => {
  it('detects built-in platforms including subdomains', () => {
    expect(detectSiteFromHost('www.youtube.com')).toBe('youtube');
    expect(detectSiteFromHost('youtu.be')).toBe('youtube');
    expect(detectSiteFromHost('m.bilibili.com')).toBe('bilibili');
  });

  it('falls back to "other" for unknown hosts', () => {
    expect(detectSiteFromHost('mysite.org')).toBe('other');
  });
});

describe('normalizeCustomDomain', () => {
  it('accepts bare domains and https URLs', () => {
    expect(normalizeCustomDomain('Example.com')).toBe('example.com');
    expect(normalizeCustomDomain('https://example.com')).toBe('example.com');
  });

  it('rejects paths, ports, credentials and whitespace', () => {
    expect(normalizeCustomDomain('example.com/path')).toBeNull();
    expect(normalizeCustomDomain('example.com:8080')).toBeNull();
    expect(normalizeCustomDomain('user@example.com')).toBeNull();
    expect(normalizeCustomDomain('exa mple.com')).toBeNull();
    expect(normalizeCustomDomain('')).toBeNull();
  });
});

describe('findCustomSite', () => {
  it('finds a rule for the domain or a subdomain', () => {
    const sites = [{ domain: 'example.com', speed: 2, profileId: null }];
    expect(findCustomSite('www.example.com', sites)?.domain).toBe('example.com');
    expect(findCustomSite('other.org', sites)).toBeNull();
  });
});

describe('isHostSupported', () => {
  const custom = [{ domain: 'mysite.org', speed: 1.5, profileId: null }];

  it('supports built-in sites by default', () => {
    expect(isHostSupported('www.youtube.com', [])).toBe(true);
  });

  it('supports custom domains', () => {
    expect(isHostSupported('mysite.org', custom)).toBe(true);
  });

  it('rejects unknown hosts', () => {
    expect(isHostSupported('unknown.net', [])).toBe(false);
  });

  it('gates built-in sites through supportedSites when provided', () => {
    expect(isHostSupported('www.youtube.com', [], ['youtube'])).toBe(true);
    expect(isHostSupported('www.youtube.com', [], ['tiktok'])).toBe(false);
  });

  it('never gates custom domains through supportedSites', () => {
    expect(isHostSupported('mysite.org', custom, ['youtube'])).toBe(true);
  });
});
