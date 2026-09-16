import { createCipheriv, createDecipheriv } from 'node:crypto';

/**
 * FSS (Financial Software & Systems) bank gateways exchange the transaction
 * payload as `trandata`: a URL-encoded key/value string encrypted with the
 * merchant "resource key" using AES-CBC (PKCS#7 padding) and a fixed IV, then
 * hex encoded. The variant (128/192/256) follows the key length.
 *
 * The IV below is the value documented across FSS IPay integration kits. If the
 * bank's TEST KIT specifies a different IV, key derivation or encoding, change it
 * here — nothing else in the integration depends on the wire format.
 */
export const FSS_TRANDATA_IV = 'PGKEYENCDECIVSPC';

export class FssCodec {
  private readonly key: Buffer;
  private readonly algorithm: 'aes-128-cbc' | 'aes-192-cbc' | 'aes-256-cbc';
  private readonly iv: Buffer;

  constructor(resourceKey: string, iv: string = FSS_TRANDATA_IV) {
    this.key = Buffer.from(resourceKey, 'utf8');
    this.iv = Buffer.from(iv, 'utf8');
    if (this.iv.length !== 16) {
      throw new Error('FSS IV must be exactly 16 bytes');
    }
    switch (this.key.length) {
      case 16:
        this.algorithm = 'aes-128-cbc';
        break;
      case 24:
        this.algorithm = 'aes-192-cbc';
        break;
      case 32:
        this.algorithm = 'aes-256-cbc';
        break;
      default:
        throw new Error('FSS resource key must be 16, 24 or 32 bytes');
    }
  }

  encrypt(fields: Record<string, string>): string {
    const cipher = createCipheriv(this.algorithm, this.key, this.iv);
    const plaintext = Buffer.from(FssCodec.serialize(fields), 'utf8');
    return Buffer.concat([cipher.update(plaintext), cipher.final()]).toString('hex');
  }

  decrypt(trandata: string): Record<string, string> {
    const normalized = trandata.trim();
    if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 32 !== 0) {
      throw new Error('FSS trandata is not a valid hex-encoded AES block sequence');
    }
    const decipher = createDecipheriv(this.algorithm, this.key, this.iv);
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(normalized, 'hex')),
      decipher.final(),
    ]).toString('utf8');
    return FssCodec.parse(plaintext);
  }

  static serialize(fields: Record<string, string>): string {
    return Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  static parse(serialized: string): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(serialized)) {
      fields[key] = value;
    }
    return fields;
  }
}
