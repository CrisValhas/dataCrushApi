import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { VerificationRun } from './schemas/verification-run.schema';

@Injectable()
export class VerificationService {
  constructor(@InjectModel(VerificationRun.name) private model: Model<VerificationRun>) {}

  async run(projectId: string) {
    const run = await this.model.create({ projectId, status: 'running', results: [] });
    // Simulate async verification
    setTimeout(async () => {
      run.status = 'done';
      run.results = [
        { eventId: 'evt1', state: 'implemented', lastSeenAt: new Date() },
        { eventId: 'evt2', state: 'pending' },
      ];
      await run.save();
    }, 1000);
    return run;
  }

  async get(runId: string) {
    return this.model.findById(runId).exec();
  }
}
