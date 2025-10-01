import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { IntegrationsController } from './integrations.controller';
import { FigmaService } from './figma.service';
import { GtmService } from './gtm.service';
import { Ga4Service } from './ga4.service';
import { LookerService } from './looker.service';
import { PlatformConnection, PlatformConnectionSchema } from './schemas/platform-connection.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ProjectFigmaFile, ProjectFigmaFileSchema } from '../projects/schemas/project-figma-file.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformConnection.name, schema: PlatformConnectionSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Event.name, schema: EventSchema },
      { name: User.name, schema: UserSchema },
      { name: ProjectFigmaFile.name, schema: ProjectFigmaFileSchema },
    ]),
  ],
  controllers: [IntegrationsController],
  providers: [FigmaService, GtmService, Ga4Service, LookerService],
})
export class IntegrationsModule {}
