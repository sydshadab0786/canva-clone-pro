import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Shape attached to `request.user` by JwtStrategy.validate(). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

/** Injects the authenticated user (or one of its fields) into a handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
