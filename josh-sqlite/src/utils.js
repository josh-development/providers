const { isArray, isObject } = require('lodash');
const serialize = require('serialize-javascript');
const onChange = require('on-change');

const serializeData = (data) => {
  let serialized;
  try {
    serialized = serialize(onChange.target(data));
  } catch (err) {
    serialized = serialize(data);
  }
  return serialized;
};

const getDelimitedPath = (base, key, parentIsArray) =>
  parentIsArray ?
    base ?
      `${base}[${key}]` :
      key :
    base ?
      `${base}.${key}` :
      key;

const getPaths = (data, acc = {}, basePath = null) => {
  if (data === '::NULL::') return {};
  if (!isObject(data)) {
    acc[basePath || '::NULL::'] = serializeData(data);
    return acc;
  }
  const source = isArray(data) ?
    data.map((da, i) => [i, da]) :
    Object.entries(data);
  const returnPaths = source.reduce((paths, [key, value]) => {
    const path = getDelimitedPath(basePath, key, isArray(data));
    if (isObject(value)) getPaths(value, paths, path);
    paths[path.toString()] = serializeData(value);
    return paths;
  }, acc || {});
  return basePath
    ? returnPaths
    : { ...returnPaths, '::NULL::': serializeData(data) };
};

const sanitize = (str) =>
  str.replace(/[\0\\x08\\x09\\x1a\n\r"'\\]/g, (char) => {
    switch (char) {
    case '\0':
      return '\\0';
    case '\x08':
      return '\\b';
    case '\x09':
      return '\\t';
    case '\x1a':
      return '\\z';
    case '\n':
      return '\\n';
    case '\r':
      return '\\r';
    case '"':
    case "'":
    case '\\':
    case '%':
      return `\\${char}`;
    default:
      return char;
    }
  });

module.exports = {
  getPaths,
  serializeData,
  sanitize,
  serialize,
  onChange,
  isObject,
};
