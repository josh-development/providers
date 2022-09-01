import { Spinner } from '@favware/colorette-spinner';
import { JoshProvider, Method } from '@joshdb/provider';
import { toTitleCase } from '@sapphire/utilities';
import { blueBright, cyanBright, gray, greenBright, magentaBright } from 'colorette';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { performance } from 'perf_hooks';
import { createCard } from './functions/createCard';

export class Benchmark {
  public providers: [string, JoshProvider<Benchmark.TestCard>][] = [];

  public tests: Benchmark.Test[] = [];

  public add(provider: JoshProvider<Benchmark.TestCard> | (() => JoshProvider<Benchmark.TestCard>), name?: string): this {
    if (typeof provider === 'function') provider = provider();

    this.providers.push([
      toTitleCase(name ?? provider.constructor.name, {
        additionalVariants: {
          mapProvider: 'MapProvider',
          jsonProvider: 'JSONProvider',
          mongoProvider: 'MongoProvider',
          autoKey: 'AutoKey',
          deleteMany: 'DeleteMany',
          getAll: 'GetAll',
          getMany: 'GetMany',
          randomKey: 'RandomKey',
          setMany: 'SetMany'
        }
      }),
      provider
    ]);

    return this;
  }

  public use(...tests: Benchmark.Test[]): this {
    this.tests = [
      ...this.tests,
      ...tests.map((test) => ({
        ...test,
        name: toTitleCase(test.name, {
          additionalVariants: {
            mapProvider: 'MapProvider',
            jsonProvider: 'JSONProvider',
            mongoProvider: 'MongoProvider',
            autoKey: 'AutoKey',
            deleteMany: 'DeleteMany',
            getAll: 'GetAll',
            getMany: 'GetMany',
            randomKey: 'RandomKey',
            setMany: 'SetMany'
          }
        })
      }))
    ];

    return this;
  }

  public async run(cardCount = Benchmark.defaultCardCount): Promise<Benchmark.PerformanceProviderResult[]> {
    console.log(magentaBright('\nRunning test benchmarks for Josh providers...\n'));

    if (this.tests.length === 0) {
      console.log(gray('No tests specified, exiting quietly...'));

      return [];
    }

    const cards = this.generateCards(cardCount);
    const results: Benchmark.PerformanceProviderResult[] = [];

    for (const [name, provider] of this.providers) {
      console.log(`${blueBright('Benchmark:')} ${cyanBright(name)}\n`);

      const josh = provider;

      await josh.init({ name: 'benchmark' });
      await josh[Method.Clear]({ method: Method.Clear, errors: [] });

      const result: Benchmark.PerformanceProviderResult = {
        name,
        total: 0,
        tests: []
      };

      for (const test of this.tests) {
        const spinner = new Spinner(test.name).start();
        const testResult: Benchmark.PerformanceTestResult = {
          name: test.name,

          times: []
        };

        const runOptions: Benchmark.TestRunOptions = {
          josh,

          keys: Object.keys(cards),

          values: Object.values(cards),

          entries: Object.entries(cards).map(([key, value]) => ({ key, value, path: [] }))
        };

        if (test.beforeAll !== undefined) await test.beforeAll(runOptions);

        for (const [id, card] of Object.entries(cards)) {
          const runEachOptions: Benchmark.TestRunEachOptions = {
            ...runOptions,

            card
          };

          if (test.beforeEach !== undefined) await test.beforeEach(runEachOptions);

          const start = performance.now();

          await test.run(runEachOptions);

          const end = performance.now();

          testResult.times.push(end - start);
          spinner.update({ text: `${test.name} (${id}/${cardCount})` });
        }

        await josh[Method.Clear]({ method: Method.Clear, errors: [] });
        spinner.success({ text: test.name });
        result.tests.push(testResult);
      }

      result.total = result.tests.reduce((acc, test) => acc + test.times.reduce((ac, time) => ac + time, 0), 0);
      console.log(greenBright(`\n${name} Benchmark Results:`));
      console.table(
        result.tests.reduce<Record<string, Record<string, string>>>((table, result) => {
          const { name, times } = result;

          table[name] = {
            [gray(Benchmark.TableColumn.Average)]: this.averageTimeString(times),
            [gray(Benchmark.TableColumn.Min)]: this.minTimeString(times),
            [gray(Benchmark.TableColumn.Max)]: this.maxTimeString(times),
            [gray(Benchmark.TableColumn.Total)]: this.totalTimeString(times)
          };

          return table;
        }, {})
      );

      console.log('\n');
      results.push(result);
    }

    results.sort((a, b) => a.total - b.total);

    const table: { [key: string]: any } = {};

    for (const test of this.tests) {
      table[test.name] = {};

      for (const result of results) {
        const found = result.tests.find((result) => result.name === test.name);

        if (found) table[test.name][result.name] = this.averageTimeString(found.times);
      }
    }

    table.Total = {};

    for (const result of results) {
      table.Total[result.name] = this.totalTimeString(result.tests.map((result) => result.times.reduce((prev, curr) => prev + curr, 0)));
    }

    console.log(greenBright('\nBenchmark Results:'));
    console.table(table);

    return results;
  }

  public async export(results: Benchmark.PerformanceProviderResult[]): Promise<void> {
    const directory = resolve(process.cwd(), 'benchmarks', 'results');

    if (!existsSync(directory)) await mkdir(directory, { recursive: true });

    const path = resolve(directory, `${Date.now()}.json`);

    await writeFile(path, JSON.stringify(results, null, 2), { encoding: 'utf8' });
  }

  private generateCards(cardCount: number): Record<string, Benchmark.TestCard> {
    const spinner = new Spinner('Card Generation').start();
    const cards: Record<string, Benchmark.TestCard> = {};

    for (let i = 0; i < cardCount; i++) {
      spinner.update({ text: `Card Generation (${i}/${cardCount})` });

      const card = createCard(i);

      cards[i.toString()] = card;
    }

    spinner.success({ text: 'Card Generation Complete\n' });

    return cards;
  }

  private averageTimeString(times: number[]): string {
    const average = times.reduce((acc, time) => acc + time, 0) / times.length;

    if (average >= 1000) return `${(average / 1000).toFixed(2)}s`;
    if (average >= 1) return `${average.toFixed(2)}ms`;

    return `${(average * 1000).toFixed(2)}μs`;
  }

  private minTimeString(times: number[]): string {
    const min = Math.min(...times);

    if (min >= 1000) return `${(min / 1000).toFixed(2)}s`;
    if (min >= 1) return `${min.toFixed(2)}ms`;

    return `${(min * 1000).toFixed(2)}μs`;
  }

  private maxTimeString(times: number[]): string {
    const max = Math.max(...times);

    if (max >= 1000) return `${(max / 1000).toFixed(2)}s`;
    if (max >= 1) return `${max.toFixed(2)}ms`;

    return `${(max * 1000).toFixed(2)}μs`;
  }

  private totalTimeString(times: number[]): string {
    const total = times.reduce((acc, time) => acc + time, 0);

    if (total >= 1000) return `${(total / 1000).toFixed(2)}s`;
    if (total >= 1) return `${total.toFixed(2)}ms`;

    return `${(total * 1000).toFixed(2)}μs`;
  }

  public static defaultCardCount = 1000;
}

export namespace Benchmark {
  export interface Test {
    name: string;

    beforeAll?: (options: TestRunOptions) => Awaitable<void>;

    beforeEach?: (options: TestRunEachOptions) => Awaitable<void>;

    run(options: TestRunEachOptions): Awaitable<void>;
  }

  export interface TestRunOptions {
    josh: JoshProvider<TestCard>;

    keys: string[];

    values: TestCard[];

    entries: { key: string; path: string[]; value: TestCard }[];
  }

  export interface TestRunEachOptions extends TestRunOptions {
    card: TestCard;
  }

  export interface TestCard {
    id: string;

    net: number;

    ids: string[];
  }

  export interface PerformanceResult {
    name: string;
  }

  export interface PerformanceTestResult extends PerformanceResult {
    times: number[];
  }

  export interface PerformanceProviderResult extends PerformanceResult {
    tests: PerformanceTestResult[];

    total: number;
  }

  export enum TableColumn {
    Average = 'Average',

    Min = 'Min',

    Max = 'Max',

    Total = 'Total'
  }
}

export type Awaitable<T> = PromiseLike<T> | T;
