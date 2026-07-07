import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuthService, RequestContext } from './auth.service';
import {
  Enable2FaDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ctx(req: Request): RequestContext {
    return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create a new account (email + password).' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.ctx(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and receive an access/refresh token pair.' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.ctx(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair.' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.ctx(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh session (logout on this device).' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm an email address using the emailed token.' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password-reset email (always 202).' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const token = await this.auth.requestPasswordReset(dto.email, this.ctx(req));
    // token is surfaced only in non-production to enable local testing.
    return process.env.NODE_ENV === 'production' ? { ok: true } : { ok: true, token };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a new password using a reset token.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
  }

  // ── Authenticated routes ────────────────────────────────────────

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated principal.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @ApiBearerAuth()
  @Post('2fa/setup')
  @ApiOperation({ summary: 'Begin TOTP 2FA setup; returns otpauth URL + QR.' })
  setup2fa(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.beginTwoFactorSetup(user.id, user.email);
  }

  @ApiBearerAuth()
  @Post('2fa/enable')
  @ApiOperation({ summary: 'Confirm TOTP code and enable 2FA; returns backup codes.' })
  async enable2fa(
    @Body() dto: Enable2FaDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const backupCodes = await this.auth.confirmTwoFactor(user.id, dto.code, this.ctx(req));
    return { enabled: true, backupCodes };
  }

  @ApiBearerAuth()
  @Post('2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable 2FA for the current user.' })
  async disable2fa(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.auth.disableTwoFactor(user.id, this.ctx(req));
  }
}
