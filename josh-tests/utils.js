const fs = require('file-system');
const path = require('path');
function fetchTests(dir, all = []) {
  dir = path.resolve(dir);
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const location = path.resolve(dir, file);
    const stat = fs.statSync(location);
    if (stat.isDirectory()) {
      all = fetchTests(location, all);
    } else {
      const mod = require(location);
      all.push(mod);
    }
  }
  return all;
}

module.exports = { fetchTests };
