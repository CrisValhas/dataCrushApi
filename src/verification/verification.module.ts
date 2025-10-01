import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { VerificationRun, VerificationRunSchema } from './schemas/verification-run.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VerificationRun.name, schema: VerificationRunSchema }]),
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
