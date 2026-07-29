import * as fs from 'fs';
import * as path from 'path';

describe('danielships Backend Features (BE-148, BE-147, BE-146, BE-145)', () => {
  it('API Versioning and OpenAPI export script exists', () => {
    expect(
      fs.existsSync(path.resolve(__dirname, '../scripts/export-openapi.ts')),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(__dirname, '../docs/ARCHITECTURE.md')),
    ).toBe(true);
  });
});
