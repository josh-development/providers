var idb =
  window.indexedDB || // Use the standard DB API
  window.mozIndexedDB || // Or Firefox's early version of it
  window.webkitIndexedDB; // Or Chrome's early version

var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
var IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;

class DatabaseManager {
  constructor() {
    return this;
  }
  async load() {
    return new Promise((res, rej) => {
      let openRequest = idb.open('josh', 1);
      openRequest.onerror = rej;
      openRequest.onupgradeneeded = function () {
        let db = openRequest.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store', { keyPath: 'key' });
        }
      };
      openRequest.onsuccess = () => {
        this.indexedDB = openRequest.result;
        res();
      };
    });
  }
  open() {
    const transaction = this.indexedDB.transaction('store', 'readwrite');
    const all = transaction.objectStore('store');
    return all;
  }
  async set(key, value) {
    const all = this.open();

    let doc = {
      key,
      value,
    };

    const request = all.put(doc);

    await this.handleEvents(request);
  }
  async get(key) {
    const all = this.open();

    const request = all.get(key);
    const result = await this.handleEvents(request);

    return result ? result.value : null;
  }
  async getAll() {
    const all = this.open();
    const request = all.getAll();
    const docs = await this.handleEvents(request);
    const final = {};
    docs.forEach((x) => {
      final[x.key] = x.value;
    });
    return final;
  }
  async getKeys() {
    const all = this.open();
    const request = all.getAllKeys();
    return await this.handleEvents(request);
  }
  async count() {
    const all = this.open();
    const request = all.count();
    return await this.handleEvents(request);
  }
  async delete(key) {
    const all = this.open();
    const request = all.delete(key);
    return await this.handleEvents(request);
  }
  async clear() {
    const all = this.open();
    const request = all.clear();
    return await this.handleEvents(request);
  }
  async has(key) {
    return (await this.get(key)) != null;
  }
  handleEvents(request) {
    return new Promise((res, rej) => {
      request.onsuccess = function () {
        res(request.result);
      };

      request.onerror = () => {
        rej(request.error);
      };
    });
  }
}

module.exports = { DatabaseManager };
