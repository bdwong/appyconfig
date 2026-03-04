const { describe, it } = require('test');
const assert = require('node:assert/strict');
const { NullLoader } = require('../index');

describe('NullLoader', () => {
  it('mapValue always returns null', () => {
    const loader = new NullLoader();
    assert.equal(loader.mapValue('anything', 'value'), null);
    assert.equal(loader.mapValue(42, 'value'), null);
    assert.equal(loader.mapValue(undefined, undefined), null);
  });

  it('resolves flat config tree to null values', () => {
    const loader = new NullLoader();
    const result = loader.loadValues({ key1: { default: 'a' }, key2: { default: 'b' } }, {});
    assert.deepEqual(result, { key1: null, key2: null });
  });

  it('resolves nested config tree to null values', () => {
    const loader = new NullLoader();
    const result = loader.loadValues({
      top: {
        nested: { default: 'val' }
      }
    }, {});
    assert.deepEqual(result, { top: { nested: null } });
  });

  it('returns null for empty config tree', () => {
    const loader = new NullLoader();
    const result = loader.loadValues({}, {});
    assert.equal(result, null);
  });
});
