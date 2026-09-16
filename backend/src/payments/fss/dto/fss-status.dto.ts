import { IsUUID } from 'class-validator';

export class FssStatusDto {
  @IsUUID()
  orderId!: string;
}
