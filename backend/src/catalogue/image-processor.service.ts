import { BadRequestException, Injectable } from '@nestjs/common';
import sharp, { Sharp } from 'sharp';

const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const DERIVATIVES = [
  { name: 'thumbnail', maxDimension: 400 },
  { name: 'medium', maxDimension: 800 },
  { name: 'large', maxDimension: 1600 },
] as const;

export interface ImageDerivative {
  name: (typeof DERIVATIVES)[number]['name'];
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
}

export interface ProcessedProductImage {
  sourceWidth: number;
  sourceHeight: number;
  derivatives: ImageDerivative[];
}

@Injectable()
export class ImageProcessorService {
  async process(file: Express.Multer.File): Promise<ProcessedProductImage> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are accepted');
    }

    try {
      const metadata = await this.pipeline(file.buffer).metadata();
      if (
        !metadata.format ||
        !ACCEPTED_FORMATS.has(metadata.format) ||
        !metadata.width ||
        !metadata.height
      ) {
        throw new BadRequestException('The uploaded file is not a supported image');
      }
      if ((metadata.pages ?? 1) > 1) {
        throw new BadRequestException('Animated and multi-page images are not supported');
      }

      const derivatives = await Promise.all(
        DERIVATIVES.map(async ({ name, maxDimension }) => {
          const { data, info } = await this.pipeline(file.buffer)
            .rotate()
            .resize({
              width: maxDimension,
              height: maxDimension,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 82, effort: 4, smartSubsample: true })
            .toBuffer({ resolveWithObject: true });

          return {
            name,
            buffer: data,
            width: info.width,
            height: info.height,
            bytes: info.size,
          };
        }),
      );

      return {
        sourceWidth: metadata.width,
        sourceHeight: metadata.height,
        derivatives,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('The uploaded image is malformed or exceeds safety limits');
    }
  }

  private pipeline(input: Buffer): Sharp {
    return sharp(input, {
      failOn: 'warning',
      limitInputPixels: MAX_INPUT_PIXELS,
      limitInputChannels: 4,
      pages: 1,
    });
  }
}
