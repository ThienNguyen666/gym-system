import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api'); // khớp proxy '/api' của Vite
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: ['http://localhost:5173'] });

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Gym System API').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, doc);

  await app.listen(3000);
}
bootstrap();