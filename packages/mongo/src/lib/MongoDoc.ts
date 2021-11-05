import type { MongoDocType } from './MongoDocType';
import { MongoDocSchema } from './MongoDocSchema';
import mongoose, { Model } from 'mongoose';

export function generateMongoDoc(collectionName: string): Model<MongoDocType> {
	return mongoose.model('MongoDoc', MongoDocSchema, collectionName);
}
