const {
  MongoClient,
} = require('mongodb');

const _ = require('lodash');

const Err = require("./error");
class JoshProvider {

  constructor(options) {
    if (!options.name) throw new Error('Must provide options.name');
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
    console.log('Initializing MongoDB', this.url);
    this.client = await MongoClient.connect(this.url, { useNewUrlParser: true, useUnifiedTopology: true });
    // console.log(this.client);
    this.db = this.client.db(this.dbName).collection(this.name);
    // console.log(this.db);
    return true;
  }

  get settings() {
    return {
      name: this.dbName,
    };
  }

  get isInitialized() {
    return this.client.isConnected()
  }

  /**
   * Shuts down the underlying database.
   */
  close() {
    this.client.close();
  }

  /**
   * Set a value to the josh.
   * @param {(string|number)} key Required. The key of the element to add to the josh object.
   * @param {*} val Required. The value of the element to add to the josh object.
   * This value MUST be stringifiable as JSON.
   */
  async set(key, val) {
    if (!key || !['String', 'Number'].includes(key.constructor.name)) {
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

  async setMany(arr) {
    for (let [key, val] of arr) {
      await this.set(key, val);
    }
    return this;
  }

  get(key) {
    return new Promise((res, rej) => {
      this.db.findOne({
        _id: key,
      }).then(doc => res(doc.value)).catch(rej);
    })
  }

  async getMany(arr) {
    const doc = {};
    for(let i = 0; i < arr.length; i++) {
      doc[arr[i]] = await this.get(arr[i]);
    }
    return doc;
  }

  count(query = {}) {
    return this.db.countDocuments(query);
  }

  async inc(key) {
    return this.set(key, await this.get(key) + 1);
  }

  async dec(key) {
    return this.set(key, await this.get(key) - 1);
  }

  async math(key, operation, operand) {
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

  keys(query = {}) {
    return new Promise((resolve, reject) => {
      this.db.find(query).toArray((err, docs) => {
        if (err) reject(err);
        resolve(docs.map(x => x._id));
      });
    });
  }

  values(query = {}) {
    return new Promise((resolve, reject) => {
      this.db.find(query).toArray((err, docs) => {
        if (err) reject(err);
        resolve(docs.map(x => x.value));
      });
    });
  }

  async delete(key) {
    await this.db.deleteOne({
      _id: key,
    });
    return this;
  }

  async deleteMany(arr) {
    const query = {
      $in: arr
    };
    await this.db.deleteMany({ _id: query });
    return this;
  }

  hasAsync(key) {
    return this.db.find({
      _id: key,
    }).limit(1);
  }

  /**
   * Deletes all entries in the database.
   * @return {Promise<*>} Promise returned by the database after deletion
   */
  bulkDelete() {
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
  /*
   * INTERNAL method to verify the type of a key or property
   * Will THROW AN ERROR on wrong type, to simplify code.
   * @param {string|number} key Required. The key of the element to check
   * @param {string} type Required. The javascript constructor to check
   * @param {string} path Optional. The dotProp path to the property in JOSH.
   */
  // Herefore I indicate that I do understand part of this would be easily resolved with TypeScript but I don't do TS... yet.
  // TODO: OPTIMIZE FOR LESS QUERIES. A LOT less queries. wow this is bad.
  //   check(key, type, path = null) {
  //     if (!this.has(key)) throw new Err(`The key "${key}" does not exist in JOSH "${this.name}"`, 'JoshPathError');
  //     if (!type) return;
  //     if (!isArray(type)) type = [type];
  //     if (!isNil(path)) {
  //       this.check(key, 'Object');
  //       const data = this.get(key);
  //       if (isNil(_get(data, path))) {
  //         throw new Err(`The property "${path}" in key "${key}" does not exist. Please set() it or ensure() it."`, 'JoshPathError');
  //       }
  //       if (!type.includes(_get(data, path).constructor.name)) {
  //         throw new Err(`The property "${path}" in key "${key}" is not of type "${type.join('" or "')}" in JOSH "${this.name}"
  // (key was of type "${_get(data, path).constructor.name}")`, 'JoshTypeError');
  //       }
  //     } else if (!type.includes(this.get(key)).constructor.name) {
  //       throw new Err(`The key "${key}" is not of type "${type.join('" or "')}" in JOSH "${this.name}" (key was of type "${this.get(key).constructor.name}")`, 'JoshTypeError');
  //     }
  //   }
  keyCheck(key) {
    return !_.isNil(key) && key[0] !== '$';
  }

}

module.exports = JoshProvider;
