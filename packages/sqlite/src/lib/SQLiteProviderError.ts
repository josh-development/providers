import { JoshProviderError } from '@joshdb/core';

export class SQLiteProviderError extends JoshProviderError {
	/**
	 * The name for this error.
	 */
	public get name() {
		return 'SQLiteProviderError';
	}
}
