import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Project } from './schemas/project.schema';

@Injectable()
export class ProjectsService {
  constructor(@InjectModel(Project.name) private model: Model<Project>) {}

  create(dto: Partial<Project>) {
    return this.model.create(dto);
  }

  findAllByUser(userId: string, teamId?: string) {
    const q: any = { createdBy: userId };
    if (teamId) q.teamId = teamId;
    return this.model.find(q).exec();
  }

  update(id: string, userId: string, dto: Partial<Project>) {
    return this.model.findOneAndUpdate({ _id: id, createdBy: userId }, dto, { new: true }).exec();
  }

  remove(id: string, userId: string) {
    return this.model.findOneAndDelete({ _id: id, createdBy: userId }).exec();
  }
}
