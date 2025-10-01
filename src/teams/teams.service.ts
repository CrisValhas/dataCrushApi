import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Team } from './schemas/team.schema';

@Injectable()
export class TeamsService {
  constructor(@InjectModel(Team.name) private model: Model<Team>) {}

  create(dto: Partial<Team>) { return this.model.create(dto); }
  list() { return this.model.find().exec(); }
  update(id: string, dto: Partial<Team>) { return this.model.findByIdAndUpdate(id, dto, { new: true }).exec(); }
  remove(id: string) { return this.model.findByIdAndDelete(id).exec(); }
}
