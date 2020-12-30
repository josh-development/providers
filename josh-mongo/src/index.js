const { MongoClient, ObjectId } = require('mongodb');

const { get: _get, unset, isFunction } = require('lodash');

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
      options.user && options.password ?
        `${options.user}:${options.password}@` :
        '';
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
    this.check();
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
   * @param {Array} arr This is a [key, value, path] array to be set in the database
   * @param {boolean} overwrite Whether or not to overwrite existing values or ignore
   * @example
   * ```
   * await JoshProvider.setMany([ ["hello", "world"], ["josh": true], ["foo", true, "alive"] ])
   * ```
   */
  async setMany(arr, overwrite) {
    for (const [key, val, path = null] of arr) {
      const found = this.get(key, path);
      if (!found || (found && overwrite)) {
        await this.set(key, path, val);
      }
    }
    return this;
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
    const data = await this.db.findOne({
      key: { $eq: key },
    });
    if (!path) return data && data.value;
    return _get(data, path);
  }

  async getAll() {
    const docs = await this.db.find({}).toArray();
    return docs.map((doc) => [doc.key, doc.value]);
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
    const docs = await this.db.find({ key: { $in: arr } }).toArray();
    return docs.map((doc) => [doc.key, doc.value]);
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
    return this.set(key, path, await this.get(key, path) + 1);
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
  count(query = {}) {
    return this.db.countDocuments(query);
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
    return this.set(key, path, await this.get(key, path) - 1);
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
    const base = await this.get(key, path);
    let result = null;
    if (!base || !operation || !operand) {
      throw new Err(
        'Math operation requires base, operation and operand',
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

  async random(count = 1) {
    const docs = await this.db
      .aggregate([{ $sample: { size: count } }])
      .toArray();
    return docs.map((doc) => [doc.key, doc.value]);
  }

  async randomKey(count = 1) {
    const docs = await this.random(count);
    return docs.map((doc) => doc[0]);
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
  keys(query = {}) {
    return new Promise((resolve, reject) => {
      this.db.find(query).toArray((err, docs) => {
        if (err) reject(err);
        resolve(docs.map((doc) => doc.key));
      });
    });
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
  values(query = {}) {
    return new Promise((resolve, reject) => {
      this.db.find(query).toArray((err, docs) => {
        if (err) reject(err);
        resolve(docs.map((doc) => doc.value));
      });
    });
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
  async delete(key, path) {
    if (!path || path.length === 0) {
      await this.db.deleteOne({
        key: key,
      });
    } else {
      const value = await this.get(key);
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
    const query = {
      $in: arr,
    };
    await this.db.deleteMany({ key: query });
    return this;
  }
  async findByValue(path, value) {
    const docs = await this.db.find({}).toArray();
    const finalDoc = {};
    for (const doc of docs) {
      if (_get(doc.value, path) == value) {
        finalDoc[doc.key] = doc.value;
        return finalDoc;
      }
    }
  }
  async findByFunction(fn) {
    const docs = await this.db.find({}).toArray();
    for (const doc of docs) {
      if (fn(doc.value)) {
        return [doc.key, doc.value];
      }
    }
  }
  async filterByValue(value, path = null) {
    const docs = await this.getAll();
    const finalDoc = [];
    for (const [key, val] of docs) {
      if ((path && _get(val, path) == value) || val == value) {
        finalDoc.push([key, val]);
      }
    }
    return finalDoc;
  }
  async filterByFunction(fn) {
    const docs = await this.getAll();
    const finalDoc = [];
    for (const [key, value] of docs) {
      if (fn(value)) {
        finalDoc.push([key, value]);
      }
    }
    return finalDoc;
  }
  async push(key, path, value, allowDupes) {
    const data = await this.get(key, path);
    if (!allowDupes && data.indexOf(value) > -1) return this;
    data.push(value);
    this.set(key, path, data);
    return this;
  }
  async remove(key, path, val) {
    const data = await this.get(key, path);
    const criteria = isFunction(val) ? val : (value) => val === value;
    const index = data.findIndex(criteria);
    if (index > -1) {
      data.splice(index, 1);
      await this.set(key, path, data);
    }
    return this;
  }
  async mapByFunction(fn) {
    let all = await this.getAll();
    all = all.map(([key, value]) => fn(key, value));
    return all;
  }
  async includes(key, path = null, val) {
    const data = await this.get(key, path);
    if (!data) return;
    const criteria = isFunction(val) ? val : (value) => val === value;
    const index = data.findIndex(criteria);
    return index > -1;
  }

  async someByValue(value, path) {
    const docs = await this.getAll();
    return docs.some((doc) =>
      path ? _get(doc[1], path) == value : doc[1] == value,
    );
  }

  async someByFunction(fn) {
    const docs = await this.getAll();
    return docs.some(fn);
  }

  async everyByValue(value, path) {
    let docs = await this.getAll();
    docs = docs.filter((doc) =>
      path ? _get(doc[1], path) == value : doc[1] == value,
    );
    return docs.length === await this.count();
  }

  async everyByFunction(fn) {
    const all = await this.getAll();
    let answerCount = 0;
    for (const [key, value] of all) {
      if (await fn(value, key)) {
        answerCount++;
      } else {
        break;
      }
    }
    return answerCount === all.length;
  }
  autoId() {
    return new ObjectId().toString();
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
    await this.db.deleteMany({});
    return this;
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
    return await this.get(key, path) != null;
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
   * @param {Array} input Input to type check
   * @private
   */
  // TODO: fix this to not check params but key,value,path
  check(input = []) {
    if (!this.client.isConnected()) {
      throw new Err('Connection to database not open');
    }
    for (const [key, expected] of input) {
      if (!expected.includes(key.constructor.name)) {
        throw new Err(
          `Input of ${
            key.constructor.name
          } was invalid, the supported data types are: ${expected.join(', ')}`,
        );
      }
    }
  }
}

module.exports = JoshProvider;
