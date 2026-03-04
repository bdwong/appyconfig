const { describe, it } = require('test');
const assert = require('node:assert/strict');
const { DefaultValueLoader } = require('../index');

describe('DefaultValueLoader', () => {
  it('has mapKey set to "default"', () => {
    const loader = new DefaultValueLoader();
    assert.equal(loader.mapKey, 'default');
  });

  it('mapValue returns cfg', () => {
    const loader = new DefaultValueLoader();
    assert.equal(loader.mapValue('hello', 'old'), 'hello');
  });

  it('resolves flat config tree', () => {
    const loader = new DefaultValueLoader();
    const result = loader.loadValues({
      key1: { default: 'value1' },
      key2: { default: 'value2' }
    }, {});
    assert.deepEqual(result, { key1: 'value1', key2: 'value2' });
  });

  it('resolves nested config tree', () => {
    const loader = new DefaultValueLoader();
    const result = loader.loadValues({
      parent: {
        child: { default: 'nested_val' }
      }
    }, {});
    assert.deepEqual(result, { parent: { child: 'nested_val' } });
  });

  it('handles null default values', () => {
    const loader = new DefaultValueLoader();
    const result = loader.loadValues({ key: { default: null } }, {});
    assert.deepEqual(result, { key: null });
  });

  it('handles array-wrapped object defaults', () => {
    const loader = new DefaultValueLoader();
    const result = loader.loadValues({ key: { default: [{ a: 1 }] } }, {});
    assert.deepEqual(result, { key: { a: 1 } });
  });

  it('ignores other mapping keys', () => {
    const loader = new DefaultValueLoader();
    const result = loader.loadValues({
      key: { default: 'val', env: 'SOME_VAR', cmdArg: 'opt' }
    }, {});
    assert.deepEqual(result, { key: 'val' });
  });

  it('overlays onto existing valueTree', () => {
    const loader = new DefaultValueLoader();
    const existing = { existing: 'keep' };
    const result = loader.loadValues({ key: { default: 'new' } }, existing);
    assert.deepEqual(result, { existing: 'keep', key: 'new' });
  });
});
