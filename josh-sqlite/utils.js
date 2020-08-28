const { isArray, isObject } = require("lodash");

const getDelimitedPath = (base, key, valueIsArray) => valueIsArray 
  ? base ? `${base}["${key}"]` : key
  : base ? `${base}.${key}` : key;

const getPaths = (data, acc = {}, basePath = null) => {
  if(data === '::NULL::') return {};
  if(!isObject(data)) {
    acc[basePath || '::NULL::'] = JSON.stringify(data);
    return acc;
  }
  const source = isArray(data) ? data.map((d, i) => [i, d]) : Object.entries(data);
  const returnPaths = source.reduce((paths, [key, value]) => {
    const path = getDelimitedPath(basePath, key, !isArray(value));
    if(isObject(value)) getPaths(value, paths, path);
    paths[path.toString()] = JSON.stringify(value);
    return paths;
  }, acc || {});
  return basePath ? returnPaths : ({...returnPaths, '::NULL::': JSON.stringify(data)});
}

module.exports = {
    getPaths,
};
