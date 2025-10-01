import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';
import { ProjectFigmaFile, ProjectFigmaFileSchema } from '../projects/schemas/project-figma-file.schema';
import { FigmaService } from '../integrations/figma.service';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectFigmaFile.name, schema: ProjectFigmaFileSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DesignsController],
  providers: [DesignsService, FigmaService],
})
export class DesignsModule {}
