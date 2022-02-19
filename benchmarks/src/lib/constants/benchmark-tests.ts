import { MathOperator, Method } from '@joshdb/core';
import type { Benchmark } from '../Benchmark';

export const BENCHMARK_TESTS: Benchmark.Test[] = [
  {
    name: Method.AutoKey,

    run: async ({ josh }) => {
      await josh.autoKey();
    }
  },
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
    name: Method.Dec,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh, card }) => {
      await josh.dec(`${card.id}.net`);
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
    name: `${Method.Ensure} (${Method.Get})`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh, card }) => {
      await josh.ensure(card.id, card);
    }
  },
  {
    name: `${Method.Ensure} (${Method.Set})`,

    run: async ({ josh, card }) => {
      await josh.ensure(card.id, card);
    }
  },
  {
    name: `${Method.Every} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.every('net', '0');
    }
  },
  {
    name: `${Method.Every} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.every((card) => card.net === 0);
    }
  },
  {
    name: `${Method.Filter} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.filter('net', '0');
    }
  },
  {
    name: `${Method.Filter} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.filter((card) => card.net === 0);
    }
  },
  {
    name: `${Method.Find} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.find('net', '0');
    }
  },
  {
    name: `${Method.Find} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.find((card) => card.net === 0);
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
    name: Method.Has,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh, card }) => {
      await josh.has(card.id);
    }
  },
  {
    name: Method.Inc,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh, card }) => {
      await josh.inc(`${card.id}.net`);
    }
  },
  {
    name: Method.Keys,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.keys();
    }
  },
  {
    name: `${Method.Map} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.map('net');
    }
  },
  {
    name: `${Method.Map} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.map((card) => card.net);
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
    name: `${Method.Partition} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.partition('net', 0);
    }
  },
  {
    name: `${Method.Partition} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.partition((card) => card.net === 0);
    }
  },
  {
    name: Method.Push,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh, card }) => {
      await josh.push(`${card.id}.ids`, card.id);
    }
  },
  {
    name: `${Method.Random} (Duplicates)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.random();
    }
  },
  {
    name: Method.Random,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.random({ duplicates: false });
    }
  },
  {
    name: `${Method.RandomKey} (Duplicates)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.randomKey();
    }
  },
  {
    name: Method.RandomKey,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.randomKey({ duplicates: false });
    }
  },
  {
    name: Method.Remove,

    beforeAll: async ({ josh, entries, keys }) => {
      await josh.setMany(entries.map(([id, card]) => [id, { ...card, ids: keys }]));
    },

    run: async ({ josh, card }) => {
      await josh.remove(`${card.id}.ids`, card.id);
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
  },
  {
    name: Method.Size,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },
    run: async ({ josh }) => {
      await josh.size();
    }
  },
  {
    name: `${Method.Some} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.some('net', 0);
    }
  },
  {
    name: `${Method.Some} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.some((card) => card.net === 0);
    }
  },
  {
    name: Method.Update,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh, card }) => {
      await josh.update(card.id, (card) => ({ ...card, net: card.net + 1 }));
    }
  },
  {
    name: Method.Values,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany(entries);
    },

    run: async ({ josh }) => {
      await josh.values();
    }
  }
];
