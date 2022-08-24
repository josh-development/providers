import { MathOperator, Method, Payload } from '@joshdb/provider';
import type { Benchmark } from '../Benchmark';

export const BENCHMARK_TESTS: Benchmark.Test[] = [
  {
    name: Method.AutoKey,

    run: async ({ josh }) => {
      await josh.autoKey({ method: Method.AutoKey, errors: [] });
    }
  },
  {
    name: Method.Clear,

    beforeEach: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.clear({ method: Method.Clear, errors: [] });
    }
  },
  {
    name: Method.Dec,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.dec({ key: card.id, path: ['net'], errors: [], method: Method.Dec });
    }
  },
  {
    name: Method.Delete,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.delete({ method: Method.Delete, key: card.id, path: [], errors: [] });
    }
  },
  {
    name: Method.DeleteMany,

    beforeEach: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, keys }) => {
      await josh.deleteMany({ keys, method: Method.DeleteMany, errors: [] });
    }
  },
  {
    name: `${Method.Ensure} (${Method.Get})`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.ensure({ method: Method.Ensure, key: card.id, defaultValue: card, errors: [] });
    }
  },
  {
    name: `${Method.Ensure} (${Method.Set})`,

    run: async ({ josh, card }) => {
      await josh.ensure({ method: Method.Ensure, key: card.id, defaultValue: card, errors: [] });
    }
  },
  {
    name: Method.Entries,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.entries({ method: Method.Entries, errors: [] });
    }
  },
  {
    name: `${Method.Every} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.every({ method: Method.Every, path: ['net'], value: '0', type: Payload.Type.Value, errors: [] });
    }
  },
  {
    name: `${Method.Every} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.every({
        method: Method.Every,
        value: '0',
        type: Payload.Type.Hook,
        hook: (card: Benchmark.TestCard) => card.net === 0,
        errors: []
      });
    }
  },
  {
    name: `${Method.Filter} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.filter({ method: Method.Filter, errors: [], path: ['net'], type: Payload.Type.Value, value: '0' });
    }
  },
  {
    name: `${Method.Filter} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.filter({ method: Method.Filter, errors: [], type: Payload.Type.Hook, hook: (card) => card.net === 0 });
    }
  },
  {
    name: `${Method.Find} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.find({ method: Method.Find, errors: [], path: ['net'], type: Payload.Type.Value, value: '0' });
    }
  },
  {
    name: `${Method.Find} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.find({ method: Method.Find, errors: [], path: ['net'], type: Payload.Type.Hook, hook: (card) => card.net === 0 });
    }
  },
  {
    name: Method.Get,

    beforeEach: async ({ josh, card }) => {
      await josh.set({ method: Method.Set, errors: [], path: [], key: card.id, value: card });
    },

    run: async ({ josh, card }) => {
      await josh.get({ method: Method.Get, errors: [], path: [], key: card.id });
    }
  },
  {
    name: Method.GetMany,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, keys }) => {
      await josh.getMany({ method: Method.GetMany, errors: [], keys });
    }
  },
  {
    name: Method.Has,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.has({ method: Method.Has, errors: [], path: [], key: card.id });
    }
  },
  {
    name: Method.Inc,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.inc({ method: Method.Inc, errors: [], path: ['net'], key: card.id });
    }
  },
  {
    name: Method.Keys,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.keys({ method: Method.Keys, errors: [] });
    }
  },
  {
    name: `${Method.Map} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.map({ method: Method.Map, errors: [], type: Payload.Type.Path, path: ['net'] });
    }
  },
  {
    name: `${Method.Map} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.map({ method: Method.Map, errors: [], type: Payload.Type.Hook, hook: (card) => card.net });
    }
  },
  {
    name: Method.Math,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.math({ method: Method.Math, errors: [], path: ['net'], key: card.id, operand: 1, operator: MathOperator.Addition });
    }
  },
  {
    name: `${Method.Partition} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.partition({ method: Method.Partition, errors: [], path: ['net'], type: Payload.Type.Value, value: 0 });
    }
  },
  {
    name: `${Method.Partition} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.partition({ method: Method.Partition, errors: [], path: ['net'], type: Payload.Type.Hook, hook: (card) => card.net === 0 });
    }
  },
  {
    name: Method.Push,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.push({ method: Method.Push, errors: [], path: ['net'], key: card.id, value: card.id });
    }
  },
  {
    name: `${Method.Random} (Duplicates)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.random({ method: Method.Random, errors: [], count: 5, duplicates: true });
    }
  },
  {
    name: Method.Random,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.random({ method: Method.Random, errors: [], count: 5, duplicates: false });
    }
  },
  {
    name: `${Method.RandomKey} (Duplicates)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.randomKey({ method: Method.RandomKey, errors: [], count: 5, duplicates: true });
    }
  },
  {
    name: Method.RandomKey,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.randomKey({ method: Method.RandomKey, errors: [], count: 5, duplicates: false });
    }
  },
  {
    name: Method.Remove,

    beforeAll: async ({ josh, entries, keys }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value: { ...value, ids: keys }, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.remove({ method: Method.Remove, errors: [], path: ['ids'], key: card.id, type: Payload.Type.Value, value: card.id });
    }
  },
  {
    name: Method.Set,

    beforeAll: async ({ josh }) => {
      await josh.clear({ method: Method.Clear, errors: [] });
    },

    run: async ({ josh, card }) => {
      await josh.set({ method: Method.Set, errors: [], path: [], key: card.id, value: card });
    }
  },
  {
    name: Method.SetMany,

    beforeAll: async ({ josh }) => {
      await josh.clear({ method: Method.Clear, errors: [] });
    },

    run: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    }
  },
  {
    name: Method.Size,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },
    run: async ({ josh }) => {
      await josh.size({ method: Method.Size, errors: [] });
    }
  },
  {
    name: `${Method.Some} (Path)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.some({ method: Method.Some, errors: [], path: [], type: Payload.Type.Value, value: '0' });
    }
  },
  {
    name: `${Method.Some} (Function)`,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.some({ method: Method.Some, errors: [], type: Payload.Type.Hook, hook: (card: Benchmark.TestCard) => card.net === 0 });
    }
  },
  {
    name: Method.Update,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh, card }) => {
      await josh.update({ method: Method.Update, errors: [], key: card.id, hook: (card) => ({ ...card, net: card.net + 1 }) });
    }
  },
  {
    name: Method.Values,

    beforeAll: async ({ josh, entries }) => {
      await josh.setMany({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(([key, value]) => {
          return { key, value, path: [] };
        })
      });
    },

    run: async ({ josh }) => {
      await josh.values({ method: Method.Values, errors: [] });
    }
  }
];

export const BASIC_BENCHMARK_TESTS = BENCHMARK_TESTS.filter((test) =>
  [
    Method.Clear,
    Method.Delete,
    Method.DeleteMany,
    Method.Entries,
    Method.Get,
    Method.GetMany,
    Method.Math,
    Method.Random,
    Method.RandomKey,
    Method.Set,
    Method.SetMany
  ].includes(test.name.toLowerCase() as Method)
);
