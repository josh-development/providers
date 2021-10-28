import { JoshProviderError } from '@joshdb/core';

export class MongoProviderError extends JoshProviderError {
	/**
	 * The name for this error.
	 */
	public get name() {
		return 'MongoProviderError';
	}
}
