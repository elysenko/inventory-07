import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok';
}

export interface DeepHealthStatus {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
}

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness. Answers from process state alone so a database blip never causes
   * Kubernetes to restart an otherwise-healthy pod.
   */
  @Get()
  @ApiOperation({ summary: 'Liveness — the process is up' })
  check(): HealthStatus {
    return { status: 'ok' };
  }

  /**
   * Readiness. Actually touches Postgres. Reports `degraded` with a 200 rather
   * than throwing, so a probe or a human gets the reason instead of a 500.
   */
  @Get('deep')
  @ApiOperation({ summary: 'Readiness — the process can reach Postgres' })
  async deep(): Promise<DeepHealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      return { status: 'degraded', db: 'down' };
    }
  }
}
