const { describe, it, beforeEach, afterEach } = require('test');
const assert = require('node:assert/strict');
const { EnvLoader } = require('../index');

describe('EnvLoader', () => {
  const savedEnv = {};
  const testVars = ['APPY_UNIT_TEST1', 'APPY_UNIT_TEST2', 'APPY_UNIT_TEST3'];

  beforeEach(() => {
    testVars.forEach(v => {
      savedEnv[v] = process.env[v];
      delete process.env[v];
    });
  });

  afterEach(() => {
    testVars.forEach(v => {
      if (savedEnv[v] === undefined) {
        delete process.env[v];
      } else {
        process.env[v] = savedEnv[v];
      }
    });
  });

  it('has mapKey set to "env"', () => {
    const loader = new EnvLoader();
    assert.equal(loader.mapKey, 'env');
  });

  it('reads process.env[cfg] when env var exists', () => {
    process.env.APPY_UNIT_TEST1 = 'found';
    const loader = new EnvLoader();
    assert.equal(loader.mapValue('APPY_UNIT_TEST1', 'fallback'), 'found');
  });

  it('returns fallback when env var is missing', () => {
    const loader = new EnvLoader();
    assert.equal(loader.mapValue('APPY_UNIT_TEST1', 'fallback'), 'fallback');
  });

  it('resolves flat config tree from env vars', () => {
    process.env.APPY_UNIT_TEST1 = 'val1';
    process.env.APPY_UNIT_TEST2 = 'val2';
    const loader = new EnvLoader();
    const result = loader.loadValues({
      a: { env: 'APPY_UNIT_TEST1' },
      b: { env: 'APPY_UNIT_TEST2' }
    }, {});
    assert.deepEqual(result, { a: 'val1', b: 'val2' });
  });

  it('resolves nested config tree from env vars', () => {
    process.env.APPY_UNIT_TEST1 = 'nested_val';
    const loader = new EnvLoader();
    const result = loader.loadValues({
      parent: {
        child: { env: 'APPY_UNIT_TEST1' }
      }
    }, {});
    assert.deepEqual(result, { parent: { child: 'nested_val' } });
  });

  it('env values are always strings', () => {
    process.env.APPY_UNIT_TEST1 = '42';
    const loader = new EnvLoader();
    const result = loader.mapValue('APPY_UNIT_TEST1', null);
    assert.equal(typeof result, 'string');
    assert.equal(result, '42');
  });

  it('preserves existing value when env var not set', () => {
    const loader = new EnvLoader();
    const result = loader.loadValues({
      a: { env: 'APPY_UNIT_TEST1' }
    }, { a: 'original' });
    assert.deepEqual(result, { a: 'original' });
  });
});
