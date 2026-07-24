import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { apiServerErrors } from '../../operations/metrics';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  requestId: string | null;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const details = this.getExceptionDetails(exception);
    const requestId = request.header('x-request-id') ?? null;
    const body: ErrorResponse = {
      statusCode: status,
      ...details,
      path: request.originalUrl,
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      apiServerErrors.inc({
        method: request.method,
        status_code: String(status),
      });
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${request.method} ${request.originalUrl} failed`, stack);
    }

    response.status(status).json(body);
  }

  private getExceptionDetails(exception: unknown): Pick<ErrorResponse, 'error' | 'message'> {
    if (!(exception instanceof HttpException)) {
      return {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      };
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return {
        error: this.humanizeExceptionName(exception.name),
        message: response,
      };
    }

    const payload = response as {
      error?: string;
      message?: string | string[];
    };
    return {
      error: payload.error ?? this.humanizeExceptionName(exception.name),
      message: payload.message ?? exception.message,
    };
  }

  private humanizeExceptionName(name: string): string {
    return name
      .replace(/Exception$/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
  }
}
