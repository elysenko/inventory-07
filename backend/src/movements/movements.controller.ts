import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import {
  MovementPage,
  MovementView,
  MovementsService,
} from './movements.service';

@ApiTags('movements')
@ApiBearerAuth()
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post()
  @ApiOperation({ summary: 'Record a stock movement (any authenticated user)' })
  create(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MovementView> {
    return this.movementsService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Paginated audit log (manager and above)' })
  findAll(@Query() query: QueryMovementsDto): Promise<MovementPage> {
    return this.movementsService.findAll(query);
  }

  // Item-scoped history is readable by any signed-in user: it is the "movements"
  // tab of a page they can already open, unlike the org-wide audit log above.
  @Get('item/:itemId')
  @ApiOperation({ summary: 'Recent movements for one item' })
  findForItem(@Param('itemId') itemId: string): Promise<MovementView[]> {
    return this.movementsService.findForItem(itemId);
  }
}
