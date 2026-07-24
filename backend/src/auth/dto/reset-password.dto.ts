import { IsJWT, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsJWT()
  recoveryAccessToken!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  recoveryRefreshToken!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
