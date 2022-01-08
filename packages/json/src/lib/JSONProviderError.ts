import { JoshProviderError } from '@joshdb/core';

export class JSONProviderError extends JoshProviderError {
	public get name() {
		return 'JSONProviderError';
	}
}
