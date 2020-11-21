const { isArray, isObject } = require("lodash");
const serialize = require('serialize-javascript');
const onChange = require('on-change');

const serializeData = (data) => {
  let serialized;
  try {
    serialized = serialize(onChange.target(data));
  } catch(e) {
    serialized = serialize(data);
  }
  return serialized;
}

const getDelimitedPath = (base, key, valueIsArray) => {
  return valueIsArray 
    ? base ? `${base}[${key}]` : key
    : base ? `${base}.${key}` : key;
}

const getPaths = (data, acc = {}, basePath = null) => {
  if(data === '::NULL::') return {};
  if(!isObject(data)) {
    acc[basePath || '::NULL::'] = serializeData(data);
    return acc;
  }
  const source = isArray(data) ? data.map((d, i) => [i, d]) : Object.entries(data);
  const returnPaths = source.reduce((paths, [key, value]) => {
    const path = getDelimitedPath(basePath, key, !isArray(value));
    if(isObject(value)) getPaths(value, paths, path);
    paths[path.toString()] = serializeData(value);
    return paths;
  }, acc || {});
  return basePath ? returnPaths : ({...returnPaths, '::NULL::': serializeData(data)});
}

const parseQueryFields =(name, fields = []) => {
  if(!fields || fields.length === 0) return [' WHERE ', {}];
  let builder = ` WHERE key in (SELECT key FROM ${name} WHERE (`;
  const values = {}
  for(let i = 0; i < fields.length; i++) {
    const {operation, path, value, value2 , revert} = fields[i];
    switch (operation) {
      case 'eq':
      case '=':
      case '>':
      case '<':
      case '<>':
      case '!=':
      case '<=':
      case '>=':
        builder += ` (path=@path${i} AND value${fields[i].operation}@value${i})`;
        values[`path${i}`] = path;
        values[`value${i}`] = value;
        break;
      case 'like':
        builder += ` (path=@path${i} AND value ${revert ? 'NOT ' : ''} LIKE '%@value${i}%')`;
        values[`path${i}`] = path;
        values[`value${i}`] = value;
        break;
      case 'between':
        builder += ` (path=@path${i} AND value ${revert ? 'NOT ' : ''} BETWEEN @value${i} AND @secondValue${i})`;
        values[`path${i}`] = path;
        values[`value${i}`] = value;
        values[`secondValue${i}`] = value2;
        break;
      default:
        // missing: IN(1, 2, 3)
        throw new Error(`UNKNOWN OPERATION ${operation} FOR ${value} IN ${path}`);
    }
    if(!isNil(fields[i]) && !isNil(fields[i].operation) && !isNil(fields[i].path) && !isNil(fields[i].value)) {
      switc
      builder += ` (path=@path${i} AND value${fields[i].operation}@value${i})`;
    } else {
      console.error("UNKNOWN FIELD: ", fields[i]);
    }
  }
  return [`${builder}) AND`, values];
}

const buildQuery = (opts, name) => {
      // SELECT key, value FROM testing WHERE key IN (SELECT key FROM testing WHERE path='count' AND CAST(value as INTEGER) > 500) AND path = '::NULL::';
      let query = `SELECT key, value FROM ${name}`;
      let [builder, values] = parseQueryFields(name, opts.fields);
      if(opts.sort) {
        builder += ' ORDER BY @sort';
        values.sort = opts.sort;
      }
      if(opts.limit) {
        builder += ' LIMIT @limit';
        values.limit = opts.limit;
      }
      query += `${builder} ${opts.sort || opts.limit ? ' AND ' : ' WHERE '}  path='::NULL::'`;
      
      return [builder, values];
}

const sanitize = str => str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
  switch (char) {
    case "\0":
      return "\\0";
    case "\x08":
      return "\\b";
    case "\x09":
      return "\\t";
    case "\x1a":
      return "\\z";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\"":
    case "'":
    case "\\":
    case "%":
      return "\\"+char;
    default:
      return char;
  }
});

module.exports = {
    getPaths,
    serializeData,
    buildQuery,
    sanitize,
};
