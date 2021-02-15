const { fetchTests } = require('./utils');

const files = fetchTests(require('path').resolve(__dirname, 'tests'));

let last = files.sort((a, b) => b.place - a.place)[0].place;

let string = `// test('Database can be closed', async () => {
//   await provider.close();
// });`;

string = string
  .split('// test(')
  .join('module.exports = { \nplace: ' + (last + 1) + ',\nname:')
  .split('() =>')
  .join('fn(provider) ')
  .split('// });')
  .join('}}')
  .split('\n//')
  .join('\n');
console.log(string);
