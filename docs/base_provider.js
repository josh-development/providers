/*
  BASE PROVIDER CODE LIST

  This file documents and lists all of the methods that Providers must support to be used by JOSH.


*/

// This must be used to save data in the database, so it supports regex, functions, etc.
// (This is assuming your database isn't pure magic that already supports this, I guess.)
const serialize = require('serialize-javascript');

// Custom error codes with stack support.
const Err = require('./error.js');

class JoshProvider {
  /**
   *
   * @param {Object} [options] An object containing all the options required for your provider, as well as the ones provided by default with every provider.
   * @param {string} [options.name] Required. The name of the table in which to save the data.
   *
   */
  constructor(options) {
    if (!options.name) throw new Error('Must provide options.name');
    this.name = options.name;
    this.db = 'Some Database Connector';
  }

  /**
   * Internal method called on persistent Josh to load data from the underlying database.
   * @param {Map} Josh In order to set data to the Josh, one must be provided.
   * @returns {Promise} Returns the defer promise to await the ready state.
   */
  async init() {
    // Place any provider-specific database initialization code here.
    // Must set isInitialized to true.
    this.isInitialized = true;
  }

  /**
   * Retrieves a single value from the database.
   * @param {string} key The database key where the value is stored
   * @param {string} path Optional. Null if not provided by the user. The path within the key where the object is located.
   * The path must support the same syntax as lodash does, for example: 'a[0].b.c'
   * @returns {Promise<*>} The data stored for the key, or at the path.
   */
  async get(key, path) {
    // get data using this.parseData(data)
    return 'Some value';
  }

  /**
   * * Retrieves all values from the database.
   * @returns {Promise<Object<*>>} An object consisting of every key and value in the database.
   * At the top level, the key is what the user providers when using set(key, value) and the value in the object is whatever's in the database.
   * Every value should be parsed using `this.parseData()`
   */
  async getAll() {
    return {
      key: 'value',
      key2: 'value 2',
    };
  }

  /**
   * Retrieves one or many values from the database.
   * @param {Array<string>} keys A list of keys to retrieve from the database.
   * @returns {Promise<Object<*>>} An object consisting every key requested by the user, and its value in the datbase.
   * At the top level, the key is what the user providers when using set(key, value) and the value in the object is whatever's in the database.
   * Every value should be parsed using `this.parseData()`
   */
  async getMany(keys) {
    return {
      key: 'value',
      key2: 'value 2',
    };
  }

  /**
   * Retrieves one or more random values from the database.
   * @param {Number} count An integer representing the number of random values to obtain from the database.
   * @returns {Promise<Object<*>>} An object representing one or more random keys taken from the database, with their values.
   * At the top level, the key is what the user providers when using set(key, value) and the value in the object is whatever's in the database.
   * Every value should be parsed using `this.parseData()`
   */
  async random(count = 1) {
    return {
      key: 'value',
      key2: 'value 2',
    };
  }

  /**
   * Retrieves a random key from all the database keys for this Josh.
   * @param {Number} count An integer representing the number of random keys to obtain from the database.
   * @returns {Promise<Array<string>>} An array of random keys taken from the database, or a single key if count is 1.
   */
  async randomKey(count = 1) {
    return count > 1 ? ['key', 'key2'] : 'key';
  }

  /**
   * Verifies whether a key, or value at path, exists in the database.
   * @param {string} key The key of which the existence should be checked.
   * @param {string} path Optional. Null if not provided by the user. If provided, should return whether a value exists at that path, assuming the key exists.
   * @returns {Promise<boolean>} Whether the key (or value at path) exists.
   */
  async has(key, path) {
    return true;
  }

  /**
   * Retrieves all the indexes (keys) in the database.
   * @return {Promise<Array<string>>} Array of all indexes (keys) in the database.
   */
  async keys() {
    ['key', 'key2'];
  }

  /**
   * Retrieves all of the values in the database.
   * @returns {Promise<array<*>>}
   */
  async values() {
    return ['value1', 'value2'];
  }

  /**
   * Retrieves the number of rows in the database.
   * @return {Promise<integer>} The number of rows in the database.
   */
  async count() {
    return 0;
  }

  /**
   * Saves a key in the database, along with its value.
   * @param {string} key The name of the key. If the key already exists, the value should be overriden.
   * @param {string} path Optional. Null if not provided by the user. Defines where, in an object or array value, to place the provided data.
   * @param {*} val The data to write in the database for the key, or at the path for this key.
   * This value MUST be written using serialize-javascript
   * @returns {Promise<Provider>} This provider.
   */
  async set(key, path, val) {
    // set using serialize(val);
    return this;
  }

  /**
   * Writes many different keys and their values to the database.
   * @param {Object} data The data to write to the database. Should be an object where each property is a key and its value is the value to write.
   * Does not support writing with paths. Format is:
   * ```json
   * {
   *   key1: 'value1',
   *   key2: 'value2',
   * }
   * ```
   * @param {boolean} overwrite Whether to overwrite existing keys provided in the incoming data.
   * @returns {Promise<Provider>} This provider.
   */
  async setMany(data, overwrite) {
    return this;
  }

  /**
   * Deletes a key and its value, or the part of an object or array value, from the database.
   * @param {string} key The name of the key to remove, or *from* which value to remove data at the path.
   * @param {string} path Optional. Null if not provided by the user. The path that should be deleted, if one is provided.
   * Ideally, this could use `unset()` from lodash.
   * @returns {Promise<Provider>} This provider.
   */
  async delete(key, path) {
    return this;
  }

  /**
   * Removes all keys in a list from the database. Does not support paths.
   * // TODO: maybe make this support paths?
   * @param {Array<string>} keys An array of keys to remove the database.
   * @returns {Promise<Provider>} This provider.
   */
  async deleteMany(keys) {
    return this;
  }

  /**
   * Deletes every single entry in the database.
   * @returns {Promise<Provider>} This provider.
   */
  async clear() {
    return this;
  }

  /**
   * Pushes a new value into an array stored in the database.
   * @param {string} key The key where to push a new value. The key's value must be an array (unless a path is used, then it should be an object).
   * @param {string} path Optional. Null if not provided by the user. If provided, the value at that path should be an array.
   * @param {*} value The value to push into the array.
   * @param {boolean} allowDupes Whether to allow duplicates to be pushed into the array. If true, should not ... well... allow duplicates.
   * @returns {Promise<Provider>} This provider.
   */
  async push(key, path, value, allowDupes) {
    return this;
  }

  /**
   * Removes a value from an array stored in the database.
   * @param {string} key The key where to remove a value from. The key's value must be an array (unless a path is used).
   * @param {string} path Optional. Null if not provided by the user. If provider, the value at that path should be an array.
   * @param {* | Function} val The value to remove from the array, or a function provided by the user to remove from the array (using findIndex).
   * @returns {Promise<Provider>} This provider.
   */
  async remove(key, path, val) {
    return this;
  }

  /**
   * Verifies if a value is part of an array at the key (or the path within that key).
   * @param {string} key The key in which to verify the existence of the value. Should be an array, unless a path is used.
   * @param {string} path Optional. Null if not provided by the user. Value at this path is expected to be an array.
   * @param {*} val The value to check in the array.
   * @returns {Promise<boolean>} Whether the value is in the array.
   */
  async includes(key, path, val) {
    return true;
  }

  /**
   * Increments a numerical value within the database.
   * @param {string} key The key to increment. The value must be a Number.
   * @param {string} path Optional. Null if not provided by the user. If provided, the value at that path must be a Number value.
   * @returns {Promise<Provider>} This provider.
   */
  async inc(key, path) {
    return this.set(key, path, this.get(key, path) + 1);
  }

  /**
   * Decrements a numerical value within the database.
   * @param {string} key The key to decrement. The value must be a Number.
   * @param {string} path Optional. Null if not provided by the user. If provided, the value at that path must be a Number value.
   * @returns {Promise<Provider>} This provider.
   */
  async dec(key, path) {
    return this.set(key, path, this.get(key, path) - 1);
  }

  /**
   * Executes a mathematical operation on a numerical value within the database.
   * @param {string} key The key where the operation should be executed. The value must be a Number value.
   * @param {string} path Optional. Null if not provided by the user. If provided, the value at the path must be a Number value.
   * @param {string} operation One of the supported operations (listed in this function).
   * @param {Number} operand The secondary Number for the mathematical operation.
   * @returns {Promise<Provider>} This provider.
   */
  async math(key, path, operation, operand) {
    const base = this.get(key, path);
    let result = null;
    if (base == undefined || operation == undefined || operand == undefined) {
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
    }
    return this.set(key, path, result);
  }

  /**
   * Finds and returns an entire value, by checking whether a specific sub-value was found a the given path.
   * @param {string} path The path where to check if the value is present
   * @param {*} value The value to check for equality.
   * @returns {Promise<*>} The first value found, or `null` if no value found.
   */
  async findByValue(path, value) {
    return null; // or value
  }

  /**
   * Finds and returns a value using a function.
   * @param {Function} fn A function to execute on every value in the database.
   * This function should provide both the `value` and `key` as arguments and will return a boolean.
   * findByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution)
   * @param {string} path Optional. If provided, the function should be provided the value at the path rather than at the root.
   * @returns {Promise<*>} The first value found by the function, or `null` if no value found.
   */
  async findByFunction(fn, path) {
    return null; // or value
  }

  /**
   * Finds and returns one or move value, by checking whether a specific sub-value was found at the given path.
   * @param {string} path The path where to check if the value is present
   * @param {*} value The value to check for equality.
   * @returns {Promise<Object>} The values found by this function, or `{}` if no value found.
   */
  async filterByValue(path, value) {
    return {
      key: 'value',
      key2: 'value 2',
    };
  }

  /**
   * Finds and returns one or more values using a function to check whether the value is desired.
   * @param {Function} fn A function to execute on every value in the database.
   * This function should be provided both the `value` and `key` as arguments and will return a boolean.
   * filterByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution)
   * @param {string} path The path where to check if the value is present
   * @returns {Promise<Object>} The values found by the function, or `{}` if no value found.
   */
  async filterByFunction(fn, path) {
    return {
      key: 'value',
      key2: 'value 2',
    };
  }

  /**
   * Retrieves the value at the specified path for every stored object or array in the database.
   * @param {string} path The path to get the data from.
   * @returns {Promise<Array<string>>} An array of the values at that path
   */
  async mapByValue(path) {
    return ['value1', 'value2'];
  }

  /**
   * Runs a function for every value in the database and returns an array with the return of that function for each value.
   * @param {Function} fn The function should be provided the `key` and `value` as arguments (in that order) and will return a value.
   * mapByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution)
   * @returns {Promise<Array<*>>} An array of the values returned by the function for each value.
   */
  async mapByFunction(fn) {
    return ['value1', 'value2'];
  }

  /**
   * Verifies if the provided value is located in *any* of the values stored in the database.
   * @param {string} path Optional. Null if not provided by the user. If provided, the value would need to be equal to the data stored at that path.
   * @param {*} value The value to check for at that path.
   * @returns {Promise<boolean>} Should return true as soon as the value is found, or false if it hasn't been.
   */
  async someByValue(path, value) {
    return true;
  }

  /**
   * Verifies if something is true in any of the values stored in the database, through a function.
   * @param {Function} fn The function should be provided both the `value` and `key` for each entry in the database, and will return a boolean.
   * someByFunction is expected to return `true` immediately on the first occurence of the `fn` returning true.
   * someByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution)
   * @returns {Promise<boolean>} Whether the `fn` has returned true for any value.
   */
  async someByFunction(fn) {
    return true;
  }

  /**
   * Verifies if a value at a path is identical to the one provided, for every single value stored in the database.
   * @param {string} path The path where the value should be checked.
   * @param {*} value The value that should be checked for equality at that path.
   * @returns {Promise<boolean>} Whether the value was equal to the one at the path for every single value in the database.
   */
  async everyByValue(path, value) {
    return true;
  }

  /**
   * Verifies if a condition is true on every single value stored in the database, using a function.
   * @param {Function} fn The function should be provided botht he `value` and `key` for each entry in the database, and will return a boolean.
   * everyByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution)
   * @returns {Promise<boolean>} Whether the `fn` has returned true for every value.
   */
  async everyByFunction(fn) {
    return true;
  }

  /**
   * Returns the "next" automatic ID for this josh. AutoId should be a string, and can technically be anything you want - either a numerically incremented value or just
   * an automatic row ID or DB ID (autonum, mongo's _id , etc). No 2 Ids should ever be identical.
   * @returns {Promise<string>} An automatic ID.
   */
  async autoId() {
    return '1';
  }

  /**
   * Closes the database. This function should be used to shut down any connection or file access to the database this provider refers to.
   */
  async close() {
    return;
  }

  /**
   * Deletes the database. This function should delete everything in the specific table used by this database (for the josh's **name** specifically)
   * It should also remove any temporary table, as well as the "autoid" saved for it.
   * After this method is run, no trace of the specific josh should exist.
   */
  async destroy() {
    return null;
  }

  /**
   * Internal method to read data from the database.
   * This is essentially the contrary of `serialize-javascript`'s "serialize()" method.
   * Note: EVAL IS NORMAL. As long as 100% of the data you read from this has been written by serialize(), this is SAFE. If you have any doubts as to what data has been written,
   * or if you have to deal with mixed or unsafe data, then you should take further action to ensure you are not subject to security breaches!
   * @param {string} data A string ("JSON") generated by `serialize-javascript`.
   * @returns {*} A value parsed through eval, which will be valid javascript.
   */
  parseData(data) {
    try {
      return eval(`(${data})`);
    } catch (err) {
      console.log('Error parsing data : ', err);
      return null;
    }
  }
};

module.exports = JoshProvider;