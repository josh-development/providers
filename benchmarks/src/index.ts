import { MapProvider } from '@joshdb/core';
import { JSONProvider } from '../../packages/json/src';
import { MongoProvider } from '../../packages/mongo/src';
import { Benchmark } from './lib/Benchmark';
import { BENCHMARK_TESTS } from './lib/constants/benchmark-tests';

const benchmark = new Benchmark();

void benchmark
  .add(new MapProvider())
  .add(new JSONProvider({ dataDirectoryName: '.bench' }), 'JSONProvider (Serialize)')
  .add(new JSONProvider({ dataDirectoryName: '.bench', disableSerialization: true }))
  .add(new MongoProvider({ collectionName: 'benchmark' }), 'MongoProvider (Serialize)')
  .use(...BENCHMARK_TESTS)
  .run();
