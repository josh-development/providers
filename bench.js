const data = require('./bench.json');

async function test(name, provider, mb) {
  const times = [];
  const start = new Date();
  const id = Math.random().toString();
  // const data = new Array(500000 * mb)
  //   .fill('A')
  //   .map((x) => Math.random().toString()[0])
  //   .join('');
  times.push(new Date() - start);
  for (let key of data.keys) {
    await provider.set(key.key, null, key.value);
  }
  times.push(new Date() - start - times.reduce((prev, curr) => (prev += curr)));
  for (let key of data.keys) {
    await provider.get(key.key);
  }
  times.push(new Date() - start - times.reduce((prev, curr) => (prev += curr)));
  for (let key of data.keys) {
    await provider.delete(key.key);
  }
  times.push(new Date() - start - times.reduce((prev, curr) => (prev += curr)));
  for (let key of data.keys) {
    await provider.has(key.key);
  }
  times.push(new Date() - start - times.reduce((prev, curr) => (prev += curr)));
  return times;
}

const Mongo = require('./josh-mongo/src/index');
const SQlite = require('./josh-sqlite/src/index');
const Json = require('./josh-json/src/index');

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
  {
    name: 'josh-json',
    fn: Json,
    conf: { name: 'josh', providerOptions: { maxLength: 100 } },
  },
];

(async () => {
  let runs = 1;
  // let mb = 10;
  for (provider of providers) {
    console.log('Starting', provider.name);
    const p = new provider.fn(provider.conf);
    await p.init();
    provider.times = [0, 0, 0, 0, 0];
    for (let i = 0; i <= runs; i++) {
      const ran = await test(provider.name, p /*, mb*/);
      ran.forEach((val, ind) => {
        provider.times[ind] += val;
      });
    }
  }
  let docs = [];
  providers.forEach((provider, index) => {
    docs[index] = { name: provider.name };
    provider.times.forEach((time, ind) => {
      docs[index][['Generate', 'Set', 'Get', 'Delete', 'Has'][ind]] =
        Math.round(time / runs) + 'ms';
    });
    docs[index].Total = Math.round(
      provider.times.slice(1).reduce((prev, curr) => (prev += curr)) / runs,
    );
  });
  docs.sort((a, b) => a.Total - b.Total);
  console.log(
    'Avg speeds of ' +
      runs +
      ' runs per database: ' +
      providers.map((x) => x.name).join(', '),
  );
  console.table(docs);
  process.exit();
})();
