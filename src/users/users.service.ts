import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';

import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async createLocalUser(email: string, password: string, displayName?: string) {
    const passwordHash = await argon2.hash(password);
    const user = new this.userModel({ email, passwordHash, displayName });
    return user.save();
  }

  async setPassword(userId: string, password: string) {
    const passwordHash = await argon2.hash(password);
    await this.userModel.updateOne({ _id: userId }, { $set: { passwordHash } }).exec();
  }
}
