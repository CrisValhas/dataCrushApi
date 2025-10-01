import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { validateEnv } from './config/validation';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { EventsModule } from './events/events.module';
import { MeasurementModule } from './measurement/measurement.module';
import { DesignsModule } from './designs/designs.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { VerificationModule } from './verification/verification.module';
import { FunnelsModule } from './funnels/funnels.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { TeamsModule } from './teams/teams.module';
import { TokensModule } from './tokens/tokens.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    MongooseModule.forRoot(process.env.MONGO_URI as string),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    AuthModule,
    UsersModule,
    ProjectsModule,
    EventsModule,
    MeasurementModule,
    DesignsModule,
    IntegrationsModule,
    VerificationModule,
    FunnelsModule,
    DashboardsModule,
    TeamsModule,
    TokensModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
