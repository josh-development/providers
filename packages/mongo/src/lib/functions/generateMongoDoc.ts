import { Model, model } from 'mongoose';
import { MongoProvider } from '../MongoProvider';

export function generateMongoDoc(collectionName: string): Model<MongoProvider.DocType> {
  return model('MongoDoc', MongoProvider.schema, collectionName);
}
