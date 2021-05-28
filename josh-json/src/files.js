const atomic = require('atomically');
const path = require('path');
const { serializeData, parseData } = require('./utils');
const fs = require('fs');
const { isEqual, get: _get } = require('lodash');
class FileManager {
  constructor(dir, opts) {
    this.options = opts || {};
    this.dir = path.resolve(process.cwd(), dir);
    try {
      fs.mkdirSync(dir);
    } catch {
      // don't need to do anything
    }
  }
  async has(key, path) {
    const index = await this.getIndex();
    if (!path) {
      return index.files.find((x) => x.keys.includes(key)) != null;
    } else {
      const data = await this.getData(key);
      return _get(data, path) != undefined;
    }
  }
  async getIndex(key) {
    let index = await this.getFile('index.json');
    if (
      !index.files ||
      !index.files.find((x) => x.keys.length < (this.options.maxLength || 100))
    ) {
      index = await this.addFile(index);
    }
    const found = index.files.find((x) => x.keys.includes(key));
    if (key && found) {
      return found;
    } else {
      return index;
    }
  }
  async setIndex(data) {
    return await this.setFile('index.json', data);
  }
  async setFile(file, data) {
    await atomic.writeFile(path.resolve(this.dir, file), serializeData(data));
    return data;
  }
  async getFile(file) {
    let data = {};
    try {
      data = parseData(
        await atomic.readFile(path.resolve(this.dir, file), {
          encoding: 'utf8',
        }),
      );
    } catch (err) {
      await atomic.writeFile(path.resolve(this.dir, file), '{}');
    }
    return data;
  }
  async getData(key) {
    const index = await this.getIndex(key);
    if (key) {
      if (index && index.location) {
        return (await this.getFile(index.location))[key];
      } else {
        return null;
      }
    }
    let all = {};
    for (const file of index.files) {
      all = { ...all, ...(await this.getFile(file.location)) };
    }
    return all;
  }
  async addFile(index) {
    if (!index) index = await this.getIndex();
    if (!index.files) {
      index.files = [];
    }
    const location = path.resolve(this.dir, `josh_${index.files.length}.json`);
    index.files.push({ keys: [], location });
    await this.setFile(location, {});
    await this.setIndex(index);
    return index;
  }
  async deleteAll() {
    const index = await this.getIndex();
    for (const file of index.files) {
      fs.unlinkSync(file.location);
    }
    fs.unlinkSync(path.resolve(this.dir, 'index.json'));
  }
  async deleteData(key) {
    const index = await this.getIndex();
    const file = index.files.find((x) => x.keys.includes(key));
    if (!index || !file) return;
    const data = await this.getFile(file.location);
    delete data[key];
    await this.setFile(file.location, data);
    file.keys = file.keys.filter((x) => x != key);

    if (file.keys.length === 0) {
      fs.unlinkSync(file.location);
      index.files = index.files.filter((x) => x.location != file.location);
      await this.setIndex(index);
    } else {
      const idx = index.files.findIndex((x) => x.location == file.location);
      index.files[idx] = file;
      await this.setIndex(index);
    }
    return;
  }
  async setData(key, value) {
    const index = await this.getIndex();
    let file = index.files.findIndex((x) => x.keys.includes(key));
    if (file < 0) {
      file = index.files.findIndex(
        (x) => x.keys.length < (this.options.maxLength || 100),
      );
      index.files[file].keys.push(key);
      await this.setIndex(index);
    }
    const fileData = await this.getFile(index.files[file].location);
    if (isEqual(fileData[key], value)) return;
    fileData[key] = value;
    await this.setFile(index.files[file].location, fileData);
  }
  async getCount() {
    const index = await this.getIndex();
    return index.files.reduce((prev, curr) => (prev += curr.keys.length), 0);
  }
  async indexAll() {
    const index = await this.getIndex();
    for (let file of index.files) {
      const keys = file.keys;
      const dataKeys = Object.keys(await this.getFile(file.location));
      if (isEqual(keys, dataKeys)) return;
      for (const key of dataKeys) {
        if (!keys.includes(key)) keys.push(key);
      }
      index.files[index.files.indexOf(file)].keys = keys;
      await this.setIndex(index);
    }
    return;
  }
  async cleanupEmpty() {
    const index = await this.getIndex();
    for (const file of index.files) {
      const keys = file.keys;
      const dataKeys = Object.keys(await this.getFile(file.location));
      if (isEqual(keys, dataKeys)) return;
      for (const key of keys) {
        if (!dataKeys.includes(key)) keys.splice(keys.indexOf(key))
      }
      index.files[index.files.indexOf(file)].keys = keys;
      await this.setIndex(index);
    }
    return;
  }
}
module.exports = { FileManager };
