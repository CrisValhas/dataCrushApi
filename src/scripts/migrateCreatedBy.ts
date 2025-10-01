/*
  Usage examples (run from repo root using cmd on Windows):
    - Set owner by email using default URI:
        cd backend && npm run migrate:createdBy -- --email you@example.com
    - Explicit URI (if backend uses docker 'mongo' host, use localhost here):
        cd backend && npm run migrate:createdBy -- --email you@example.com --uri mongodb://localhost:27017/analytics_weaver
*/
import { connect, connection, model } from 'mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--email' && args[i + 1]) out.email = args[++i];
    else if (a === '--uri' && args[i + 1]) out.uri = args[++i];
  }
  return out;
}

async function main() {
  const { email, uri } = parseArgs();
  if (!email) {
    console.error('Missing --email <ownerEmail>');
    process.exit(1);
  }
  const mongoUri = uri || process.env.MONGO_URI || 'mongodb://localhost:27017/analytics_weaver';
  await connect(mongoUri);

  const UserModel = model<User>('User', UserSchema, 'users');
  const ProjectModel = model<Project>('Project', ProjectSchema, 'projects');
  const EventModel = model<Event>('Event', EventSchema, 'events');

  const user = await UserModel.findOne({ email }).exec();
  if (!user) {
    console.error(`User not found for email: ${email}`);
    process.exit(2);
  }
  const ownerId = String((user as any)._id);

  const resProj = await ProjectModel.updateMany(
    { $or: [{ createdBy: { $exists: false } }, { createdBy: null }] },
    { $set: { createdBy: ownerId } },
  );

  const resEv = await EventModel.updateMany(
    { $or: [{ createdBy: { $exists: false } }, { createdBy: null }] },
    { $set: { createdBy: ownerId } },
  );

  console.log('Migration completed');
  console.log('Projects matched:', resProj.matchedCount, 'modified:', resProj.modifiedCount);
  console.log('Events matched:', resEv.matchedCount, 'modified:', resEv.modifiedCount);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    if (connection.readyState) await connection.close();
  });

