import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { CsrfService } from './auth/csrf.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

export function configureApplication(app: NestExpressApplication): void {
  const config = app.get(ConfigService);

  app.disable('x-powered-by');
  const trustedProxyHops = config.getOrThrow<number>('TRUST_PROXY_HOPS');
  if (trustedProxyHops > 0) app.set('trust proxy', trustedProxyHops);
  const bodyLimit = config.getOrThrow<string>('API_BODY_LIMIT');
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', {
    limit: bodyLimit,
    extended: false,
    parameterLimit: 100,
  });
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use((request: Request, response: Response, next: NextFunction) => {
    const suppliedRequestId = request.header('x-request-id');
    const requestId =
      suppliedRequestId && /^[a-zA-Z0-9._:-]{1,128}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_ORIGIN'),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'x-cart-token',
      'x-csrf-token',
      'x-request-id',
    ],
    exposedHeaders: ['x-request-id'],
    maxAge: 86_400,
  });
  app.use(app.get(CsrfService).protection());
  app.setGlobalPrefix('api/v1');

  if (config.getOrThrow<boolean>('ENABLE_SWAGGER')) {
    const openApiConfig = new DocumentBuilder()
      .setTitle('GHC Ecommerce API')
      .setDescription('Backend API for catalogue, checkout, orders, and payments.')
      .setVersion('1.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build();
    const documentFactory = (): OpenAPIObject => SwaggerModule.createDocument(app, openApiConfig);

    SwaggerModule.setup('docs', app, documentFactory, {
      useGlobalPrefix: true,
    });
  }
}
