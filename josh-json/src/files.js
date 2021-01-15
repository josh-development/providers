const atomic = require('atomically');
const path = require('path');
const { serializeData, parseData } = require('./utils');
const fs = require('fs');
const { isEqual } = require('lodash');
class FileManager {
  constructor(dir, opts) {
    this.options = opts || {};
    this.dir = path.resolve(process.cwd(), dir);
    try {
      fs.mkdirSync(dir);
    } catch {}
  }
  async getIndex(key) {
    let index = await this.getFile('index.json');
    if (
      !index.files ||
      !index.files.find((x) => x.keys.length < (this.options.maxLength || 100))
    ) {
      index = await this.addFile(index);
    }
    let found = index.files.find((x) => x.keys.includes(key));
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
    let index = await this.getIndex(key);
    if (key) {
      if (index && index.location) {
        return (await this.getFile(index.location))[key];
      } else {
        return null;
      }
    }
    let all = {};
    for (let file of index.files) {
      all = { ...all, ...(await this.getFile(file.location)) };
    }
    return all;
  }
  async addFile(index) {
    if (!index) index = await this.getIndex();
    if (!index.files) {
      index.files = [];
    }
    let location = path.resolve(
      this.dir,
      'josh_' + index.files.length + '.json',
    );
    index.files.push({ keys: [], location });
    await this.setFile(location, {});
    await this.setIndex(index);
    return index;
  }
  async deleteAll() {
    let index = await this.getIndex();
    for (let file of index.files) {
      fs.unlinkSync(file.location);
    }
    fs.unlinkSync(path.resolve(this.dir, 'index.json'));
  }
  async deleteData(key) {
    let index = await this.getIndex();
    let file = index.files.find((x) => x.keys.includes(key));
    if (!index || !file) return;
    let data = await this.getFile(file.location);
    delete data[key];
    await this.setFile(file.location, data);
    file.keys = file.keys.filter((x) => x != key);

    if (file.keys.length === 0) {
      fs.unlinkSync(file.location);
      index.files = index.files.filter((x) => x.location != file.location);
      await this.setIndex(index);
    } else {
      let idx = index.files.findIndex((x) => x.location == file.location);
      index.files[idx] = file;
      await this.setIndex(index);
    }
    return;
  }
  async setData(key, value) {
    let index = await this.getIndex();
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
    let index = await this.getIndex();
    return index.files.reduce((prev, curr) => (prev += curr.keys.length), 0);
  }
}
module.exports = { FileManager };
