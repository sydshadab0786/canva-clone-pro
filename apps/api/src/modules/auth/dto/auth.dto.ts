import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Password policy: >=8 chars, at least one lower, one upper, one digit.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePass1', minLength: 8 })
  @IsString()
  @Matches(PASSWORD_REGEX, {
    message: 'Password must be 8+ chars with upper, lower and a number.',
  })
  password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePass1' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ required: false, description: 'TOTP code when 2FA is enabled.' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(10)
  twoFactorCode?: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token issued at login.' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @Matches(PASSWORD_REGEX, {
    message: 'Password must be 8+ chars with upper, lower and a number.',
  })
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class Enable2FaDto {
  @ApiProperty({ description: 'TOTP code from the authenticator app to confirm setup.' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
