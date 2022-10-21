import { MathOperator, Method, Payload } from '@joshdb/provider';
import type { Benchmark } from '../Benchmark';

export const BENCHMARK_TESTS: Benchmark.Test[] = [
  {
    name: Method.AutoKey,

    run: async ({ provider }) => {
      await provider[Method.AutoKey]({ method: Method.AutoKey, errors: [] });
    }
  },
  {
    name: Method.Clear,

    beforeEach: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Clear]({ method: Method.Clear, errors: [] });
    }
  },
  {
    name: Method.Dec,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Dec]({ key: card.id, path: ['net'], errors: [], method: Method.Dec });
    }
  },
  {
    name: Method.Delete,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Delete]({ method: Method.Delete, key: card.id, path: [], errors: [] });
    }
  },
  {
    name: Method.DeleteMany,

    beforeEach: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, keys }) => {
      await provider[Method.DeleteMany]({ keys, method: Method.DeleteMany, errors: [] });
    }
  },
  {
    name: `${Method.Ensure} (${Method.Get})`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Ensure]({ method: Method.Ensure, key: card.id, defaultValue: card, errors: [] });
    }
  },
  {
    name: `${Method.Ensure} (${Method.Set})`,

    run: async ({ provider, card }) => {
      await provider[Method.Ensure]({ method: Method.Ensure, key: card.id, defaultValue: card, errors: [] });
    }
  },
  {
    name: Method.Entries,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Entries]({ method: Method.Entries, errors: [] });
    }
  },
  {
    name: `${Method.Every} (Path)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Every]({ method: Method.Every, path: ['net'], value: '0', type: Payload.Type.Value, errors: [] });
    }
  },
  {
    name: `${Method.Every} (Function)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Every]({
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

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Filter]({ method: Method.Filter, errors: [], path: ['net'], type: Payload.Type.Value, value: '0' });
    }
  },
  {
    name: `${Method.Filter} (Function)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Filter]({ method: Method.Filter, errors: [], type: Payload.Type.Hook, hook: (card) => card.net === 0 });
    }
  },
  {
    name: `${Method.Find} (Path)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Find]({ method: Method.Find, errors: [], path: ['net'], type: Payload.Type.Value, value: '0' });
    }
  },
  {
    name: `${Method.Find} (Function)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Find]({ method: Method.Find, errors: [], path: ['net'], type: Payload.Type.Hook, hook: (card) => card.net === 0 });
    }
  },
  {
    name: Method.Get,

    beforeEach: async ({ provider, card }) => {
      await provider[Method.Set]({ method: Method.Set, errors: [], path: [], key: card.id, value: card });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Get]({ method: Method.Get, errors: [], path: [], key: card.id });
    }
  },
  {
    name: Method.GetMany,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, keys }) => {
      await provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys });
    }
  },
  {
    name: Method.Has,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Has]({ method: Method.Has, errors: [], path: [], key: card.id });
    }
  },
  {
    name: Method.Inc,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Inc]({ method: Method.Inc, errors: [], path: ['net'], key: card.id });
    }
  },
  {
    name: Method.Keys,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Keys]({ method: Method.Keys, errors: [] });
    }
  },
  {
    name: `${Method.Map} (Path)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Path, path: ['net'] });
    }
  },
  {
    name: `${Method.Map} (Function)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Hook, hook: (card) => card.net });
    }
  },
  {
    name: Method.Math,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Math]({ method: Method.Math, errors: [], path: ['net'], key: card.id, operand: 1, operator: MathOperator.Addition });
    }
  },
  {
    name: `${Method.Partition} (Path)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Partition]({ method: Method.Partition, errors: [], path: ['net'], type: Payload.Type.Value, value: 0 });
    }
  },
  {
    name: `${Method.Partition} (Function)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Partition]({
        method: Method.Partition,
        errors: [],
        path: ['net'],
        type: Payload.Type.Hook,
        hook: (card) => card.net === 0
      });
    }
  },
  {
    name: Method.Push,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Push]({ method: Method.Push, errors: [], path: ['net'], key: card.id, value: card.id });
    }
  },
  {
    name: `${Method.Random} (Duplicates)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Random]({ method: Method.Random, errors: [], count: 5, duplicates: true });
    }
  },
  {
    name: Method.Random,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Random]({ method: Method.Random, errors: [], count: 5, duplicates: false });
    }
  },
  {
    name: `${Method.RandomKey} (Duplicates)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.RandomKey]({ method: Method.RandomKey, errors: [], count: 5, duplicates: true });
    }
  },
  {
    name: Method.RandomKey,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.RandomKey]({ method: Method.RandomKey, errors: [], count: 5, duplicates: false });
    }
  },
  {
    name: Method.Remove,

    beforeAll: async ({ provider, entries, keys }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries: entries.map(({ key, value, path }) => {
          return { key, value: { ...value, ids: keys }, path };
        })
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Remove]({ method: Method.Remove, errors: [], path: ['ids'], key: card.id, type: Payload.Type.Value, value: card.id });
    }
  },
  {
    name: Method.Set,

    beforeAll: async ({ provider }) => {
      await provider[Method.Clear]({ method: Method.Clear, errors: [] });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Set]({ method: Method.Set, errors: [], path: [], key: card.id, value: card });
    }
  },
  {
    name: Method.SetMany,

    beforeAll: async ({ provider }) => {
      await provider[Method.Clear]({ method: Method.Clear, errors: [] });
    },

    run: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    }
  },
  {
    name: Method.Size,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },
    run: async ({ provider }) => {
      await provider[Method.Size]({ method: Method.Size, errors: [] });
    }
  },
  {
    name: `${Method.Some} (Path)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Some]({ method: Method.Some, errors: [], path: [], type: Payload.Type.Value, value: '0' });
    }
  },
  {
    name: `${Method.Some} (Function)`,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Some]({ method: Method.Some, errors: [], type: Payload.Type.Hook, hook: (card: Benchmark.TestCard) => card.net === 0 });
    }
  },
  {
    name: Method.Update,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider, card }) => {
      await provider[Method.Update]({ method: Method.Update, errors: [], key: card.id, hook: (card) => ({ ...card, net: card.net + 1 }) });
    }
  },
  {
    name: Method.Values,

    beforeAll: async ({ provider, entries }) => {
      await provider[Method.SetMany]({
        method: Method.SetMany,
        errors: [],
        overwrite: true,
        entries
      });
    },

    run: async ({ provider }) => {
      await provider[Method.Values]({ method: Method.Values, errors: [] });
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
