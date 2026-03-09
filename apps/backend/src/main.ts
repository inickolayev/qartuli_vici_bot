import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })

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

  // Get config
  const config = app.get(ConfigService)

  // Serve static files for chat testing interface (development only)
  if (config.get('NODE_ENV') !== 'production') {
    // Use process.cwd() for reliable path resolution in both dev and compiled modes
    app.useStaticAssets(join(process.cwd(), 'public'), {
      prefix: '/chat/',
    })
  }

  // Swagger documentation
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
  if (config.get('NODE_ENV') !== 'production') {
    logger.log(`Chat testing UI: http://localhost:${port}/chat/chat.html`)
  }
}

bootstrap()
