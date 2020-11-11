const {
  MongoClient,
} = require('mongodb');

const _ = require('lodash');

const Err = require("./error");
class JoshProvider {

  constructor(options) {
    if (!options.name) throw new Err('Must provide options.name', "JoshTypeError");
    this.name = options.name;
    this.validateName();
    this.auth =
      options.user && options.password ?
        `${options.user}:${options.password}@` :
        '';
    this.dbName = options.dbName || 'test';
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
    // console.log('Initializing MongoDB', this.url);
    this.client = await MongoClient.connect(this.url, { useNewUrlParser: true, useUnifiedTopology: true });
    // console.log(this.client);
    this.db = this.client.db(this.dbName).collection(this.name);
    // console.log(this.db);
    return true;
  }

  /**
   * Get settings
   * @returns {object} Returns an object containing all settings
   */
  get settings() {
    return {
      name: this.dbName,
    };
  }

  /**
   * Check is database is initialized and connected
   * @returns {Boolean} Returns true if connected successfully
   */
  get isInitialized() {
    return this.client.isConnected()
  }

  /**
   * Shuts down the underlying database.
   * @returns {Promise} Promise resolves when finished closing
   */
  close() {
    return this.client.close();
  }

  /**
   * Set a value to the josh.
   * @param {(string|number)} key Required. The key of the element to add to the josh object.
   * @param {*} val Required. The value of the element to add to the josh object.
   * This value MUST be stringifiable as JSON.
   * @example
   * ```
   * await JoshProvider.set("josh", { hello: "world" })
   * ```
   */
  async set(key, val) {
    this.check([ 
      [key, ["String", "Number"]]
    ])
    if (!key) {
      throw new Error('Keys should be strings or numbers.');
    }
    await this.db.findOneAndUpdate({
      _id: key,
    }, {
      $set: { value: val },
    }, {
      upsert: true,
    });
    return this;
  }

  /**
   * Set many keys and values
   * @param {Array} arr
   * @example
   * ```
   * await JoshProvider.setMany([ ["hello", "world"], ["josh": true] ])
   * ``` 
   */
  async setMany(arr) {
    this.check([ 
      [arr, ["Array"]]
    ])
    for (let [key, val] of arr) {
      await this.set(key, val);
    }
    return this;
  }

  /**
   * Fetch the value of a key in the database
   * @param {(string|number)} key 
   * @returns {Promise} Resolves to the value
   * @example
   * ```
   * await JoshProvider.get("josh")
   * ```
   */
  get(key) {
    this.check([ 
      [key, ["String", "Number"]]
    ])
    return new Promise((res, rej) => {
      this.db.findOne({
        _id: key,
      }).then(doc => res(doc.value)).catch(rej);
    })
  }

  /**
   * Fetch multiple keys from the database
   * @param {string[]} arr 
   * @returns {object} Returns object with each key mapped to its value
   * @example
   * ```
   * await JoshProvider.getMany([ "josh", 123 ])
   * ```
   */
  async getMany(arr) {
    this.check([ 
      [arr, ["Array"]]
    ])
    const doc = {};
    for(let key of arr) {
      doc[key] = await this.get(key);
    }
    return doc;
  }

  /**
   * Count the documents in the database
   * @param {object} query This filters the documents counted 
   * @returns {Promise}
   * @example
   * ```
   * await JoshProvider.count()
   * ```
   */
  count(query = {}) {
    this.check();
    return this.db.countDocuments(query);
  }

  /**
   * Increment the value of a document by 1
   * @param {(string|number)} key 
   * @example
   * ```
   * await JoshProvider.inc("joshes")
   * ```
   */
  async inc(key) {
    this.check();
    return this.set(key, await this.get(key) + 1);
  }

  /**
   * Decrement the value of a document by 1
   * @param {(string|number)} key
   * @example
   * ```
   * await JoshProvider.dec("joshes")
   * ``` 
   */
  async dec(key) {
    this.check();
    return this.set(key, await this.get(key) - 1);
  }

  /**
   * Perform mathmatical operations on the value of a document
   * @param {(string|number)} key 
   * @param {string} operation Valid operations are add, subtract, multiply, divide, exponent, modulo and random
   * @param {number} operand
   * @example
   * ```
   * await JoshProvider.math('number', 'multiply', 2)
   * await JoshProvider.math('number', '/', 2) // divide
   * await JoshProvider.math('number', 'exp', 2) // exponent
   * ```
   */
  async math(key, operation, operand) {
    this.check([ 
      [key, ["String", "Number"]],
      [operation, ["String"]],
      [operand, ["Number"]]
    ])
    const base = await this.get(key);
    let result = null;
    if (!base || !operation || !operand) throw new Err('Math operation requires base, operation and operand', 'JoshTypeError');
    switch (operation) {
    case 'add' :
    case 'addition' :
    case '+' :
      result = base + operand;
      break;
    case 'sub' :
    case 'subtract' :
    case '-' :
      result = base - operand;
      break;
    case 'mult' :
    case 'multiply' :
    case '*' :
      result = base * operand;
      break;
    case 'div' :
    case 'divide' :
    case '/' :
      result = base / operand;
      break;
    case 'exp' :
    case 'exponent' :
    case '^' :
      result = Math.pow(base, operand);
      break;
    case 'mod' :
    case 'modulo' :
    case '%' :
      result = base % operand;
      break;
    case 'rand' :
    case 'random' :
      result = Math.floor(Math.random() * Math.floor(operand));
      break;
    default:
      throw new Err("Please provide a valid operand", "JoshTypeError") 
      break;
    }
    if(result) {
      await this.set(key, result);
    }
    return this;
  }

  /**
   * Fetch all keys within a query
   * @param {object} query 
   * @returns {Array}
   * @example
   * ```
   * await JoshProvider.keys()
   * ```
   */
  keys(query = {}) {
    this.check([
      [query, ["Object"]]
    ])
    return new Promise((resolve, reject) => {
      this.db.find(query).toArray((err, docs) => {
        if (err) reject(err);
        resolve(docs.map(x => x._id));
      });
    });
  }

  /**
   * Fetch all values in the database
   * @param {object} query 
   * @returns {Array}
   * @example
   * ```
   * await JoshProvider.values()
   * ```
   */
  values(query = {}) {
    this.check([
      [query, ["Object"]]
    ])
    return new Promise((resolve, reject) => {
      this.db.find(query).toArray((err, docs) => {
        if (err) reject(err);
        resolve(docs.map(x => x.value));
      });
    });
  }

  /**
   * Delete a document from the database
   * @param {string} key 
   * @example
   * ```
   * await JoshProvider.delete("josh");
   * ```
   */
  async delete(key) {
    this.check([
      [key, ["String", "Number"]]
    ])
    await this.db.deleteOne({
      _id: key,
    });
    return this;
  }

  /**
   * Delete multiple documents from the database
   * @param {Array} arr 
   * @example
   * ```
   * await JoshProvider.deleteMany(["josh", "mongo", "number", 12])
   * ```
   */
  async deleteMany(arr) {
    this.check([
      [arr, ["Array"]]
    ])
    const query = {
      $in: arr
    };
    await this.db.deleteMany({ _id: query });
    return this;
  }

  /**
   * Deletes all entries in the database.
   * @return {Promise<*>} Promise returned by the database after deletion
   * @example
   * ```
   * await JoshProvider.bulkDelete()
   * ```
   */
  bulkDelete() {
    this.check();
    return this.db.drop();
  }

  /**
   * Internal method used to validate persistent josh names (valid Windows filenames)
   * @private
   */
  validateName() {
    // Do not delete this internal method.
    this.name = this.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  /**
   * Internal method used to check validity of the database and input
   * @private
   */
  check(input = []) {
    if(!this.isInitialized) {
      throw new Err("Connection to database not open")
    }
    for (let [key, expected] of input) {
     if(!expected.includes(key.constructor.name)) {
       throw new Err("Input of " + key.constructor.name + " was invalid, the supported data types are: " + expected.join(", "))
     }
    }
  }

}

module.exports = JoshProvider;
