import { faker } from '@faker-js/faker';
import type { Card } from '@faker-js/faker/helpers';
import { Josh, JoshProvider } from '@joshdb/core';
import { blueBright, cyanBright, gray, greenBright, magentaBright } from 'colorette';
import ora from 'ora-classic';
import { performance } from 'perf_hooks';
import { toTitleCase } from './functions/toTitleCase';

export class Benchmark {
  private providers: [string, JoshProvider<Benchmark.TestCard>][] = [];

  private tests: Benchmark.Test[] = [];

  public add(provider: JoshProvider<Benchmark.TestCard> | (() => JoshProvider<Benchmark.TestCard>), name?: string): this {
    if (typeof provider === 'function') provider = provider();

    this.providers.push([toTitleCase(name ?? provider.constructor.name), provider]);

    return this;
  }

  public use(...tests: Benchmark.Test[]): this {
    this.tests = [...this.tests, ...tests.map((test) => ({ ...test, name: toTitleCase(test.name) }))];

    return this;
  }

  public async run(): Promise<Benchmark.PerformanceProviderResult[]> {
    console.log(magentaBright('\nRunning test benchmarks for Josh providers...\n'));

    if (this.tests.length === 0) {
      console.log(gray('No tests specified, exiting quietly...'));

      return [];
    }

    const cards = this.generateCards();
    const results: Benchmark.PerformanceProviderResult[] = [];

    for (const [name, provider] of this.providers) {
      console.log(`${blueBright('Benchmark:')} ${cyanBright(name)}\n`);

      const josh = new Josh<Benchmark.TestCard>({ name: 'benchmark', provider });

      await josh.init();
      await josh.clear();

      const result: Benchmark.PerformanceProviderResult = {
        name,

        tests: []
      };

      for (const test of this.tests) {
        const spinner = ora(test.name).start();
        const testResult: Benchmark.PerformanceTestResult = {
          name: test.name,

          times: []
        };
        const runOptions: Benchmark.TestRunOptions = {
          josh,

          keys: Object.keys(cards),

          values: Object.values(cards),

          entries: Object.entries(cards)
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

          spinner.text = `${test.name} (${id}/${Benchmark.cardCount})`;

          testResult.times.push(end - start);
        }

        await josh.clear();

        spinner.succeed(test.name);

        result.tests.push(testResult);
      }

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

    return results;
  }

  private generateCards(): Record<string, Benchmark.TestCard> {
    const spinner = ora('Card Generation').start();
    const cards: Record<string, Benchmark.TestCard> = {};

    for (let i = 0; i < Benchmark.cardCount; i++) {
      spinner.text = `Card Generation (${i}/${Benchmark.cardCount})`;

      cards[i.toString()] = { id: i.toString(), net: 0, ids: [], ...faker.helpers.createCard() };
    }

    spinner.succeed('Card Generation Complete\n');

    return cards;
  }

  private averageTimeString(times: number[]): string {
    return `${(times.reduce((acc, time) => acc + time, 0) / times.length).toFixed(2)}μs`;
  }

  private minTimeString(times: number[]): string {
    return `${Math.min(...times).toFixed(2)}μs`;
  }

  private maxTimeString(times: number[]): string {
    return `${Math.max(...times).toFixed(2)}μs`;
  }

  private totalTimeString(times: number[]): string {
    return `${times.reduce((acc, time) => acc + time, 0).toFixed(2)}μs`;
  }

  public static cardCount = 100;
}

export namespace Benchmark {
  export interface Test {
    name: string;

    beforeAll?: (options: TestRunOptions) => Awaitable<void>;

    beforeEach?: (options: TestRunEachOptions) => Awaitable<void>;

    run(options: TestRunEachOptions): Awaitable<void>;
  }

  export interface TestRunOptions {
    josh: Josh<TestCard>;

    keys: string[];

    values: TestCard[];

    entries: [string, TestCard][];
  }

  export interface TestRunEachOptions extends TestRunOptions {
    card: TestCard;
  }

  export interface TestCard extends Card {
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
  }

  export enum TableColumn {
    Average = 'Average',

    Min = 'Min',

    Max = 'Max',

    Total = 'Total'
  }
}

export type Awaitable<T> = PromiseLike<T> | T;
