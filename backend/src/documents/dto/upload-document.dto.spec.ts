import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UploadDocumentDto } from './upload-document.dto';

describe('UploadDocumentDto', () => {
  it('accepts a trimmed title of at most 200 characters', async () => {
    const dto = plainToInstance(UploadDocumentDto, {
      title: `  ${'a'.repeat(200)}  `,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.title).toHaveLength(200);
  });

  it('rejects a 10 KB title', async () => {
    const dto = plainToInstance(UploadDocumentDto, {
      title: 'a'.repeat(10 * 1024),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'title')).toBe(true);
  });

  it('rejects non-string titles such as multipart arrays', async () => {
    const dto = plainToInstance(UploadDocumentDto, {
      title: ['first', 'second'],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'title')).toBe(true);
  });

  it('allows the title to be omitted so the filename can be used', async () => {
    const dto = plainToInstance(UploadDocumentDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.title).toBeUndefined();
  });
});
