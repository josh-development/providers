import prompts from 'prompts';
import { JSONProvider } from '../../packages/json/src';
import { MapProvider } from '../../packages/map/src';
import { MariaProvider } from '../../packages/maria/src';
import { MongoProvider } from '../../packages/mongo/src';
import { RedisProvider } from '../../packages/redis/src';
import { SqliteProvider } from '../../packages/sqlite/src';
import { Benchmark } from './lib/Benchmark';
import { BASIC_BENCHMARK_TESTS, BENCHMARK_TESTS } from './lib/constants/benchmark-tests';
import { BenchmarkType } from './lib/types/BenchmarkType';
import { PickType } from './lib/types/YesNo';

async function main() {
  const benchmark = new Benchmark()
    .add(new JSONProvider({ dataDirectory: '.bench' }), 'JSONProvider (Serialize)')
    .add(new JSONProvider({ dataDirectory: '.bench', disableSerialization: true }))
    .add(new MapProvider())
    .add(new MongoProvider({ collectionName: 'benchmark' }), 'MongoProvider (Serialize)')
    .add(new MongoProvider({ collectionName: 'benchmark', disableSerialization: true }))
    .add(new MariaProvider({}), 'MariaDBProvider (Serialize)')
    .add(new MariaProvider({ disableSerialization: true }))
    .add(new RedisProvider({}), 'RedisProvider (Serialize)')
    .add(new RedisProvider({ disableSerialization: true }))
    .add(new SqliteProvider({ dataDirectory: '.bench', wal: false }), 'SqliteProvider (Serialize)')
    .add(new SqliteProvider({ dataDirectory: '.bench', wal: false, disableSerialization: true }));

  if (process.env.CI === 'true') prompts.inject([100, 50, BenchmarkType.All, PickType.No]);

  const response = await prompts([
    { type: 'number', name: 'cardCount', message: 'How many cards do you want to test?', initial: Benchmark.defaultCardCount },
    {
      type: 'select',
      name: 'type',
      message: 'What type of benchmark do you want to run?',
      choices: [
        { title: 'Basic', value: BenchmarkType.Basic },
        { title: 'All', value: BenchmarkType.All }
      ]
    },
    {
      type: 'select',
      name: 'export',
      message: 'Do you want to create an exported file of the benchmark test results?',
      choices: [
        { title: 'No, DO NOT create a file of the results.', value: PickType.No },
        { title: 'Yes, DO create a file of the results.', value: PickType.Yes }
      ]
    }
  ]);

  if (response.cardCount === undefined) process.exit(1);
  if (response.type === undefined) process.exit(1);
  if (response.export === undefined) process.exit(1);

  switch (response.type as BenchmarkType) {
    case BenchmarkType.All:
      benchmark.use(...BENCHMARK_TESTS);

      break;

    case BenchmarkType.Basic:
      benchmark.use(...BASIC_BENCHMARK_TESTS);

      break;
  }

  const results = await benchmark.run(response.cardCount);

  if (response.export === PickType.Yes) await benchmark.export(results);

  process.exit(0);
}

void main();
