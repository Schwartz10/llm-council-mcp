import { afterEach, describe, expect, test, vi } from 'vitest';

const SAMPLE_DATA_URL = 'data:application/zip;base64,aGVsbG8=';

async function loadModule() {
  const module = await import('./attachments.js');
  return module;
}

describe('Attachment normalization', () => {
  afterEach(() => {
    delete process.env.SECOND_BRAIN_ATTACHMENT_ALLOWED_MEDIA_TYPES;
    delete process.env.SECOND_BRAIN_ATTACHMENT_ALLOW_URLS;
    delete process.env.SECOND_BRAIN_ATTACHMENT_MAX_BYTES;
    delete process.env.SECOND_BRAIN_ATTACHMENT_MAX_COUNT;
  });

  test('accepts allowed media types with base64 data', async () => {
    vi.resetModules();
    delete process.env.SECOND_BRAIN_ATTACHMENT_ALLOWED_MEDIA_TYPES;

    const { normalizeAttachments } = await loadModule();
    const result = normalizeAttachments([
      {
        mediaType: 'application/zip',
        data: SAMPLE_DATA_URL,
        filename: 'archive.zip',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe('application/zip');
  });

  test('rejects attachment URLs when disabled', async () => {
    vi.resetModules();
    delete process.env.SECOND_BRAIN_ATTACHMENT_ALLOW_URLS;

    const { normalizeAttachments } = await loadModule();

    expect(() =>
      normalizeAttachments([
        {
          mediaType: 'application/zip',
          url: 'https://example.com/archive.zip',
        },
      ])
    ).toThrow('Attachment URLs are disabled');
  });

  test('enforces attachment size limits', async () => {
    vi.resetModules();
    process.env.SECOND_BRAIN_ATTACHMENT_MAX_BYTES = '4';

    const { normalizeAttachments } = await loadModule();

    expect(() =>
      normalizeAttachments([
        {
          mediaType: 'application/zip',
          data: SAMPLE_DATA_URL,
        },
      ])
    ).toThrow('Attachment exceeds max size');
  });

  test('enforces attachment count limits', async () => {
    vi.resetModules();
    process.env.SECOND_BRAIN_ATTACHMENT_MAX_COUNT = '1';

    const { normalizeAttachments } = await loadModule();

    expect(() =>
      normalizeAttachments([
        { mediaType: 'application/zip', data: SAMPLE_DATA_URL },
        { mediaType: 'application/zip', data: SAMPLE_DATA_URL },
      ])
    ).toThrow('Too many attachments');
  });
});
