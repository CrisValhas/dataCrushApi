import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class ApiToken {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  hash!: string;

  @Prop({ type: String, required: true })
  prefix!: string;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;

  @Prop({ type: Date, default: null })
  lastUsedAt?: Date | null;
}

const ApiTokenSchema = SchemaFactory.createForClass(ApiToken);

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, unique: true })
  email!: string;

  @Prop({ type: String, required: false })
  passwordHash?: string;

  @Prop({ type: String, required: false })
  displayName?: string;

  @Prop({ type: String, required: false })
  avatarUrl?: string;

  @Prop({ type: Object, default: {} })
  providers?: {
    google?: { id: string; email?: string; oauth?: { accessToken: string; refreshToken?: string; expiresAt?: string } };
    figma?: { id: string; oauth?: { accessToken: string; refreshToken?: string; expiresAt?: string } };
  };

  @Prop({
    type: [
      {
        teamId: { type: String, required: true },
        role: { type: String, enum: ['owner', 'admin', 'editor', 'viewer'], required: true },
      },
    ],
    default: [],
  })
  rolesByTeam!: { teamId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' }[];

  @Prop({ type: [ApiTokenSchema], default: [] })
  apiTokens!: ApiToken[];
}

export const UserSchema = SchemaFactory.createForClass(User);
