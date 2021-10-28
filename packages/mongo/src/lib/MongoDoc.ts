import { prop } from '@typegoose/typegoose';

export class MongoDocType {
	@prop({ required: true })
	public key!: string;

	@prop({ required: true })
	public value: any;
}
