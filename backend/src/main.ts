import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApplication } from './application';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bufferLogs: true,
    logger: new ConsoleLogger({ json: true, colors: false }),
    rawBody: true,
    bodyParser: false,
  });
  const config = app.get(ConfigService);

  configureApplication(app);
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  const host = config.getOrThrow<string>('HOST');
  const server = await app.listen(port, host);
  server.requestTimeout = config.getOrThrow<number>('HTTP_REQUEST_TIMEOUT_MS');
  server.headersTimeout = config.getOrThrow<number>('HTTP_HEADERS_TIMEOUT_MS');
  server.keepAliveTimeout = config.getOrThrow<number>('HTTP_KEEP_ALIVE_TIMEOUT_MS');
  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.stack : String(error), 'Bootstrap');
  process.exitCode = 1;
});
