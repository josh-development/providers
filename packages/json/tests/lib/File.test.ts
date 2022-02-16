import { Serialize } from '@joshdb/serialize';
import { TwitterSnowflake } from '@sapphire/snowflake';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { File } from '../../src';

describe('File', () => {
  describe('is a class', () => {
    test('GIVEN typeof File THEN returns function', () => {
      expect(typeof File).toBe('function');
    });

    test('GIVEN typeof ...prototype THEN returns object', () => {
      expect(typeof File.prototype).toBe('object');
    });
  });

  describe('can manipulate file', () => {
    const firstId = TwitterSnowflake.generate().toString();
    const secondPath = resolve(process.cwd(), '.tests', 'file', `${TwitterSnowflake.generate().toString()}.json`);
    const file = new File({ directory: resolve(process.cwd(), '.tests', 'file'), name: `${firstId}.json` });

    beforeAll(async () => {
      await mkdir(file.options.directory, { recursive: true });
    });

    beforeEach(async () => {
      if (existsSync(file.path)) await rm(file.path);
      if (existsSync(secondPath)) await rm(secondPath);
    });

    describe('with read method', () => {
      test('GIVEN no file present THEN throws error', async () => {
        await expect(file.read()).rejects.toThrow('ENOENT');
      });

      test('GIVEN file present THEN returns parsed value', async () => {
        await writeFile(file.path, JSON.stringify(new Serialize({ raw: { key: 'value' } })));

        await expect(file.read()).resolves.toEqual({ key: 'value' });
      });
    });

    describe('with write method', () => {
      test('GIVEN no file present THEN writes file', async () => {
        await expect(file.write({ key: 'value' })).resolves.toBeUndefined();
      });
    });

    describe('with copy method', () => {
      test('GIVEN no file present THEN throws error', async () => {
        await expect(file.copy(secondPath)).rejects.toThrow();
      });

      test('GIVEN file present THEN copies file', async () => {
        await writeFile(file.path, JSON.stringify({ key: 'value' }));

        await expect(file.copy(secondPath)).resolves.toBeUndefined();
      });
    });

    describe('with rename method', () => {
      test('GIVEN no file present THEN throws error', async () => {
        await expect(file.rename(secondPath)).rejects.toThrow();
      });

      test('GIVEN file present THEN renames file', async () => {
        await writeFile(file.path, JSON.stringify({ key: 'value' }));

        await expect(file.rename(secondPath)).resolves.toBeUndefined();
      });
    });

    describe('with delete method', () => {
      test('GIVEN no file present THEN throws error', async () => {
        await expect(file.delete()).rejects.toThrow();
      });

      test('GIVEN file present THEN deletes file', async () => {
        await writeFile(file.path, JSON.stringify({ key: 'value' }));

        await expect(file.delete()).resolves.toBeUndefined();
      });
    });
  });
});
