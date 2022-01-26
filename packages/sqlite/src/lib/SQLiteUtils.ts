import { isObject } from '@sapphire/utilities';
import serialize from 'serialize-javascript';
import onChange from 'on-change';

export const serializeData = (data: any) => {
	let serialized;

	try {
		serialized = serialize(onChange.target(data));
	} catch (err) {
		serialized = serialize(data);
	}

	return serialized;
};

const getDelimitedPath = (base: unknown, key: string, parentIsArray: boolean) =>
	parentIsArray ? (base ? `${base}[${key}]` : key) : base ? `${base}.${key}` : key;

export const getPaths = (data: any, acc = {}, basePath = null) => {
	if (data === '::NULL::') return {};
	if (!isObject(data)) {
		acc[basePath || '::NULL::'] = serializeData(data);

		return acc;
	}

	const source = Array.isArray(data) ? data.map((da, i) => [i, da]) : Object.entries(data);
	const returnPaths = source.reduce((paths, [key, value]) => {
		const path = getDelimitedPath(basePath, key, Array.isArray(data));

		if (isObject(value)) getPaths(value, paths, path);

		paths[path.toString()] = serializeData(value);

		return paths;
	}, acc || {});

	return basePath ? returnPaths : { ...returnPaths, '::NULL::': serializeData(data) };
};
