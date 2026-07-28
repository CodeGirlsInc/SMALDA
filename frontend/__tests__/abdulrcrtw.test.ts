import { sanitizeText, isSafeUrl } from '../lib/sanitize';
import { toPublicDocumentView } from '../lib/document-sanitizer';

describe('abdulrcrtw Frontend Features (FE-95, FE-94, FE-93, FE-92)', () => {
  it('sanitizeText escapes HTML characters', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('isSafeUrl validates safe protocols', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('toPublicDocumentView trims sensitive owner data', () => {
    const rawDoc = { id: 'd-1', documentHash: '0x123', isVerified: true, ownerSecret: 'private' };
    const publicView = toPublicDocumentView(rawDoc);
    expect(publicView.documentHash).toBe('0x123');
    expect((publicView as any).ownerSecret).toBeUndefined();
  });
});
