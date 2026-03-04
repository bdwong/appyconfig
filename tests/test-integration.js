const { mock, describe, it, beforeEach, afterEach } = require('test');
const assert = require('node:assert/strict');
const path = require('path');
const appy = require('../index');

describe('Integration', () => {
  const savedEnv = {};
  const testVars = ['APPY_INT_TEST1', 'APPY_INT_TEST2', 'APPY_INT_TEST3'];

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

  it('default + env: env overrides default, default persists where no env', () => {
    process.env.APPY_INT_TEST1 = 'from_env';
    const resolver = new appy.ConfigResolver();
    const result = resolver.resolveConfig({
      key1: { default: 'def1', env: 'APPY_INT_TEST1' },
      key2: { default: 'def2', env: 'APPY_INT_TEST2' }
    }, [new appy.DefaultValueLoader(), new appy.EnvLoader()]);
    assert.equal(result.key1, 'from_env');
    assert.equal(result.key2, 'def2');
  });

  it('default + JSON: JSON file overrides defaults', () => {
    const resolver = new appy.ConfigResolver();
    const result = resolver.resolveConfig({
      key2: { default: 'will_be_overridden' }
    }, [
      new appy.DefaultValueLoader(),
      new appy.JsonLoader(path.join(__dirname, 'testconfig.json'))
    ]);
    assert.equal(result.key2, 'value2');
  });

  it('default + YAML: YAML file overrides defaults', () => {
    const resolver = new appy.ConfigResolver();
    const result = resolver.resolveConfig({
      key2: { default: 'will_be_overridden' }
    }, [
      new appy.DefaultValueLoader(),
      new appy.YamlLoader(path.join(__dirname, 'test.yaml'))
    ]);
    assert.equal(result.key2, 'value2');
  });

  it('default + dotenv: dotenv overrides defaults', () => {
    const resolver = new appy.ConfigResolver();
    const result = resolver.resolveConfig({
      mykey: { default: 'will_be_overridden', dotenv: 'TEST_ENVKEY' }
    }, [
      new appy.DefaultValueLoader(),
      new appy.DotenvLoader(path.join(__dirname, 'test.env'))
    ]);
    assert.equal(result.mykey, 'myenv value');
  });

  it('default + env + cmdArg: full 3-loader chain with commander hook', () => {
    process.env.APPY_INT_TEST1 = 'from_env';
    const cmdOpts = { opt1: 'from_cmd' };
    let callback;
    const subcommandMock = {
      hook: mock.fn((_event, cb) => { callback = cb; }),
      args: (name) => cmdOpts[name],
      opts: (name) => cmdOpts[name]
    };

    const resolver = new appy.ConfigResolver();
    const result = resolver.resolveConfig({
      key1: { default: 'def1', env: 'APPY_INT_TEST1', cmdArg: 'opt1' },
      key2: { default: 'def2', env: 'APPY_INT_TEST2', cmdArg: 'nonexistent' }
    }, [new appy.DefaultValueLoader(), new appy.EnvLoader(), new appy.CmdArgsLoader()]);

    assert.equal(result.key1, 'from_env');
    assert.equal(result.key2, 'def2');

    resolver.resolveCommander(subcommandMock);
    callback(subcommandMock, subcommandMock);

    assert.equal(resolver.valueTree.key1, 'from_cmd');
    assert.equal(resolver.valueTree.key2, 'def2');
  });

  it('overlay: two config trees merged via valueTree parameter', () => {
    const resolver = new appy.ConfigResolver();
    const first = resolver.resolveConfig(
      { key1: { default: 'val1' } },
      new appy.DefaultValueLoader()
    );
    const second = resolver.resolveConfig(
      { key2: { default: 'val2' } },
      new appy.DefaultValueLoader(),
      first
    );
    assert.deepEqual(second, { key1: 'val1', key2: 'val2' });
  });

  it('deep nesting: 3+ levels through multiple loaders', () => {
    process.env.APPY_INT_TEST1 = 'deep_env';
    const resolver = new appy.ConfigResolver();
    const result = resolver.resolveConfig({
      l1: {
        l2: {
          l3: {
            default: 'deep_default',
            env: 'APPY_INT_TEST1'
          }
        }
      }
    }, [new appy.DefaultValueLoader(), new appy.EnvLoader()]);
    assert.equal(result.l1.l2.l3, 'deep_env');
  });

  it('exports: all classes are exported', () => {
    assert.equal(typeof appy.ConfigResolver, 'function');
    assert.equal(typeof appy.DefaultValueLoader, 'function');
    assert.equal(typeof appy.CmdArgsLoader, 'function');
    assert.equal(typeof appy.EnvLoader, 'function');
    assert.equal(typeof appy.NullLoader, 'function');
    assert.equal(typeof appy.JsonLoader, 'function');
    assert.equal(typeof appy.DotenvLoader, 'function');
    assert.equal(typeof appy.YamlLoader, 'function');
    assert.equal(typeof appy.ValidationLoader, 'function');
  });

  it('exports: type sentinels are exported', () => {
    assert.notEqual(appy.stringType, undefined);
    assert.notEqual(appy.booleanType, undefined);
    assert.notEqual(appy.intType, undefined);
  });

  it('exports: convenience functions are exported', () => {
    assert.equal(typeof appy.resolveConfig, 'function');
    assert.equal(typeof appy.resolveCommander, 'function');
  });
});
