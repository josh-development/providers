const mysql = require("mysql");

// Lodash should probably be a core lib but hey, it's useful!
const {
  get: _get,
  set: _set,
  isNil,
  isArray,
  isFunction,
  flatten,
  cloneDeep,
  unset,
} = require('lodash');


// Custom error codes with stack support.
const Err = require('./error.js');
// , buildQuery
const {
  getPaths,
  serializeData,
  // serialize,
  // isObject,
  // onChange,
} = require('./utils.js');
// const db = require("../../test.js");

module.exports = class JoshProvider {
  constructor(options) {
    if (options.inMemory) {
      throw new Error("Josh-MySQL doesn't support in-memory databases")
    } else {
      if (!options.name) throw new Error('Must provide options.name');

      this.name = options.name;
      this.validateName();

      try {
        this.db = mysql.createPool(options.connection);
      } catch (e) {
        throw new Err(e.message, 'JOSHMySQLInitializationError')
      }
    }
  }

  /**
   * Internal method that translates a callback-based query into a promise-based query
   * @private
   * @param {mysql.QueryOptions | string} options The query
   * @param {*} values Auto-completion values
   * @param {boolean} [many=false] Whether to return multiple resulsts 
   * @returns {Promise<*>} Results
   */
  query(options, values = [], many = false) {
    return new Promise((resolve, reject) => {
      this.db.query(options, values, (err, results, fields) => {
        if (err) return reject(err);
        resolve(many ? results : results[0]);
      })
    })
  }

  /**
   * Executes transactions
   * @param {[sql: string, values: string[]][]} transactions The transactions
   * @returns {Promise<void | Error>} Returns `void` when everything is ok
   */
  runMany(transactions) {
    return new Promise((resolve, reject) => {

      this.db.getConnection((err, connection) => {
        if (err) return connection.rollback(() => {
          connection.release();
          reject(err);
        });

        connection.beginTransaction(async err => {
          if (err) return connection.rollback(() => {
            connection.release();
            reject(err);
          });

          try {

            for (let [sql, values] of transactions) {
              await this.query(sql, values);
            }
            connection.commit(resolve);
            connection.release();

          } catch (e) {
            connection.rollback(() => reject(e));
            connection.release();
          }
        });

      });

    });

  }

  /**
   * Internal method called on persistent Josh to load data from the underlying database.
   * @param {Map} Josh In order to set data to the Josh, one must be provided.
   * @returns {Promise} Returns the defer promise to await the ready state.
   */
  async init() {
    // Test request
    await this.query("SELECT 1;");

    const database = await this.query("SELECT DATABASE();")
      .catch(console.error);

    if (!database || !database["DATABASE()"]) throw new Error("Connection must have a database");

    await this.query(`CREATE TABLE IF NOT EXISTS ${this.name} (objkey VARCHAR(255), path VARCHAR(255), val LONGTEXT, PRIMARY KEY(objkey, path)) ENGINE=INNODB;`)
      .catch(console.error);

    await this.query(`CREATE TABLE IF NOT EXISTS internal_autonum (josh VARCHAR(255) PRIMARY KEY, lastnum INTEGER) ENGINE=INNODB;`)
      .catch(console.error);

    const results = await this.query("SELECT lastnum FROM internal_autonum WHERE josh = ?;", [this.name])
      .catch(console.error)

    if (!results) {
      await this.query("INSERT INTO internal_autonum (josh, lastnum) VALUES (?, ?);", [this.name, 0])
        .catch(console.error);
    }

    this.deleteStmt = `DELETE FROM ${this.name} WHERE objkey=? AND path=?;`;
    this.insertStmt = `INSERT INTO ${this.name} (objkey, path, val) VALUES (?, ?, ?);`;

    this.isInitialized = true;
  }

  get(key, path) {
    return this.query(`SELECT val FROM ${this.name} WHERE objkey = ? AND path = ${path ? '?' : "'::NULL::'"};`, path ? [key, path] : [key])
      .then(row => {
        return row ? this.parseData(row.val) : undefined;
      });
  }

  getAll() {
    return this.query(`SELECT objkey, val FROM ${this.name} WHERE path = '::NULL::';`, undefined, true)
      .then(rows => {
        return rows.reduce((acc, row) => {
          acc[row.objkey] = this.parseData(row.val);
          return acc;
        }, {});
      });
  }

  getMany(keys) {
    return this.query(`SELECT objkey, val FROM ${this.name} WHERE path = '::NULL::' AND objkey IN (${Array(keys.length).fill("?").join(", ")});`, keys, true)
      .then(rows => {
        return rows.reduce((acc, row) => {
          acc[row.objkey] = this.parseData(row.val);
          return acc;
        }, {});
      });
  }

  random(count = 1) {
    return this.query(`SELECT objkey, val FROM ${this.name} WHERE path='::NULL::' ORDER BY RAND() LIMIT ${Number(count)};`, undefined, true)
      .then(rows => {
        return rows.reduce((acc, row) => {
          acc[row.objkey] = this.parseData(row.val);
          return acc;
        }, {});
      });
  }

  randomKey(count = 1) {
    return this.query(`SELECT objkey FROM ${this.name} WHERE path='::NULL::' ORDER BY RAND() LIMIT ${Number(count)};`, undefined, true)
      .then(rows => rows.map(row => row.objkey));
  }

  has(key, path) {
    return this.query(`SELECT count(*) FROM ${this.name} WHERE objkey = ? AND path = ${path ? '?' : "'::NULL::'"};`, path ? [key, path] : [key])
      .then(row => row['count(*)'] === 1);
  }

  keys() {
    return this.query(`SELECT objkey FROM ${this.name} WHERE path = '::NULL::';`, undefined, true)
      .then(row => row.map(row => row.objkey));
  }

  values() {
    return this.query(`SELECT val FROM ${this.name} WHERE path = '::NULL::';`, undefined, true)
      .then(row => row.map(row => this.parseData(row.val)));
  }

  /**
   * Retrieves the number of rows in the database for this Josh, even if they aren't fetched.
   * @return {integer} The number of rows in the database.
   */
  count() {
    return this.query(`SELECT count(*) FROM ${this.name} WHERE path = '::NULL::';`)
      .then(row => row['count(*)']);
  }

  async set(key, path, val) {
    key = this.keyCheck(key);
    const executions = await this.compareData(key, val, path);
    await this.runMany(executions);
    return this;
  }

  async setMany(data, overwrite) {
    if (isNil(data) || data.constructor.name !== 'Object') {
      throw new Error('Provided data was not an object of {key, value} pairs.');
    }
    const existingKeys = await this.keys();

    const entries = [];

    for (let [key, value] of Object.entries(data)) {
      if (!overwrite && existingKeys.includes(key)) continue;
      entries.push(await this.compareData(key, value));
    }

    await this.runMany(flatten(entries));
    return this;
  }

  async delete(key, path) {
    const value = await this.get(key);
    if (!path || path.length === 0) {
      await this.query(`DELETE FROM ${this.name} WHERE objkey = ?;`, [key])
    } else {
      unset(value, path);
      await this.set(key, null, value);
    }

    return this;
  }

  deleteMany(keys) {
    return this.query(`DELETE FROM ${this.name} WHERE path = '::NULL::' AND objkey IN (${Array(keys.length).fill("?").join(", ")});`, keys)
      .then(() => this);
  }

  clear() {
    return this.query(`DELETE FROM ${this.name}`)
      .then(() => this)
  }

  async push(key, path, value, allowDupes) {
    const parentData = await this.get(key);
    this.check(parentData, 'Array', key, path);
    const data = path ? _get(parentData, path) : parentData;

    if (!allowDupes && data.indexOf(value) > -1) return this;
    data.push(value);
    await this.set(key, path, data);
    return this;
  }

  async remove(key, path, val) {
    const parentData = await this.get(key);
    this.check(parentData, 'Array', key, path);
    const data = !isNil(path) ? _get(parentData, path) : parentData;

    const criteria = isFunction(val) ? val : (value) => val === value;
    const index = data.findIndex(criteria);
    if (index > -1) {
      data.splice(index, 1);
    }
    await this.set(key, path, data);
    return this;
  }

  async includes(key, path = null, val) {
    const parentData = await this.get(key);
    this.check(parentData, 'Array', key, path);
    const data = !isNil(path) ? _get(parentData, path) : parentData;
    const criteria = isFunction(val) ? val : (value) => val === value;
    const index = data.findIndex(criteria);
    return index > -1;
  }

  async inc(key, path) {
    const data = await this.get(key);
    this.check(data, ['Number'], key, path);
    return await this.set(key, path, (!isNil(path) ? _get(data, path) : data) + 1);
  }

  async dec(key, path) {
    const data = await this.get(key);
    this.check(data, ['Number'], key, path);
    return await this.set(key, path, (!isNil(path) ? _get(data, path) : data) - 1);
  }

  async math(key, path, operation, operand) {
    const data = await this.get(key);
    this.check(data, ['Number'], key, path);
    const base = !isNil(path) ? _get(data, path) : data;
    let result = null;
    if (isNil(base) || isNil(operation) || isNil(operand)) {
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
    return await this.set(key, path, result);
  }

  findByValue(path, value) {
    value = serializeData(value);
    return this.query(`SELECT objkey, val FROM ${this.name} WHERE val = ? AND path = ${path ? '?' : "'::NULL::'"} LIMIT 1;`, path ? [value, path] : [value])
      .then(async data => data ? { [data.objkey]: await this.get(data.objkey) } : null)
  }

  async findByFunction(fn, path) {
    const all = Object.entries(await this.getAll()).map(([key, value]) => [key, value]);
    for (const [key, value] of all) {
      if (await fn(path ? _get(value, path) : value, key) === true) return { [key]: value };
    }
    return null;
  }

  filterByValue(path, value) {
    value = serializeData(value);
    return this.query(`SELECT objkey FROM ${this.name} WHERE val = ? AND path = ${path ? "?" : "'::NULL::'"};`, path ? [value, path] : [value], true)
      .then(data => this.getMany(data.map(r => r.objkey)));
  }

  async filterByFunction(fn, path) {
    const all = Object.entries(await this.getAll()).map(([key, value]) => [key, value]);
    const toReturn = {};
    for (const [key, value] of all) {
      if (await fn(path ? _get(value, path) : value, key) === true) toReturn[key] = value;
    }
    return toReturn;
  }

  mapByValue(path) {
    return this.query(`SELECT val FROM ${this.name} WHERE path = ?`, [path], true)
      .then(rows => rows.map(row => this.parseData(row.val)));
  }

  async mapByFunction(fn) {
    const all = await this.getAll();
    const promises = Object.entries(all).map(([key, value]) => fn(value, key));
    return Promise.all(promises);
  }

  someByValue(path, value) {
    return this.someByFunction((val) =>
      path ? _get(val, path) === value : val === value,
    );
  }

  async someByFunction(fn) {
    const all = Object.entries(await this.getAll()).map(([key, value]) => [key, value]);
    for (const [key, value] of all) {
      if (await fn(value, key, all) === true) return true;
    }
    return false;
  }

  everyByValue(path, value) {
    return this.query(`SELECT count(*) FROM ${this.name} WHERE path = ? AND val = ?`, [path, serializeData(value)])
      .then(async rows => rows["count(*)"] === await this.count())
  }

  async everyByFunction(fn) {
    const all = Object.entries(await this.getAll()).map(([key, value]) => [key, value]);
    for (const [key, value] of all) {
      if (await fn(value, key, all) === false) return false;
    }
    return true;
  }

  async autoId() {
    let current = await this.query("SELECT lastnum FROM internal_autonum WHERE josh = ?;", [this.name])
      .catch(() => null);
    if (!current) await this.query("INSERT INTO internal_autonum (josh, lastnum) VALUES (?, 0);", [this.name])
      .catch(() => null);
    let lastnum = current ? current.lastnum : 0;
    lastnum++;
    await this.query("UPDATE internal_autonum SET lastnum = lastnum + 1 WHERE josh = ?", [this.name]);
    return lastnum.toString();
  }

  close() {
    return new Promise(resolve => this.db.end(resolve));
  }

  async destroy() {
    await this.clear();
    await this.runMany([
      [`DROP TABLE IF EXISTS ${this.name};`],
      [`DELETE FROM internal_autonum WHERE josh = ${this.name};`],
    ]);

    return null;
  }

  /* INTERNAL METHODS */

  keyCheck(key) {
    if (isNil(key) || !['String', 'Number'].includes(key.constructor.name)) {
      throw new Error('josh-mysql require keys to be strings or numbers.');
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
      return eval(`(${data})`);
    } catch (err) {
      console.log('Error parsing data : ', err);
      return null;
    }
  }

  /**
   * INTERNAL method to verify the type of a key or property
   * Will THROW AN ERROR on wrong type, to simplify code.
   * @param {*} data Required. The data of the key (whole, without path)
   * @param {string|string[]} type Required. The javascript constructor to check
   * @param {string|number} key Required. The key of the element to check
   * @param {string} path Optional. The dotProp path to the property in JOSH.
   */

  check(data, type, key, path = null) {
    if (isNil(data)) {
      throw new Err(
        `The key "${key}" does not exist in JOSH "${this.name}"`,
        'JoshPathError',
      );
    }
    if (!type) return;
    if (!isArray(type)) type = [type];
    if (!isNil(path) && path !== '') {
      this.check(data, 'Object', key);
      if (isNil(_get(data, path))) {
        throw new Err(
          `The property "${path}" in key ${key} does not exist. Please set() it or ensure() it."`,
          'JoshPathError',
        );
      }
      if (!type.includes(_get(data, path).constructor.name)) {
        throw new Err(
          `The property "${path}" in key "${key}" is not of type "${type.join(
            '" or "',
          )}" in JOSH "${this.name}" 
(key was of type "${_get(data, path).constructor.name}")`,
          'JoshTypeError',
        );
      }
    } else if (!type.includes(data.constructor.name)) {
      throw new Err(
        `The key "${key}" is not of type "${type.join('" or "')}" in JOSH "${this.name
        }" (key was of type "${data.constructor.name}")`,
        'JoshTypeError',
      );
    }
  }

  // TODO: Check if I can figure out how to get actual NULL values instead of ::NULL::.
  async compareData(key, newValue, path) {
    const executions = [];
    const currentData = await this.has(key) ? await this.get(key) : '::NULL::';
    const currentPaths = getPaths(currentData);
    const paths = path
      ? getPaths(_set(cloneDeep(currentData), path, newValue))
      : getPaths(newValue);

    for (const [currentPath, value] of Object.entries(currentPaths)) {
      if (isNil(paths[currentPath]) || paths[currentPath] !== value) {
        executions.push([this.deleteStmt, [key, currentPath]]);
        if (!isNil(paths[currentPath])) {
          executions.push([
            this.insertStmt,
            [key, currentPath, paths[currentPath]],
          ]);
        }
      }
      delete paths[currentPath];
    }
    for (const [currentPath, value] of Object.entries(paths)) {
      executions.push([this.insertStmt, [key, currentPath, value]]);
    }
    return executions;
  }
};
