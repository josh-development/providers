const Database = require('better-sqlite3');

// Lodash should probably be a core lib but hey, it's useful!
const {
  get: _get,
  set: _set,
  isNil,
  isArray,
  isFunction,
  toPath,
} = require('lodash');

// Native imports
const { resolve, sep } = require('path');
const fs = require('fs');

// Custom error codes with stack support.
const Err = require('./error.js');

module.exports = class JoshProvider {

  constructor(options) {
    if (!options.name) throw new Error('Must provide options.name');

    this.dataDir = resolve(process.cwd(), options.dataDir || 'data');

    if (!options.dataDir) {
      if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
      }
    }

    this.name = options.name;
    this.validateName();
    this.db = new Database(`${this.dataDir}${sep}josh.sqlite`);
  }

  /**
   * Internal method called on persistent Josh to load data from the underlying database.
   * @param {Map} Josh In order to set data to the Josh, one must be provided.
   * @returns {Promise} Returns the defer promise to await the ready state.
   */
  async init() {
    const table = this.db.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(this.name);
    if (!table['count(*)']) {
      this.db.prepare(`CREATE TABLE ${this.name} (key text PRIMARY KEY, value text)`).run();
      this.db.pragma('synchronous = 1');
      if (this.wal) this.db.pragma('journal_mode = wal');
    }
  }

  /**
   * Force fetch one or more key values from the database. If the database has changed, that new value is used.
   * @param {string|number} key A single key or array of keys to force fetch from the database.
   * @param {string} path The path to a value within an object or array value.
   * @return {Josh|*} The Josh, including the new fetched values, or the value in case the function argument is a single key.
   */
  get(key, path = []) {
    const row = this.db.prepare(`SELECT * FROM ${this.name} WHERE key = ?;`).get(key);
    const data = isNil(row) ? null : this.parseData(row.value);
    if (!data) return null;
    if (path.length) return _get(data, path);
    return data;
  }

  getAll() {
    const stmt = this.db.prepare(`SELECT * from ${this.name}`);
    return stmt.all().map(row => [row.key, JSON.parse(row.value)]);
  }

  getMany(keys) {
    return this.db.prepare(`SELECT * FROM ${this.name} WHERE key IN (${'?, '.repeat(keys.length).slice(0, -2)})`)
      .all(keys)
      .map(row => [row.key, JSON.parse(row.value)]);
  }

  async random(count = 1) {
    const data = await (await this.db.prepare(`SELECT * FROM '${this.name}' ORDER BY RANDOM() LIMIT ${count};`)).all();
    return count > 1 ? data : data[0];
  }

  async randomKey(count = 1) {
    const data = await (await this.db.prepare(`SELECT rowid FROM '${this.name}' ORDER BY RANDOM() LIMIT ${count};`)).all();
    return count > 1 ? data.map(row => row.key) : data[0].key;
  }

  async has(key, path = []) {
    if (path.length) {
      const data = this.get(key);
      if (!data) return false;
      return !isNil(_get(data, path));
    }
    const data = await (await this.db.prepare(`SELECT count(*) FROM '${this.name}' WHERE key = ?;`)).get(key);
    return data['count(*)'] === 1;
  }

  /**
   * Retrieves all the indexes (keys) in the database for this Josh, even if they aren't fetched.
   * @return {array<string>} Array of all indexes (keys) in the Josh, cached or not.
   */
  async keys() {
    const rows = await (await this.db.prepare(`SELECT key FROM '${this.name}';`)).all();
    return rows.map(row => row.key);
  }

  async values() {
    const rows = await (await this.db.prepare(`SELECT value FROM '${this.name}';`)).all();
    return rows.map(row => this.parseData(row.value));
  }

  /**
   * Retrieves the number of rows in the database for this Josh, even if they aren't fetched.
   * @return {integer} The number of rows in the database.
   */
  async count() {
    const data = await (await this.db.prepare(`SELECT count(*) FROM '${this.name}';`)).get();
    return data['count(*)'];
  }

  async set(key, path, val) {
    key = this.keyCheck(key);
    let data = await this.get(key);
    if (path.length) {
      if (isNil(data)) data = {};
      _set(data, path, val);
    } else {
      data = val;
    }
    await this.db.prepare(`INSERT OR REPLACE INTO ${this.name} (key, value) VALUES (?, ?);`).run(key, JSON.stringify(data));
    return this;
  }

  async delete(key, path) {
    if (path.length > 0) {
      const data = this.get(key);
      path = toPath(path);
      const last = path.pop();
      const propValue = path.length ? _get(data, path) : data;
      if (isArray(propValue)) {
        propValue.splice(last, 1);
      } else {
        delete propValue[last];
      }
      this.set(key, path, propValue);
    } else {
      await this.db.prepare(`DELETE FROM ${this.name} WHERE key = ?`).run(key);
    }
  }

  async clear() {
    this.db.exec(`DELETE FROM ${this.name}`);
  }

  async push(key, path, value, allowDupes) {
    await this.check(key, 'Array', path);
    const data = await this.get(key, path);
    if (!allowDupes && data.indexOf(value) > -1) return;
    data.push(value);
    this.set(key, path, data);
  }

  async remove(key, path, val) {
    await this.check(key, ['Array', 'Object'], path);
    const data = await this.get(key, path);
    const criteria = isFunction(val) ? val : value => val === value;
    const index = data.findIndex(criteria);
    if (index > -1) {
      data.splice(index, 1);
    }
    this.set(key, path, data);
    return this;
  }

  async inc(key, path) {
    await this.check(key, ['Number'], path);
    this.set(key, path, await this.get(key, path) + 1);
  }

  async dec(key, path) {
    await this.check(key, ['Number'], path);
    this.set(key, path, await this.get(key, path) - 1);
  }

  async findByFunction(fn, path) {
    const keys = await this.keys();
    while (keys.length > 0) {
      const currKey = keys.shift();
      const value = this.get(currKey);
      if (await fn(path ? _get(value, path) : value, currKey)) {
        return [value, currKey];
      }
    }
    return null;
  }

  async findByValue(value, path) {
    const keys = await this.keys();
    while (keys.length > 0) {
      const currKey = keys.shift();
      const val = this.get(currKey);
      if ((path ? _get(val, path) : val) === value) {
        return [val, currKey];
      }
    }
    return null;
  }

  async filterByFunction(fn, path) {
    const all = await this.getAll();
    const returnArray = [];
    for (const [key, value] of all) {
      if (await fn(path ? _get(value, path) : value, key)) {
        returnArray.push([key, value]);
      }
    }
    return returnArray;
  }

  async filterByValue(value, path) {
    return this.getAll().filter(([, val]) => (path ? _get(val, path) : val) === value);
  }

  close() {
    return this.db.close();
  }

  keyCheck(key) {
    if (isNil(key) || !['String', 'Number'].includes(key.constructor.name)) {
      throw new Error('josh-sqlite require keys to be strings or numbers.');
    }
    return key.toString();
  }

  /**
   * Internal method used to validate filename/tablename (valid Windows filenames)
   * @private
   */
  validateName() {
    // Do not delete this internal method.
    this.name = this.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  parseData(data) {
    try {
      return JSON.parse(data);
    } catch (err) {
      console.log('Error parsing data : ', err);
      return null;
    }
  }

  /*
   * INTERNAL method to verify the type of a key or property
   * Will THROW AN ERROR on wrong type, to simplify code.
   * @param {string|number} key Required. The key of the element to check
   * @param {string} type Required. The javascript constructor to check
   * @param {string} path Optional. The dotProp path to the property in JOSH.
   */
  // Herefore I indicate that I do understand part of this would be easily resolved with TypeScript but I don't do TS... yet.
  async check(key, type, path = null) {
    if (!await this.has(key)) throw new Err(`The key "${key}" does not exist in JOSH "${this.name}"`, 'JoshPathError');
    if (!type) return;
    if (!isArray(type)) type = [type];
    if (!isNil(path)) {
      await this.check(key, 'Object');
      const data = await this.get(key);
      if (isNil(_get(data, path))) {
        throw new Err(`The property "${path}" in key "${key}" does not exist. Please set() it or ensure() it."`, 'JoshPathError');
      }
      if (!type.includes(_get(data, path).constructor.name)) {
        throw new Err(`The property "${path}" in key "${key}" is not of type "${type.join('" or "')}" in JOSH "${this.name}" 
(key was of type "${_get(data, path).constructor.name}")`, 'JoshTypeError');
      }
    } else if (!type.includes((await this.get(key)).constructor.name)) {
      throw new Err(`The key "${key}" is not of type "${type.join('" or "')}" in JOSH "${this.name}" (key was of type "${this.get(key).constructor.name}")`, 'JoshTypeError');
    }
  }

};
