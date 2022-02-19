import faker from '@faker-js/faker';
import type { Card } from '@faker-js/faker/helpers';
import { Josh, JoshProvider, MathOperator, Method } from '@joshdb/core';
import { blueBright, cyanBright, gray, greenBright, magentaBright } from 'colorette';
import ora from 'ora-classic';
import { performance } from 'perf_hooks';
import { toTitleCase } from './functions/toTitleCase';

export class Benchmark {
  private providers: [string, JoshProvider<Benchmark.TestCard>][] = [];

  public add(provider: JoshProvider<Benchmark.TestCard> | (() => JoshProvider<Benchmark.TestCard>), name?: string): this {
    if (typeof provider === 'function') provider = provider();

    this.providers.push([name ?? provider.constructor.name, provider]);

    return this;
  }

  public async run(): Promise<void> {
    console.log(magentaBright('\nRunning test benchmarks for Josh providers...\n'));

    const cards = this.generateCards();

    for (const [name, provider] of this.providers) {
      console.log(`${blueBright('Benchmark:')} ${cyanBright(name)}\n`);

      const josh = new Josh<Benchmark.TestCard>({ name: 'benchmark', provider });

      await josh.init();
      await josh.clear();

      const testPerfData: [string, Benchmark.PerfData[]][] = [];

      for (const test of Benchmark.tests) {
        const spinner = ora(toTitleCase(test.name)).start();
        const perfData: Benchmark.PerfData[] = [];
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

          spinner.text = `${toTitleCase(test.name)} (${id}/${Benchmark.cardCount})`;

          perfData.push({ name: test.name, time: end - start });
        }

        await josh.clear();

        spinner.succeed(toTitleCase(test.name));
        testPerfData.push([test.name, perfData]);
      }

      console.log(greenBright(`\n${name} Benchmark Results:`));

      console.table(
        testPerfData.reduce<Record<string, Record<string, string>>>((table, [testName, perfData]) => {
          const times = perfData.map(({ time }) => time);

          table[toTitleCase(testName)] = {
            [gray(Benchmark.TableColumn.Average)]: this.averageTimeString(times),
            [gray(Benchmark.TableColumn.Min)]: this.minTimeString(times),
            [gray(Benchmark.TableColumn.Max)]: this.maxTimeString(times),
            [gray(Benchmark.TableColumn.Total)]: this.totalTimeString(times)
          };

          return table;
        }, {})
      );

      console.log('\n');
    }

    process.exit(0);
  }

  private generateCards(): Record<string, Benchmark.TestCard> {
    const spinner = ora('Card Generation').start();
    const cards: Record<string, Benchmark.TestCard> = {};

    for (let i = 0; i < Benchmark.cardCount; i++) {
      spinner.text = `Card Generation (${i}/${Benchmark.cardCount})`;

      cards[i.toString()] = { id: i.toString(), net: 0, ...faker.helpers.createCard() };
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

  private static tests: Benchmark.Test[] = [
    {
      name: Method.Clear,

      beforeEach: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.clear();
      }
    },
    {
      name: Method.Delete,

      beforeAll: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh, card }) => {
        await josh.delete(card.id);
      }
    },
    {
      name: Method.DeleteMany,

      beforeEach: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh, keys }) => {
        await josh.deleteMany(keys);
      }
    },
    {
      name: Method.Get,

      beforeEach: async ({ josh, card }) => {
        await josh.set(card.id, card);
      },

      run: async ({ josh, card }) => {
        await josh.get(card.id);
      }
    },
    {
      name: Method.GetAll,

      beforeAll: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.getAll();
      }
    },
    {
      name: Method.GetMany,

      beforeAll: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh, keys }) => {
        await josh.getMany(keys);
      }
    },
    {
      name: Method.Math,

      beforeAll: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh, card }) => {
        await josh.math(`${card.id}.net`, MathOperator.Addition, 1);
      }
    },
    {
      name: Method.Random,

      beforeAll: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.random();
      }
    },
    {
      name: `${Method.Random} (!Duplicates)`,

      beforeAll: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.random({ duplicates: false });
      }
    },
    {
      name: Method.RandomKey,

      beforeAll: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.randomKey();
      }
    },
    {
      name: `${Method.RandomKey} (!Duplicates)`,

      beforeAll: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.randomKey({ duplicates: false });
      }
    },
    {
      name: Method.Set,

      beforeAll: async ({ josh }) => {
        await josh.clear();
      },

      run: async ({ josh, card }) => {
        await josh.set(card.id, card);
      }
    },
    {
      name: Method.SetMany,

      beforeAll: async ({ josh }) => {
        await josh.clear();
      },

      run: async ({ josh, entries }) => {
        await josh.setMany(entries);
      }
    }
  ];
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
  }

  export interface PerfData {
    name: string;

    time: number;
  }

  export enum TableColumn {
    Average = 'Average',

    Min = 'Min',

    Max = 'Max',

    Total = 'Total'
  }
}

export type Awaitable<T> = PromiseLike<T> | T;
