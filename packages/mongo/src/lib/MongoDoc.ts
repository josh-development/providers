import { modelOptions, prop, Severity } from '@typegoose/typegoose';

@modelOptions({
	options: {
		allowMixed: Severity.ALLOW,
		customName: 'notification'
	}
})
export class MongoDocType {
	@prop({ required: true })
	public key!: string;

	@prop({ required: true })
	public value: any;
}
