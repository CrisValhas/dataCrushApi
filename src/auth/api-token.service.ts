import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';

import { User, UserDocument } from '../users/schemas/user.schema';

function randomPrefix(len = 6) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function randomToken(len = 24) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

@Injectable()
export class ApiTokenService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async createToken(userId: string, name: string, scopes: string[] = []) {
    const prefix = randomPrefix();
    const secret = randomToken();
    const value = `aw_${prefix}_${secret}`;
    const hash = await argon2.hash(value);
    await this.userModel.updateOne(
      { _id: userId },
      { $push: { apiTokens: { name, hash, prefix, scopes, createdAt: new Date() } } },
    );
    return value; // show once
  }

  async revokeToken(userId: string, tokenId: string) {
    await this.userModel.updateOne({ _id: userId }, { $pull: { apiTokens: { _id: tokenId } } });
  }
}
