import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDotenv } from '../src/parser/dotenv.js';

describe('dotenv parser', () => {
  it('parses basic key=value pairs', () => {
    const result = parseDotenv('FOO=bar\nBAZ=qux');
    assert.deepStrictEqual(result, { FOO: 'bar', BAZ: 'qux' });
  });

  it('skips comments', () => {
    const result = parseDotenv('# comment\nFOO=bar\n# another comment');
    assert.deepStrictEqual(result, { FOO: 'bar' });
  });

  it('skips blank lines', () => {
    const result = parseDotenv('FOO=bar\n\n\nBAZ=qux\n');
    assert.deepStrictEqual(result, { FOO: 'bar', BAZ: 'qux' });
  });

  it('strips double quotes from values', () => {
    const result = parseDotenv('FOO="bar baz"');
    assert.deepStrictEqual(result, { FOO: 'bar baz' });
  });

  it('strips single quotes from values', () => {
    const result = parseDotenv("FOO='bar baz'");
    assert.deepStrictEqual(result, { FOO: 'bar baz' });
  });

  it('handles values containing equals signs', () => {
    const result = parseDotenv('URL=postgres://host/db?ssl=true');
    assert.deepStrictEqual(result, { URL: 'postgres://host/db?ssl=true' });
  });

  it('handles empty values', () => {
    const result = parseDotenv('FOO=');
    assert.deepStrictEqual(result, { FOO: '' });
  });

  it('trims whitespace around keys and values', () => {
    const result = parseDotenv('  FOO  =  bar  ');
    assert.deepStrictEqual(result, { FOO: 'bar' });
  });

  it('skips lines without equals sign', () => {
    const result = parseDotenv('invalid line\nFOO=bar');
    assert.deepStrictEqual(result, { FOO: 'bar' });
  });

  it('handles empty input', () => {
    assert.deepStrictEqual(parseDotenv(''), {});
  });

  it('handles quoted empty values', () => {
    const result = parseDotenv('FOO=""');
    assert.deepStrictEqual(result, { FOO: '' });
  });
});
