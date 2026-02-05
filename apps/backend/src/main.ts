import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  // Use Pino logger
  app.useLogger(app.get(Logger))

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )

  // CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? process.env.CORS_ORIGINS?.split(',') : true,
    credentials: true,
  })

  // Swagger documentation
  const config = app.get(ConfigService)
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Qartuli Vici Bot API')
      .setDescription('API for Georgian language learning Telegram bot')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build()

    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document)
  }

  // Start server
  const port = config.get('PORT', 3000)
  await app.listen(port)

  const logger = app.get(Logger)
  logger.log(`Application is running on: http://localhost:${port}`)
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`)
}

bootstrap()
