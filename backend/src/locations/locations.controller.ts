import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationView, LocationsService } from './locations.service';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'All locations (populates the movement selects)' })
  findAll(): Promise<LocationView[]> {
    return this.locationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LocationView> {
    return this.locationsService.findOne(id);
  }

  @Post()
  @Roles(Role.MANAGER)
  create(@Body() dto: CreateLocationDto): Promise<LocationView> {
    return this.locationsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationView> {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.MANAGER)
  remove(@Param('id') id: string): Promise<{ id: string }> {
    return this.locationsService.remove(id);
  }
}
