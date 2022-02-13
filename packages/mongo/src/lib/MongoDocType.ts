import type { Document } from 'mongoose';

export interface MongoDocType extends Document {
  key: string;
  value: string;
}
