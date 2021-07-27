export function get<Data extends Record<string, any>>(data: Data | undefined, path: string): Data | undefined {
	const fullPath = path.replace(/\[/g, '.').replace(/]/g, '').split('.').filter(Boolean);

	return fullPath.every((step) => !(step && (data = data?.[step]) === undefined)) ? data : undefined;
}
