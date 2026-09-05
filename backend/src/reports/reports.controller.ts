import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { LowStockRow, ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('low-stock')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Items at or below their reorder threshold' })
  lowStock(): Promise<LowStockRow[]> {
    return this.reportsService.lowStock();
  }
}
