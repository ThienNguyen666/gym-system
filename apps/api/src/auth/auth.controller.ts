import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { ChangePasswordDto, LoginDto, RefreshDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('login') @HttpCode(200)
  login(@Body() d: LoginDto) { return this.auth.login(d.email, d.password); }

  @Public() @Post('refresh') @HttpCode(200)
  refresh(@Body() d: RefreshDto) { return this.auth.refresh(d.refreshToken); }

  @Public() @Post('logout') @HttpCode(204)
  logout(@Body() d: RefreshDto) { return this.auth.logout(d.refreshToken); }

  @Post('change-password') @HttpCode(204)
  changePassword(@CurrentUser() u: AuthUser, @Body() d: ChangePasswordDto) {
    return this.auth.changePassword(u.id, d.currentPassword, d.newPassword);
  }

  @Get('me')
  me(@CurrentUser() u: AuthUser) { return u; }
}