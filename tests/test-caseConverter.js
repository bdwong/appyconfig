const { describe, it } = require('test');
const assert = require('node:assert/strict');
const {
  splitKey, toCamelCase, toSnakeCase, toKebabCase,
  toPascalCase, toConstantCase, toFlatCase,
  convertKeys, CASE_CONVERTERS,
} = require('../index');

describe('caseConverter', () => {
  describe('splitKey', () => {
    it('splits on underscores', () => {
      assert.deepEqual(splitKey('foo_bar_baz'), ['foo', 'bar', 'baz']);
    });

    it('splits on hyphens', () => {
      assert.deepEqual(splitKey('foo-bar-baz'), ['foo', 'bar', 'baz']);
    });

    it('splits on camelCase boundaries', () => {
      assert.deepEqual(splitKey('fooBarBaz'), ['foo', 'bar', 'baz']);
    });

    it('splits on PascalCase boundaries', () => {
      assert.deepEqual(splitKey('FooBarBaz'), ['foo', 'bar', 'baz']);
    });

    it('handles consecutive uppercase (acronyms)', () => {
      assert.deepEqual(splitKey('parseHTTPResponse'), ['parse', 'http', 'response']);
    });

    it('handles CONSTANT_CASE', () => {
      assert.deepEqual(splitKey('MY_API_KEY'), ['my', 'api', 'key']);
    });

    it('returns empty array for empty string', () => {
      assert.deepEqual(splitKey(''), []);
    });

    it('returns empty array for null/undefined', () => {
      assert.deepEqual(splitKey(null), []);
      assert.deepEqual(splitKey(undefined), []);
    });

    it('handles single word', () => {
      assert.deepEqual(splitKey('foo'), ['foo']);
    });

    it('handles mixed delimiters', () => {
      assert.deepEqual(splitKey('foo_bar-baz'), ['foo', 'bar', 'baz']);
    });
  });

  describe('toCamelCase', () => {
    it('converts snake_case', () => {
      assert.equal(toCamelCase('foo_bar'), 'fooBar');
    });

    it('converts kebab-case', () => {
      assert.equal(toCamelCase('foo-bar'), 'fooBar');
    });

    it('converts CONSTANT_CASE', () => {
      assert.equal(toCamelCase('FOO_BAR'), 'fooBar');
    });

    it('preserves already camelCase', () => {
      assert.equal(toCamelCase('fooBar'), 'fooBar');
    });

    it('converts PascalCase', () => {
      assert.equal(toCamelCase('FooBar'), 'fooBar');
    });
  });

  describe('toSnakeCase', () => {
    it('converts camelCase', () => {
      assert.equal(toSnakeCase('fooBar'), 'foo_bar');
    });

    it('converts CONSTANT_CASE', () => {
      assert.equal(toSnakeCase('FOO_BAR'), 'foo_bar');
    });
  });

  describe('toKebabCase', () => {
    it('converts camelCase', () => {
      assert.equal(toKebabCase('fooBar'), 'foo-bar');
    });

    it('converts snake_case', () => {
      assert.equal(toKebabCase('foo_bar'), 'foo-bar');
    });
  });

  describe('toPascalCase', () => {
    it('converts camelCase', () => {
      assert.equal(toPascalCase('fooBar'), 'FooBar');
    });

    it('converts snake_case', () => {
      assert.equal(toPascalCase('foo_bar'), 'FooBar');
    });
  });

  describe('toConstantCase', () => {
    it('converts camelCase', () => {
      assert.equal(toConstantCase('fooBar'), 'FOO_BAR');
    });

    it('converts kebab-case', () => {
      assert.equal(toConstantCase('foo-bar'), 'FOO_BAR');
    });
  });

  describe('toFlatCase', () => {
    it('converts camelCase', () => {
      assert.equal(toFlatCase('fooBar'), 'foobar');
    });

    it('converts snake_case', () => {
      assert.equal(toFlatCase('foo_bar'), 'foobar');
    });
  });

  describe('CASE_CONVERTERS', () => {
    it('has all expected keys', () => {
      assert.deepEqual(Object.keys(CASE_CONVERTERS).sort(), [
        'CONSTANT_CASE', 'PascalCase', 'camelCase', 'flatcase', 'kebab-case', 'snake_case'
      ]);
    });

    it('each value is a function', () => {
      for (const fn of Object.values(CASE_CONVERTERS)) {
        assert.equal(typeof fn, 'function');
      }
    });
  });

  describe('convertKeys', () => {
    it('converts flat object keys', () => {
      const result = convertKeys({ foo_bar: 1, baz_qux: 2 }, toCamelCase);
      assert.deepEqual(result, { fooBar: 1, bazQux: 2 });
    });

    it('converts nested object keys', () => {
      const result = convertKeys({
        my_key: { nested_key: 'val' }
      }, toCamelCase);
      assert.deepEqual(result, { myKey: { nestedKey: 'val' } });
    });

    it('preserves array values', () => {
      const result = convertKeys({ my_list: [1, 2, 3] }, toCamelCase);
      assert.deepEqual(result, { myList: [1, 2, 3] });
    });

    it('returns primitives unchanged', () => {
      assert.equal(convertKeys(null, toCamelCase), null);
      assert.equal(convertKeys('string', toCamelCase), 'string');
      assert.equal(convertKeys(42, toCamelCase), 42);
    });

    it('handles deeply nested objects', () => {
      const result = convertKeys({
        level_one: { level_two: { level_three: 'deep' } }
      }, toCamelCase);
      assert.deepEqual(result, {
        levelOne: { levelTwo: { levelThree: 'deep' } }
      });
    });
  });
});
