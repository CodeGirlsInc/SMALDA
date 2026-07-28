import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { defaultStateConfig } from '../lib/state-config';

describe('ibinola Frontend Features (FE-99, FE-98, FE-97, FE-96)', () => {
  it('robots disallows crawling of sensitive verification and dashboard routes', () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).toContain('/verify/');
    expect(rule.disallow).toContain('/dashboard/');
  });

  it('sitemap exports root marketing URL', () => {
    const entries = sitemap();
    expect(entries[0].url).toBe('https://smalda.org');
  });

  it('defaultStateConfig sets server state strategy', () => {
    expect(defaultStateConfig.serverStateStrategy).toBe('ReactServerComponents');
  });
});
