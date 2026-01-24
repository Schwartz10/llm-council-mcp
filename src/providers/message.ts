import type { ProviderAttachment } from './types.js';

type TextPart = { type: 'text'; text: string };
type ImagePart = { type: 'image'; image: string | URL; mediaType?: string };
type FilePart = { type: 'file'; data: string | URL; mediaType: string; filename?: string };

type UserContent = string | Array<TextPart | ImagePart | FilePart>;

function toAttachmentData(attachment: ProviderAttachment): string | URL | undefined {
  if (attachment.data) {
    return attachment.data;
  }
  if (attachment.url) {
    return attachment.url;
  }
  return undefined;
}

export function buildUserContent(prompt: string, attachments?: ProviderAttachment[]): UserContent {
  if (!attachments || attachments.length === 0) {
    return prompt;
  }

  const parts: Array<TextPart | ImagePart | FilePart> = [{ type: 'text', text: prompt }];

  for (const attachment of attachments) {
    const data = toAttachmentData(attachment);
    if (!data) {
      continue;
    }

    if (attachment.mediaType.startsWith('image/')) {
      parts.push({
        type: 'image',
        image: data,
        mediaType: attachment.mediaType,
      });
      continue;
    }

    const filePart: FilePart = {
      type: 'file',
      data,
      mediaType: attachment.mediaType,
    };

    if (attachment.filename) {
      filePart.filename = attachment.filename;
    }

    parts.push(filePart);
  }

  return parts;
}
