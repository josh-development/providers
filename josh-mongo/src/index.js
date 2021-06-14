const { MongoClient, ObjectId } = require('mongodb');

const { get: _get, unset, isFunction, isNil } = require('lodash');

const Err = require('./error');

class JoshProvider {
  constructor(options) {
    if (!options.name) {
      throw new Err('Must provide options.name', 'JoshTypeError');
    }
    this.name = options.name;
    if (!options.collection) {
      throw new Err('Must provide options.collection', 'JoshTypeError');
    }
    this.collection = options.collection;
    this.validateName();
    this.auth =
      options.user && options.password
        ? `${options.user}:${options.password}@`
        : '';
    this.dbName = options.dbName || 'josh';
    this.port = options.port || 27017;
    this.host = options.host || 'localhost';
    this.url =
      options.url ||
      `mongodb://${this.auth}${this.host}:${this.port}/${this.dbName}`;
  }

  /**
   * Internal method called on persistent joshs to load data from the underlying database.
   * @param {Map} josh In order to set data to the josh, one must be provided.
   * @returns {Promise} Returns the defer promise to await the ready state.
   */
  async init() {
    this.client = await MongoClient.connect(this.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).catch((err) => console.error(err));
    this.db = this.client.db(this.dbName).collection(this.collection);
    return this.client.isConnected();
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
  async get(key, path) {
    await this.check();
    const data = await this.db.findOne({
      key: { $eq: key },
    });
    if (!path) return data ? data.value : null;
    return _get(data, `value.${path}`);
  }

  async getAll() {
    await this.check();
    const docs = await this.db.find({}).toArray();
    return this.cursorToObject(docs);
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
    const cursor = await this.db.find({ key: { $in: arr } }).toArray();
    return this.cursorToObject(cursor);
  }

  async random(count = 1) {
    await this.check();
    const docs = await this.db
      .aggregate([{ $sample: { size: count } }])
      .toArray();
    return this.cursorToObject(docs);
  }

  async randomKey(count = 1) {
    await this.check();
    const docs = await this.db
      .aggregate([{ $sample: { size: count } }])
      .toArray();
    return docs.map((doc) => doc.key);
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
    return (await this.get(key, path)) != null;
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
  async keys(query = {}) {
    await this.check();
    const docs = await this.db.find(query).toArray();
    return docs.map((doc) => doc.key);
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
  async values(query = {}) {
    await this.check();
    const docs = await this.db.find(query).toArray();
    return docs.map((doc) => doc.value);
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
  async count(query = {}) {
    return this.db.countDocuments(query);
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
    await this.db.findOneAndUpdate(
      {
        key: { $eq: key },
      },
      {
        $set: { key, [`${path ? `value.${path}` : 'value'}`]: val },
      },
      {
        upsert: true,
      },
    );
    return this;
  }

  /**
   * Set many keys and values
   * @param {Object} obj  This is a [key, value, path] array to be set in the database
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
    if (!path || path.length === 0) {
      await this.db.deleteOne({
        key: key,
      });
    } else {
      const value = await this.get(key);
      // TODO : Make this work for arrays (null value)
      unset(value, path);
      await this.set(key, null, value);
    }
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
    const query = {
      $in: arr,
    };
    await this.db.deleteMany({ key: query });
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
    await this.db.deleteMany({});
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
    const docs = await this.db.find({}).toArray();
    for (const doc of docs) {
      if (
        !value
          ? _get(doc.value, path)
          : path
          ? value == _get(doc.value, path)
          : value == doc.value
      ) {
        return {
          [doc.key]: doc.value,
        };
      }
    }
  }

  async findByFunction(fn) {
    await this.check();
    const docs = await this.db.find({}).toArray();
    for (const doc of docs) {
      if (fn(doc.value)) {
        return { [doc.key]: doc.value };
      }
    }
  }

  async filterByValue(path, value) {
    await this.check();
    const docs = await this.getAsArray();
    const finalDoc = {};
    for (const { key, value: val } of docs) {
      if (
        !value
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
    const docs = await this.getAsArray();
    const finalDoc = [];
    for (const { key, value } of docs) {
      if (fn(value)) {
        finalDoc.push([key, value]);
      }
    }
    return finalDoc;
  }

  async mapByValue(/* path */) {
    await this.check();
    throw new Error('Not yet implemented');
  }

  async mapByFunction(fn) {
    await this.check();
    let all = await this.getAsArray();
    all = all.map(({ key, value }) => fn(value, key));
    return all;
  }

  async someByValue(path, value) {
    await this.check();
    const docs = await this.getAsArray();
    return docs.some((doc) =>
      path ? _get(doc.value, path) == value : doc.value == value,
    );
  }

  async someByFunction(fn) {
    await this.check();
    const docs = await this.getAsArray();
    return docs.some(({ key, value }) => fn(value, key));
  }

  async everyByValue(path, value) {
    await this.check();
    const docs = await this.getAsArray();
    return docs.every((doc) =>
      path ? _get(doc.value, path) == value : doc.value == value,
    );
  }

  async everyByFunction(fn) {
    await this.check();
    const all = await this.getAsArray();
    return all.every(({ key, value }) => fn(value, key));
  }

  autoId() {
    return new ObjectId().toString();
  }

  /**
   * Shuts down the underlying database.
   * @returns {Promise} Promise resolves when finished closing
   */
  close() {
    return this.client.close();
  }

  /**
   * Clears and shuts down the underlying database.
   * @returns {Promise} Promise resolves when finished closing
   */
  destroy() {
    this.clear();
    return this.close();
  }

  /**
   * Internal method used to validate persistent josh names (valid Windows filenames)
   * @private
   */
  validateName() {
    // Do not delete this internal method.
    this.collection = this.collection.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  /**
   * Internal method used to check validity of the database and value of doc to change
   * @param {Array} key key to fetch from database
   * @param {any} type Type to check databse doc
   * @param {string} path Path in doc to check
   * @private
   */
  async check(key, type, path = null) {
    if (!this.client.isConnected()) {
      throw new Err('Connection to database not open');
    }
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

  cursorToObject(data) {
    return data.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
  }

  async getAsArray() {
    await this.check();
    return this.db.find({}).toArray();
  }
}

module.exports = JoshProvider;
