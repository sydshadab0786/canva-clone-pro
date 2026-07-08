import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { FeatureFlagsService } from './feature-flags.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FeatureFlagDto, ListUsersQueryDto, UpdateUserAdminDto } from './dto/admin.dto';

/** Every route requires ADMIN or SUPER_ADMIN (enforced by the global RolesGuard). */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly analytics: AnalyticsService,
    private readonly flags: FeatureFlagsService,
  ) {}

  // ── Dashboard / analytics ────────────────────────────────────────
  @Get('overview')
  @ApiOperation({ summary: 'Headline platform metrics.' })
  overview() {
    return this.analytics.overview();
  }

  @Get('analytics/signups')
  @ApiOperation({ summary: 'Daily signups time series.' })
  signups(@Query('days') days?: string) {
    return this.analytics.signups(days ? Number(days) : 30);
  }

  @Get('analytics/projects')
  @ApiOperation({ summary: 'Daily projects-created time series.' })
  projects(@Query('days') days?: string) {
    return this.analytics.projectsCreated(days ? Number(days) : 30);
  }

  @Get('analytics/top-templates')
  @ApiOperation({ summary: 'Most-used templates.' })
  topTemplates() {
    return this.analytics.topTemplates(8);
  }

  @Get('analytics/activity')
  @ApiOperation({ summary: 'Activity breakdown by audit action.' })
  activity() {
    return this.analytics.activityByAction();
  }

  // ── Users ────────────────────────────────────────────────────────
  @Get('users')
  @ApiOperation({ summary: 'List users (search + filters).' })
  users(@Query() query: ListUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Change a user role/status (suspend, promote…).' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.admin.updateUser(id, dto);
  }

  // ── Subscriptions / audit ────────────────────────────────────────
  @Get('subscriptions')
  @ApiOperation({ summary: 'List subscriptions.' })
  subscriptions(@Query('page') page?: string) {
    return this.admin.listSubscriptions(page ? Number(page) : 1);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Browse the audit log.' })
  audit(@Query('action') action?: string, @Query('page') page?: string) {
    return this.admin.auditLogs({ action, page: page ? Number(page) : 1 });
  }

  // ── Feature flags ────────────────────────────────────────────────
  @Get('feature-flags')
  @ApiOperation({ summary: 'List feature flags.' })
  featureFlags() {
    return this.flags.list();
  }

  @Put('feature-flags')
  @ApiOperation({ summary: 'Create or update a feature flag.' })
  upsertFlag(@Body() dto: FeatureFlagDto) {
    return this.flags.upsert(dto);
  }
}
