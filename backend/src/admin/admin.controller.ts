import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminSettingsService, SettingsResponse } from './admin-settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/settings')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Backing-service credentials, secrets masked' })
  list(): Promise<SettingsResponse> {
    return this.settings.list();
  }

  @Patch()
  @ApiOperation({ summary: 'Override credentials without a redeploy' })
  update(@Body() dto: UpdateSettingsDto): Promise<SettingsResponse> {
    return this.settings.update(dto);
  }
}
