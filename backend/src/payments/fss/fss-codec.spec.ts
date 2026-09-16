import { FssCodec } from './fss-codec';

describe('FssCodec', () => {
  const key256 = 'a'.repeat(32);

  it('round-trips url-encoded fields through AES-256-CBC hex trandata', () => {
    const codec = new FssCodec(key256);
    const fields = {
      id: 'MERCHANT01',
      action: '1',
      amt: '127.00',
      trackid: '1758000000000123456',
      responseURL: 'https://www.glockery.com/api/v1/payments/fss/response',
      udf1: 'GHC-TEST-1 & co',
    };

    const trandata = codec.encrypt(fields);

    expect(trandata).toMatch(/^[0-9a-f]+$/);
    expect(trandata.length % 32).toBe(0);
    expect(codec.decrypt(trandata)).toEqual(fields);
  });

  it('selects the AES variant from the key length', () => {
    for (const key of ['b'.repeat(16), 'c'.repeat(24), key256]) {
      const codec = new FssCodec(key);
      expect(codec.decrypt(codec.encrypt({ result: 'CAPTURED' }))).toEqual({
        result: 'CAPTURED',
      });
    }
    expect(() => new FssCodec('short')).toThrow('16, 24 or 32 bytes');
  });

  it('rejects trandata that is not a hex block sequence', () => {
    const codec = new FssCodec(key256);
    expect(() => codec.decrypt('not-hex')).toThrow('not a valid hex');
    expect(() => codec.decrypt('abcd')).toThrow('not a valid hex');
  });

  it('fails to decrypt trandata produced with a different key', () => {
    const encrypted = new FssCodec(key256).encrypt({ result: 'CAPTURED' });
    expect(() => new FssCodec('z'.repeat(32)).decrypt(encrypted)).toThrow();
  });
});
