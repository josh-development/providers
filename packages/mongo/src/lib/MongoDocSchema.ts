import { Schema } from 'mongoose';

export const MongoDocSchema: Schema = new Schema({
  key: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true }
});
