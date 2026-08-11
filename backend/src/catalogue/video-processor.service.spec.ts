import { BadRequestException } from '@nestjs/common';
import { VideoProcessorService } from './video-processor.service';

function file(buffer: Buffer, mimetype: string): Express.Multer.File {
  return {
    buffer,
    mimetype,
    originalname: 'product.mov',
    fieldname: 'file',
    encoding: '7bit',
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

describe('VideoProcessorService', () => {
  it('rejects unsupported video MIME types before invoking FFmpeg', async () => {
    await expect(
      new VideoProcessorService().process(file(Buffer.from('nope'), 'application/pdf')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty video uploads', async () => {
    await expect(
      new VideoProcessorService().process(file(Buffer.alloc(0), 'video/mp4')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
