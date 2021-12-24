const { get: _get, set: _set, unset, isFunction, isNil } = require('lodash');
const Err = require('./error');
const { FileManager } = require('./files.js');
const uuidv4 = require('uuid').v4;
const path = require('path');

class JoshProvider {
  constructor(options = {}) {
    this.options = options;
    this.dir = this.options.dataDir
      ? path.resolve(this.options.dataDir)
      : './data/' + (this.options.name || 'default');
    this.files = new FileManager(this.dir, options.providerOptions);
    this.indexAll = this.options.indexAll ?? false;
    this.cleanupEmpty = this.options.cleanupEmpty ?? false;
  }
  /**
   * Internal method called on persistent joshs to load data from the underlying database.
   * @param {Map} josh In order to set data to the josh, one must be provided.
   * @returns {Promise} Returns the defer promise to await the ready state.
   */
  async init() {
    if (this.options.indexAll) await this.files.indexAll();
    if (this.options.cleanupEmpty) await this.files.cleanupEmpty();
    return true;
  }

  /**
   * Fetch the value of a key in the database
   * @param {(string|number)} key The document key to fetch
   * @param {(string|null)} path The path in the document to get
   * @returns {Promise} Resolves to the value
   * @example
   * ```
   * await JoshProvider.get("josh")
   * ```
   */
  async get(key, path = null) {
    const data = await this.files.getData(key);
    return path ? _get(data, path) : data;
  }

  async getAll() {
    await this.check();
    const data = await this.files.getData();
    return data;
  }
  /**
   * Fetch multiple keys from the database
   * @param {string[]} arr Multiple keys to fetch from the database
   * @returns {Object} Returns object with each key mapped to its value
   * @example
   * ```
   * await JoshProvider.getMany([ "josh", 123 ])
   * ```
   */
  async getMany(arr) {
    await this.check();
    const data = await this.files.getData();
    const final = {};
    Object.entries(data).forEach(([key, val]) => {
      if (arr.includes(key)) {
        final[key] = val;
      }
    });
    return final;
  }

  async random(count = 1) {
    await this.check();
    let docs = Object.entries(await this.getAll()) || [];
    const final = {};
    if (docs.length === 0) return {};
    for (let n = 0; n < count; n++) {
      const idx = Math.floor(Math.random() * docs.length);
      const [key, val] = docs[idx];
      docs = docs.filter((x) => x[0] != key);
      final[key] = val;
    }
    return final;
  }

  async randomKey(count = 1) {
    await this.check();
    const docs = Object.entries(await this.random(count));
    return docs.map(([key]) => key);
  }

  /**
   * Check for key in database
   * @param {(string|number)} key The document key to check
   * @param {string} path The path in document to check
   * @return {boolean} True if key is found in database
   * @example
   * ```
   * await JoshProvider.has("number")
   * ```
   */
  async has(key, path = null) {
    await this.check();
    return await this.files.has(key, path);
  }

  /**
   * Fetch all keys within a query
   * @param {Object} query Query to filter the keys by
   * @returns {Array}
   * @example
   * ```
   * await JoshProvider.keys()
   * ```
   */
  async keys() {
    await this.check();
    const docs = await this.files.getData();
    return Object.entries(docs).map(([key]) => key);
  }

  /**
   * Fetch all values in the database
   * @param {Object} query Query to filter the values by
   * @returns {Array}
   * @example
   * ```
   * await JoshProvider.values()
   * ```
   */
  async values() {
    await this.check();
    const docs = await this.files.getData();
    return Object.entries(docs).map((doc) => doc[1]);
  }

  /**
   * Count the documents in the database
   * @param {Object} query This filters the documents counted
   * @returns {Promise}
   * @example
   * ```
   * await JoshProvider.count()
   * ```
   */
  async count() {
    return await this.files.getCount();
  }

  /**
   * Set a value to the josh.
   * @param {(string|number)} key Required. The key of the element to add to the josh object.
   * @param {(string|null)} path Required but null is allowed. The path to add the value to the document
   * @param {*} val Required. The value of the element to add to the josh object.
   * This value MUST be stringifiable as JSON.
   * @example
   * ```
   * await JoshProvider.set("josh", { hello: "world" })
   * ```
   */
  async set(key, path, val) {
    await this.check();
    if (!key) {
      throw new Error('Keys should be strings or numbers.');
    }
    let data = (await this.files.getData(key)) || {};
    if (path) {
      _set(data, path, val);
    } else {
      data = val;
    }
    await this.files.setData(key, data);
    return this;
  }

  /**
   * Set many keys and values
   * @param {Object} obj This is a {key: value} object to be set in the database
   * @param {boolean} overwrite Whether or not to overwrite existing values or ignore
   * @example
   * ```
   * await JoshProvider.setMany([ ["hello", "world"], ["josh": true], ["foo", true, "alive"] ])
   * ```
   */
  async setMany(obj, overwrite) {
    await this.check();
    for (const [key, val] of Object.entries(obj)) {
      const found = await this.get(key);
      if (!found || (found && overwrite)) {
        await this.set(key, null, val);
      }
    }
    return this;
  }

  /**
   * Delete a document from the database
   * @param {(string|value)} key The document key to delete
   * @param {(string)} path The path in the value to delete
   * @example
   * ```
   * await JoshProvider.delete("josh");
   * ```
   */
  async delete(key, path = null) {
    await this.check();
    const data = await this.files.getData(key);
    if (!path || path.length === 0) {
      await this.files.deleteData(key);
      return this;
    } else {
      // TODO : Make this work for arrays (null value)
      unset(data, path);
    }
    await this.set(key, null, data);
    return this;
  }

  /**
   * Delete multiple documents from the database
   * @param {Array} arr Multiple keys to be deleted
   * @example
   * ```
   * await JoshProvider.deleteMany(["josh", "mongo", "number", 12])
   * ```
   */
  async deleteMany(arr) {
    await this.check();
    for (const key of arr) {
      await this.delete(key);
    }
    return this;
  }

  /**
   * Deletes all entries in the database.
   * @return {Promise<*>} Promise returned by the database after deletion
   * @example
   * ```
   * await JoshProvider.clear()
   * ```
   */
  async clear() {
    await this.check();
    await this.files.deleteAll();
    return this;
  }

  async push(key, path, value, allowDupes) {
    await this.check(key, ['Array'], path);
    const data = await this.get(key, path);
    if (!allowDupes && data.indexOf(value) > -1) return this;
    data.push(value);
    await this.set(key, path, data);
    return this;
  }

  async remove(key, path, val) {
    await this.check(key, ['Array'], path);
    const data = await this.get(key, path);
    const criteria = isFunction(val) ? val : (value) => val === value;
    const index = data.findIndex(criteria);
    if (index > -1) {
      data.splice(index, 1);
      await this.set(key, path, data);
    }
    return this;
  }

  async includes(key, path = null, val) {
    await this.check(key, ['Array'], path);
    const data = await this.get(key, path);
    if (!data) return;
    const criteria = isFunction(val) ? val : (value) => val === value;
    const index = data.findIndex(criteria);
    return index > -1;
  }

  /**
   * Increment the value of a document by 1
   * @param {(string|number)} key The document key to increment
   * @param {string} path The path in document to increment
   * @example
   * ```
   * await JoshProvider.inc("joshes")
   * ```
   */
  async inc(key, path = null) {
    await this.check(key, ['Number'], path);
    return this.set(key, path, (await this.get(key, path)) + 1);
  }

  /**
   * Decrement the value of a document by 1
   * @param {(string|number)} key The document key to decrement
   * @param {string} path The path in the document to decrement
   * @example
   * ```
   * await JoshProvider.dec("joshes")
   * ```
   */
  async dec(key, path = null) {
    await this.check(key, ['Number'], path);
    return this.set(key, path, (await this.get(key, path)) - 1);
  }

  /**
   * Perform mathmatical operations on the value of a document
   * @param {(string|number)} key The document key to transform
   * @param {string} path The path in document to transform
   * @param {string} operation Valid operations are add, subtract, multiply, divide, exponent, modulo and random
   * @param {number} operand The number to transform the value with
   * @example
   * ```
   * await JoshProvider.math('number', 'multiply', 2)
   * await JoshProvider.math('number', '/', 2) // divide
   * await JoshProvider.math('number', 'exp', 2) // exponent
   * ```
   */
  async math(key, path = null, operation, operand) {
    await this.check(key, ['Number'], path);
    const base = await this.get(key, path);
    let result = null;
    if (isNil(base) || isNil(operation) || isNil(operand)) {
      throw new Err(
        'Math operation requires base, operation and operand parameters',
        'JoshTypeError',
      );
    }
    switch (operation) {
      case 'add':
      case 'addition':
      case '+':
        result = base + operand;
        break;
      case 'sub':
      case 'subtract':
      case '-':
        result = base - operand;
        break;
      case 'mult':
      case 'multiply':
      case '*':
        result = base * operand;
        break;
      case 'div':
      case 'divide':
      case '/':
        result = base / operand;
        break;
      case 'exp':
      case 'exponent':
      case '^':
        result = Math.pow(base, operand);
        break;
      case 'mod':
      case 'modulo':
      case '%':
        result = base % operand;
        break;
      case 'rand':
      case 'random':
        result = Math.floor(Math.random() * Math.floor(operand));
        break;
      default:
        throw new Err('Please provide a valid operand', 'JoshTypeError');
    }
    if (result) {
      await this.set(key, path, result);
    }
    return this;
  }

  async findByValue(path, value) {
    await this.check();
    const docs = Object.entries(await this.getAll()).map((doc) => ({
      key: doc[0],
      value: doc[1],
    }));
    for (const doc of docs) {
      if (
        isNil(value)
          ? _get(doc.value, path)
          : path
          ? value == _get(doc.value, path)
          : value == doc.value
      ) {
        return { [doc.key]: doc.value };
      }
    }
  }

  async findByFunction(fn) {
    await this.check();
    const docs = Object.entries(await this.getAll()).map((doc) => ({
      key: doc[0],
      value: doc[1],
    }));
    for (const doc of docs) {
      if (fn(doc.value)) {
        return { [doc.key]: doc.value };
      }
    }
  }

  async filterByValue(path, value) {
    await this.check();
    const docs = Object.entries(await this.getAll());
    const finalDoc = {};
    for (const [key, val] of docs) {
      if (
        isNil(value)
          ? _get(val, path)
          : path
          ? value == _get(val, path)
          : value == val
      ) {
        finalDoc[key] = val;
      }
    }
    return finalDoc;
  }

  async filterByFunction(fn) {
    await this.check();
    const docs = Object.entries(await this.getAll());
    const finalDoc = [];
    for (const [key, value] of docs) {
      if (fn(value)) {
        finalDoc.push([key, value]);
      }
    }
    return finalDoc;
  }

  async mapByValue() {
    await this.check();
    throw new Error('Not yet implemented');
  }

  async mapByFunction(fn) {
    await this.check();
    let all = await Object.entries(await this.getAll());
    all = all.map(([key, value]) => fn(value, key));
    return all;
  }

  async someByValue(path, value) {
    await this.check();
    const docs = Object.entries(await this.getAll()).map((doc) => ({
      key: doc[0],
      value: doc[1],
    }));
    return docs.some((doc) =>
      path ? _get(doc.value, path) == value : doc.value == value,
    );
  }

  async someByFunction(fn) {
    await this.check();
    const docs = Object.entries(await this.getAll());
    return docs.some(([key, value]) => fn(value, key));
  }

  async everyByValue(path, value) {
    await this.check();
    const docs = Object.entries(await this.getAll()).map((doc) => ({
      key: doc[0],
      value: doc[1],
    }));
    return docs.every((doc) =>
      path ? _get(doc.value, path) == value : doc.value == value,
    );
  }

  async everyByFunction(fn) {
    await this.check();
    const all = Object.entries(await this.getAll());
    return all.every(([key, value]) => fn(value, key));
  }

  autoId() {
    return uuidv4();
  }

  /**
   * Shuts down the underlying database.
   * @returns {Promise} Promise resolves when finished closing
   */
  close() {
    delete this.files;
    return this;
  }

  /**
   * Clears and shuts down the underlying database.
   * @returns {Promise} Promise resolves when finished closing
   */
  async destroy() {
    await this.files.deleteAll();
    return this.close();
  }

  /**
   * Internal method used to check validity of the database and value of doc to change
   * @param {Array} key key to fetch from database
   * @param {any} type Type to check databse doc
   * @param {string} path Path in doc to check
   * @private
   */
  async check(key, type, path = null) {
    if (!this.files) throw new Err('Database has been closed');
    if (!key || !type) return;
    const value = await this.get(key, path);
    if (isNil(value)) {
      throw new Err(
        `The document "${key}" of path "${path}" was not found in the database`,
        'JoshTypeError',
      );
    }
    const valueType = value.constructor.name;
    if (!type.includes(valueType)) {
      throw new Err(
        `The property ${
          path ? `${path} ` : ''
        }in key "${key}" is not of type "${type.join(
          '" or "',
        )}"(key was of type "${valueType}")`,
        'JoshTypeError',
      );
    }
  }
}

module.exports = JoshProvider;
