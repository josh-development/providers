async function test(name, provider) {
  console.time(name);
  const id = Math.random().toString();
  const data = new Array(100000).map((x) => Math.random()).join('');
  console.timeLog(name, 'Generate data');
  await provider.set('test_' + id, data);
  console.timeLog(name, 'Set data');
  await provider.get('test_' + id);
  console.timeLog(name, 'Get data');
}

const Mongo = require('./josh-mongo/src/index');
const SQlite = require('./josh-sqlite/src/index');

const providers = [
  {
    name: 'josh-mongo',
    fn: Mongo,
    conf: require('./josh-mongo/src/__tests__/config-mongo.json'),
  },
  {
    name: 'josh-sqlite',
    fn: SQlite,
    conf: { name: 'josh' },
  },
];

(async () => {
  for (provider of providers) {
    const p = new provider.fn(provider.conf);
    await p.init();
    await test(provider.name, p);
  }
  process.exit();
})();
