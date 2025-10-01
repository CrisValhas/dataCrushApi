import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Event } from './schemas/event.schema';

@Injectable()
export class EventsService {
  constructor(@InjectModel(Event.name) private model: Model<Event>) {}

  create(dto: Partial<Event>) {
    return this.model.create(dto);
  }
  findAll(projectId: string, userId: string) {
    return this.model.find({ projectId, createdBy: userId }).exec();
  }
  update(id: string, userId: string, dto: Partial<Event>) {
    return this.model.findOneAndUpdate({ _id: id, createdBy: userId }, dto, { new: true }).exec();
  }
  remove(id: string, userId: string) {
    return this.model.findOneAndDelete({ _id: id, createdBy: userId }).exec();
  }

  async countsByProject(userId: string, projectIds?: string[]) {
    const match: any = { createdBy: userId };
    if (projectIds && projectIds.length > 0) {
      match.projectId = { $in: projectIds };
    }
    const res = await this.model.aggregate([
      { $match: match },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]);
    const map: Record<string, number> = {};
    for (const r of res) map[String(r._id)] = r.count as number;
    return map;
  }
}
