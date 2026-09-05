import type { UsersRouter } from '../users/users.router';

/**
 * Type-only description of the composed tRPC router.
 *
 * nestjs-trpc builds the real router at runtime by scanning providers annotated
 * with `@Router({ alias })`; there is no value to export here. This alias exists
 * so client code can `import type { AppRouter }` and get end-to-end inference.
 *
 * When you add a router, add its alias to this type.
 *
 * The runtime root router instance is available by injecting `AppRouterHost`
 * from `nestjs-trpc`.
 */
export type AppRouter = {
  users: UsersRouter;
};
