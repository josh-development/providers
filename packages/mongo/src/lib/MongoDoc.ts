import { modelOptions, prop, Severity } from '@typegoose/typegoose';

@modelOptions({
	options: {
		allowMixed: Severity.ALLOW,
		customName: 'notification'
	}
})
export class MongoDoc {
	@prop({ required: true })
	public key!: string;

	@prop({ required: true })
	public value: unknown;
}
