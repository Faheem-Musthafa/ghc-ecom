import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { authorizationValue } from '../session-cookie.service';

export const AuthorizationValue = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    return authorizationValue(request);
  },
);
