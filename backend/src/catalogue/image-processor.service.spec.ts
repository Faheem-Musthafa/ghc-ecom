import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessorService } from './image-processor.service';

function file(buffer: Buffer, mimetype = 'image/png'): Express.Multer.File {
  return {
    buffer,
    mimetype,
    originalname: 'product.png',
    fieldname: 'file',
    encoding: '7bit',
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

describe('ImageProcessorService', () => {
  const service = new ImageProcessorService();

  it('creates three bounded WebP derivatives without enlarging the source', async () => {
    const input = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: '#336699',
      },
    })
      .png()
      .toBuffer();

    const result = await service.process(file(input));

    expect(result).toMatchObject({ sourceWidth: 2400, sourceHeight: 1200 });
    expect(result.derivatives.map(({ name, width, height }) => ({ name, width, height }))).toEqual([
      { name: 'thumbnail', width: 400, height: 200 },
      { name: 'medium', width: 800, height: 400 },
      { name: 'large', width: 1600, height: 800 },
    ]);
    for (const derivative of result.derivatives) {
      await expect(sharp(derivative.buffer).metadata()).resolves.toMatchObject({
        format: 'webp',
        width: derivative.width,
        height: derivative.height,
      });
    }
  });

  it('rejects MIME types outside the accepted image allowlist', async () => {
    await expect(
      service.process(file(Buffer.from('not-an-image'), 'application/pdf')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts GIF images and produces WebP gallery derivatives', async () => {
    const input = await sharp({
      create: {
        width: 320,
        height: 160,
        channels: 3,
        background: '#ccaa33',
      },
    })
      .gif()
      .toBuffer();

    const result = await service.process(file(input, 'image/gif'));

    expect(result).toMatchObject({ sourceWidth: 320, sourceHeight: 160 });
    await expect(sharp(result.derivatives[0].buffer).metadata()).resolves.toMatchObject({
      format: 'webp',
    });
  });

  it('rejects malformed image bytes even when the MIME type is spoofed', async () => {
    await expect(service.process(file(Buffer.from('not-an-image')))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a small encoded input that declares unsafe decompressed dimensions', async () => {
    const oversizedSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="10000"><rect width="10000" height="10000"/></svg>',
    );

    await expect(service.process(file(oversizedSvg))).rejects.toBeInstanceOf(BadRequestException);
  });
});
