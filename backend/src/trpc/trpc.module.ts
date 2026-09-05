import { Module } from '@nestjs/common';
import { TRPCModule } from 'nestjs-trpc';
import { UsersModule } from '../users/users.module';
import { UsersRouter } from '../users/users.router';

/**
 * Mounts the tRPC driver. Routers are discovered through the DI container:
 * any provider decorated with `@Router({ alias })` is composed onto the root
 * router automatically, so adding a feature router means providing it here.
 */
@Module({
  imports: [
    TRPCModule.forRoot({
      basePath: '/trpc',
    }),
    UsersModule,
  ],
  providers: [UsersRouter],
  exports: [TRPCModule],
})
export class TrpcAppModule {}
