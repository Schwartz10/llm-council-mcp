import { loadConfig } from '../config.js';
import type { ProviderAttachment } from '../providers/types.js';

const config = loadConfig();

const BASE64_DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/;

function estimateBase64Bytes(base64: string): number {
  const normalized = base64.replace(/\s/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function isAllowedMediaType(mediaType: string): boolean {
  const normalized = mediaType.toLowerCase();
  return config.attachmentAllowedMediaTypes.some((allowed) => {
    const rule = allowed.toLowerCase();
    if (rule.endsWith('/*')) {
      return normalized.startsWith(rule.slice(0, -1));
    }
    return normalized === rule;
  });
}

function normalizeAttachment(attachment: ProviderAttachment): ProviderAttachment {
  const hasData = typeof attachment.data === 'string' && attachment.data.length > 0;
  const hasUrl = typeof attachment.url === 'string' && attachment.url.length > 0;

  if (hasData === hasUrl) {
    throw new Error('Each attachment must include exactly one of data or url.');
  }

  if (hasUrl && !config.attachmentAllowUrls) {
    throw new Error('Attachment URLs are disabled by server configuration.');
  }

  let mediaType = attachment.mediaType;
  if (!mediaType || mediaType.trim() === '') {
    if (hasData) {
      const match = attachment.data!.match(BASE64_DATA_URL_REGEX);
      if (match && match[1]) {
        mediaType = match[1];
      }
    }
  }

  if (!mediaType || mediaType.trim() === '') {
    throw new Error('Attachment mediaType is required.');
  }

  if (!isAllowedMediaType(mediaType)) {
    throw new Error(`Attachment mediaType not allowed: ${mediaType}`);
  }

  if (hasData) {
    const match = attachment.data!.match(BASE64_DATA_URL_REGEX);
    if (match && match[1] && match[1] !== mediaType) {
      throw new Error('Attachment mediaType does not match data URL.');
    }
  }

  return {
    filename: attachment.filename,
    mediaType,
    data: attachment.data,
    url: attachment.url,
  };
}

export function normalizeAttachments(attachments?: ProviderAttachment[]): ProviderAttachment[] {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  if (attachments.length > config.attachmentMaxCount) {
    throw new Error(`Too many attachments (max ${config.attachmentMaxCount}).`);
  }

  let totalBytes = 0;
  const normalized = attachments.map((attachment) => {
    const normalizedAttachment = normalizeAttachment(attachment);
    if (normalizedAttachment.data) {
      const match = normalizedAttachment.data.match(BASE64_DATA_URL_REGEX);
      const base64 = match ? match[2] : normalizedAttachment.data;
      const size = estimateBase64Bytes(base64);
      if (size > config.attachmentMaxBytes) {
        throw new Error(`Attachment exceeds max size of ${config.attachmentMaxBytes} bytes.`);
      }
      totalBytes += size;
    }
    return normalizedAttachment;
  });

  if (totalBytes > config.attachmentMaxTotalBytes) {
    throw new Error(`Total attachment size exceeds ${config.attachmentMaxTotalBytes} bytes.`);
  }

  return normalized;
}
