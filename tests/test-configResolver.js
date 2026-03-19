const { mock, describe, it, beforeEach } = require('test');
const assert = require('node:assert/strict');
const appy = require('../index');
const { ValueLoader } = require('../lib/valueLoader.js');

describe('ConfigResolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new appy.ConfigResolver();
  });

  describe('resolveConfig', () => {
    it('returns empty object for empty config tree', () => {
      const result = resolver.resolveConfig({});
      assert.deepEqual(result, {});
    });

    it('accepts a single loader (not array)', () => {
      const result = resolver.resolveConfig(
        { key: { default: 'val' } },
        new appy.DefaultValueLoader()
      );
      assert.deepEqual(result, { key: 'val' });
    });

    it('accepts an array of loaders', () => {
      const result = resolver.resolveConfig(
        { key: { default: 'val' } },
        [new appy.DefaultValueLoader()]
      );
      assert.deepEqual(result, { key: 'val' });
    });

    it('throws when loader is not a ValueLoader instance', () => {
      assert.throws(
        () => resolver.resolveConfig({ key: { default: 'val' } }, [{}]),
        /Mapping is not a ValueLoader instance/
      );
    });

    it('later loaders override earlier loaders', () => {
      const savedEnv = process.env.APPY_RESOLVER_TEST;
      process.env.APPY_RESOLVER_TEST = 'from_env';
      try {
        const result = resolver.resolveConfig(
          { key: { default: 'from_default', env: 'APPY_RESOLVER_TEST' } },
          [new appy.DefaultValueLoader(), new appy.EnvLoader()]
        );
        assert.equal(result.key, 'from_env');
      } finally {
        if (savedEnv === undefined) delete process.env.APPY_RESOLVER_TEST;
        else process.env.APPY_RESOLVER_TEST = savedEnv;
      }
    });

    it('uses default mapping when omitted', () => {
      const savedEnv = process.env.APPY_RESOLVER_DEFAULT;
      delete process.env.APPY_RESOLVER_DEFAULT;
      try {
        const result = resolver.resolveConfig({
          key: { default: 'def_val', env: 'APPY_RESOLVER_DEFAULT' }
        });
        assert.equal(result.key, 'def_val');
      } finally {
        if (savedEnv !== undefined) process.env.APPY_RESOLVER_DEFAULT = savedEnv;
      }
    });

    it('stores configTree on instance', () => {
      const tree = { key: { default: 'val' } };
      resolver.resolveConfig(tree, new appy.DefaultValueLoader());
      assert.equal(resolver.configTree, tree);
    });

    it('stores valueTree on instance', () => {
      resolver.resolveConfig({ key: { default: 'val' } }, new appy.DefaultValueLoader());
      assert.deepEqual(resolver.valueTree, { key: 'val' });
    });

    it('stores resolveMaps on instance', () => {
      const loaders = [new appy.DefaultValueLoader()];
      resolver.resolveConfig({ key: { default: 'val' } }, loaders);
      assert.equal(resolver.resolveMaps, loaders);
    });
  });

  describe('_isOptions', () => {
    it('recognizes { prefix: "X_" } as options', () => {
      assert.equal(resolver._isOptions({ prefix: 'X_' }), true);
    });

    it('returns false for empty object (backward compat as configTree)', () => {
      assert.equal(resolver._isOptions({}), false);
    });

    it('returns false when unknown keys are present', () => {
      assert.equal(resolver._isOptions({ prefix: 'X_', unknown: 1 }), false);
    });

    it('returns false for null', () => {
      assert.equal(resolver._isOptions(null), false);
    });

    it('returns false for undefined', () => {
      assert.equal(resolver._isOptions(undefined), false);
    });

    it('returns false for arrays', () => {
      assert.equal(resolver._isOptions([]), false);
    });

    it('returns false for ValueLoader instances', () => {
      assert.equal(resolver._isOptions(new appy.DefaultValueLoader()), false);
    });
  });

  describe('resolveCommander', () => {
    const cmdOpts = { opt1: 'optvalue1', opt2: 'optvalue2', optFalse: false };

    it('registers a preAction hook', () => {
      const r = new appy.ConfigResolver();
      r.resolveConfig({ key: { default: 'v', cmdArg: 'opt1' } },
        [new appy.DefaultValueLoader(), new appy.CmdArgsLoader()]);
      const hookMock = { hook: mock.fn(() => {}) };
      r.resolveCommander(hookMock);
      assert.equal(hookMock.hook.mock.calls.length, 1);
      assert.equal(hookMock.hook.mock.calls[0].arguments[0], 'preAction');
    });

    it('throws when called before resolveConfig', () => {
      const r = new appy.ConfigResolver();
      let callback;
      const hookMock = {
        hook: mock.fn((_event, cb) => { callback = cb; })
      };
      r.resolveCommander(hookMock);
      assert.throws(
        () => callback(hookMock, hookMock),
        /resolveCommander.. was called before resolveConfig../
      );
    });

    it('throws when CmdArgsLoader not in resolveMaps', () => {
      const r = new appy.ConfigResolver();
      let callback;
      const hookMock = {
        hook: mock.fn((_event, cb) => { callback = cb; })
      };
      r.resolveConfig({ key: { default: 'v' } }, [new appy.DefaultValueLoader()]);
      r.resolveCommander(hookMock);
      assert.throws(
        () => callback(hookMock, hookMock),
        /cmdArgsLoader was not found/
      );
    });

    it('resolves subcommand values into valueTree', () => {
      const r = new appy.ConfigResolver();
      let callback;
      const subcommandMock = {
        hook: mock.fn((_event, cb) => { callback = cb; }),
        args: (name) => cmdOpts[name],
        opts: (name) => cmdOpts[name]
      };
      r.resolveConfig(
        { key1: { default: 'def', cmdArg: 'opt1' }, key2: { default: true, cmdArg: 'optFalse' } },
        [new appy.DefaultValueLoader(), new appy.CmdArgsLoader()]
      );
      r.resolveCommander(subcommandMock);
      callback(subcommandMock, subcommandMock);
      assert.equal(r.valueTree.key1, 'optvalue1');
      assert.equal(r.valueTree.key2, false);
    });

    it('resolves program-level values into valueTree', () => {
      const r = new appy.ConfigResolver();
      let callback;
      const programMock = {
        hook: mock.fn((_event, cb) => { callback = cb; }),
        args: [],
        opts: (_name) => cmdOpts
      };
      r.resolveConfig(
        { key1: { default: 'def', cmdArg: 'opt1' }, key2: { default: true, cmdArg: 'optFalse' } },
        [new appy.DefaultValueLoader(), new appy.CmdArgsLoader()]
      );
      r.resolveCommander(programMock);
      callback(programMock, programMock);
      assert.equal(r.valueTree.key1, 'optvalue1');
      assert.equal(r.valueTree.key2, false);
    });
  });

  describe('global convenience functions', () => {
    it('resolveConfig is exported and callable', () => {
      assert.equal(typeof appy.resolveConfig, 'function');
      const result = appy.resolveConfig({});
      assert.deepEqual(result, {});
    });

    it('resolveCommander is exported and callable', () => {
      assert.equal(typeof appy.resolveCommander, 'function');
    });
  });
});
