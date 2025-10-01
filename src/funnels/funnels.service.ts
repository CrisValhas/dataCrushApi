import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Funnel } from './schemas/funnel.schema';

@Injectable()
export class FunnelsService {
  constructor(@InjectModel(Funnel.name) private model: Model<Funnel>) {}

  create(dto: Partial<Funnel>) { return this.model.create(dto); }
  list(projectId: string) { return this.model.find({ projectId }).exec(); }
  update(id: string, dto: Partial<Funnel>) { return this.model.findByIdAndUpdate(id, dto, { new: true }).exec(); }
  remove(id: string) { return this.model.findByIdAndDelete(id).exec(); }
}
