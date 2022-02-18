import faker from '@faker-js/faker';
import type { Card } from '@faker-js/faker/helpers';
import { Josh, JoshProvider, MathOperator, Method } from '@joshdb/core';
import { blueBright, cyanBright, gray, greenBright, magentaBright } from 'colorette';
import ora from 'ora-classic';
import { performance } from 'perf_hooks';
import { toTitleCase } from './functions/toTitleCase';

export class Benchmark {
  private providers: JoshProvider<Benchmark.TestCard>[] = [];

  public add(provider: JoshProvider<Benchmark.TestCard> | (() => JoshProvider<Benchmark.TestCard>)): this {
    this.providers.push(typeof provider === 'function' ? provider() : provider);

    return this;
  }

  public async run(): Promise<void> {
    console.log(magentaBright('\nRunning test benchmarks for Josh providers...\n'));

    const cards = this.generateCards();

    for (const provider of this.providers) {
      console.log(`${blueBright('Benchmark:')} ${cyanBright(provider.constructor.name)}\n`);

      const josh = new Josh<Benchmark.TestCard>({ name: 'benchmark', provider });

      await josh.init();

      const testPerfData: [string, Benchmark.PerfData[]][] = [];

      for (const test of Benchmark.tests) {
        const spinner = ora(toTitleCase(test.name)).start();
        const perfData: Benchmark.PerfData[] = [];

        for (const [id, card] of Object.entries(cards)) {
          const options: Benchmark.TestRunOptions = {
            josh,

            card,

            keys: Object.keys(cards),

            values: Object.values(cards),

            entries: Object.entries(cards)
          };

          if (test.pre !== undefined) await test.pre(options);

          const start = performance.now();

          await test.run(options);

          const end = performance.now();

          if (test.post !== undefined) await test.post(options);

          spinner.text = `${toTitleCase(test.name)} (${id}/${Benchmark.cardCount})`;

          perfData.push({ name: test.name, time: end - start });

          await josh.clear();
        }

        spinner.succeed(toTitleCase(test.name));
        testPerfData.push([test.name, perfData]);
      }

      console.log(greenBright(`\n${provider.constructor.name} Benchmark Results:`));

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

  public static cardCount = 1000;

  private static tests: Benchmark.Test[] = [
    {
      name: Method.Clear,

      pre: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.clear();
      }
    },
    {
      name: Method.Delete,

      pre: async ({ josh, card }) => {
        await josh.set(card.id, card);
      },

      run: async ({ josh, card }) => {
        await josh.delete(card.id);
      }
    },
    {
      name: Method.DeleteMany,

      pre: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh, keys }) => {
        await josh.deleteMany(keys);
      }
    },
    {
      name: Method.Get,

      pre: async ({ josh, card }) => {
        await josh.set(card.id, card);
      },

      run: async ({ josh, card }) => {
        await josh.get(card.id);
      }
    },
    {
      name: Method.GetAll,

      pre: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.getAll();
      }
    },
    {
      name: Method.GetMany,

      pre: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh, keys }) => {
        await josh.getMany(keys);
      }
    },
    {
      name: Method.Math,

      pre: async ({ josh, card }) => {
        await josh.set(card.id, card);
      },

      run: async ({ josh, card }) => {
        await josh.math(`${card.id}.net`, MathOperator.Addition, 1);
      }
    },
    {
      name: Method.Random,

      pre: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.random();
      }
    },
    {
      name: `${Method.Random}(!Duplicates)`,

      pre: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.random({ duplicates: false });
      }
    },
    {
      name: Method.RandomKey,

      pre: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.randomKey();
      }
    },
    {
      name: `${Method.RandomKey}(!Duplicates)`,

      pre: async ({ josh, entries }) => {
        await josh.setMany(entries);
      },

      run: async ({ josh }) => {
        await josh.randomKey({ duplicates: false });
      }
    },
    {
      name: Method.Set,

      run: async ({ josh, card }) => {
        await josh.set(card.id, card);
      }
    },
    {
      name: Method.SetMany,

      run: async ({ josh, entries }) => {
        await josh.setMany(entries);
      }
    }
  ];
}

export namespace Benchmark {
  export interface Test {
    name: string;

    pre?: (options: TestRunOptions) => Awaitable<void>;

    run(options: TestRunOptions): Awaitable<void>;

    post?: (options: TestRunOptions) => Awaitable<void>;
  }

  export interface TestRunOptions {
    josh: Josh<TestCard>;

    card: TestCard;

    keys: string[];

    values: TestCard[];

    entries: [string, TestCard][];
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
