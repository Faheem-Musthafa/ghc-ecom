import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { readAccessToken } from '../session-cookie.service';

export const BearerToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    return readAccessToken(request) ?? '';
  },
);
