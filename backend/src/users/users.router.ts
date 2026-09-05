import { Injectable } from '@nestjs/common';
import { Router, Query, Input } from 'nestjs-trpc';
import { z } from 'zod';
import { UsersService } from './users.service';

/** Wire shape of a user. The password hash is deliberately never exposed. */
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: z.enum(['USER', 'MANAGER', 'ADMIN']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

@Injectable()
@Router({ alias: 'users' })
export class UsersRouter {
  constructor(private readonly usersService: UsersService) {}

  @Query({ output: z.array(userSchema) })
  async findAll() {
    return this.usersService.findAll();
  }

  @Query({
    input: z.object({ id: z.string().uuid() }),
    output: userSchema.nullable(),
  })
  async findById(@Input('id') id: string) {
    return this.usersService.findById(id);
  }
}
