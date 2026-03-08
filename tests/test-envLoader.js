const { describe, it, beforeEach, afterEach, mock } = require('test');
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

  describe('expand option', () => {
    const expandVars = ['APP_DATABASE__HOST', 'APP_DATABASE__PORT', 'APP_A__B__C', 'APP_FLAT'];

    beforeEach(() => {
      expandVars.forEach(v => { savedEnv[v] = process.env[v]; delete process.env[v]; });
    });

    afterEach(() => {
      expandVars.forEach(v => {
        if (savedEnv[v] === undefined) delete process.env[v];
        else process.env[v] = savedEnv[v];
      });
    });

    it('expand defaults to true', () => {
      const loader = new EnvLoader();
      assert.equal(loader.expand, true);
    });

    it('__ in key creates nested object', () => {
      process.env.APP_DATABASE__HOST = 'myhost';
      const loader = new EnvLoader({ prefix: 'APP_', stripPrefix: true });
      const result = loader.loadAllValues({});
      assert.deepEqual(result.DATABASE, { HOST: 'myhost' });
    });

    it('multiple levels of nesting with __', () => {
      process.env.APP_A__B__C = 'deep';
      const loader = new EnvLoader({ prefix: 'APP_', stripPrefix: true });
      const result = loader.loadAllValues({});
      assert.deepEqual(result.A, { B: { C: 'deep' } });
    });

    it('keys without __ remain flat', () => {
      process.env.APP_FLAT = 'value';
      const loader = new EnvLoader({ prefix: 'APP_', stripPrefix: true });
      const result = loader.loadAllValues({});
      assert.equal(result.FLAT, 'value');
    });

    it('expand: false disables nesting', () => {
      process.env.APP_DATABASE__HOST = 'myhost';
      const loader = new EnvLoader({ prefix: 'APP_', stripPrefix: true, expand: false });
      const result = loader.loadAllValues({});
      assert.equal(result['DATABASE__HOST'], 'myhost');
      assert.equal(result.DATABASE, undefined);
    });

    it('works with prefix + stripPrefix', () => {
      process.env.APP_DATABASE__HOST = 'myhost';
      process.env.APP_DATABASE__PORT = '5432';
      const loader = new EnvLoader({ prefix: 'APP_', stripPrefix: true });
      const result = loader.loadAllValues({});
      assert.deepEqual(result.DATABASE, { HOST: 'myhost', PORT: '5432' });
    });

    it('A____B (four underscores) warns and is skipped', () => {
      process.env.APP_A____B = 'val';
      const warnMock = mock.method(console, 'warn', () => {});
      try {
        const loader = new EnvLoader({ prefix: 'APP_', stripPrefix: true });
        const result = loader.loadAllValues({});
        assert.equal(result.A, undefined);
        assert.equal(result['A____B'], undefined);
        assert.equal(warnMock.mock.callCount() > 0, true);
      } finally {
        warnMock.mock.restore();
        delete process.env.APP_A____B;
      }
    });

    it('leading __ warns and is skipped', () => {
      process.env.APP___X = 'val';
      const warnMock = mock.method(console, 'warn', () => {});
      try {
        const loader = new EnvLoader({ prefix: 'APP_', stripPrefix: true });
        const result = loader.loadAllValues({});
        assert.equal(result.X, undefined);
        assert.equal(result['__X'], undefined);
        assert.equal(warnMock.mock.callCount() > 0, true);
      } finally {
        warnMock.mock.restore();
        delete process.env.APP___X;
      }
    });

    it('trailing __ warns and is skipped', () => {
      process.env.APP_X__ = 'val';
      const warnMock = mock.method(console, 'warn', () => {});
      try {
        const loader = new EnvLoader({ prefix: 'APP_', stripPrefix: true });
        const result = loader.loadAllValues({});
        assert.equal(result.X, undefined);
        assert.equal(result['X__'], undefined);
        assert.equal(warnMock.mock.callCount() > 0, true);
      } finally {
        warnMock.mock.restore();
        delete process.env.APP_X__;
      }
    });
  });
});
