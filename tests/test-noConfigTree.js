const { mock, describe, it, beforeEach, afterEach } = require('test');
const assert = require('node:assert/strict');
const path = require('path');
const appy = require('../index');

describe('No configTree usage', () => {
  describe('resolveConfig argument detection', () => {
    it('no args: uses default treeless mapping with APP_ prefix', () => {
      const saved = process.env.APP_TEST_DEFAULT;
      process.env.APP_TEST_DEFAULT = 'found';
      try {
        const resolver = new appy.ConfigResolver();
        const result = resolver.resolveConfig();
        assert.equal(resolver.configTree, null);
        assert.equal(result.testDefault, 'found');
        // Non-prefixed env vars should not appear
        assert.equal(result.home, undefined);
        assert.equal(result.HOME, undefined);
      } finally {
        if (saved === undefined) delete process.env.APP_TEST_DEFAULT;
        else process.env.APP_TEST_DEFAULT = saved;
      }
    });

    it('configTree with no loaders: uses original default mapping', () => {
      const saved = process.env.TEST_ORIG_DEFAULT;
      process.env.TEST_ORIG_DEFAULT = 'env_val';
      try {
        const resolver = new appy.ConfigResolver();
        const result = resolver.resolveConfig({
          key: { default: 'def', env: 'TEST_ORIG_DEFAULT' }
        });
        assert.equal(result.key, 'env_val');
      } finally {
        if (saved === undefined) delete process.env.TEST_ORIG_DEFAULT;
        else process.env.TEST_ORIG_DEFAULT = saved;
      }
    });

    it('single loader arg: treats as resolveMaps', () => {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig(new appy.NullLoader());
      assert.deepEqual(result, {});
      assert.equal(resolver.configTree, null);
    });

    it('array of loaders arg: treats as resolveMaps', () => {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([new appy.NullLoader()]);
      assert.deepEqual(result, {});
      assert.equal(resolver.configTree, null);
    });

    it('plain object arg: treats as configTree (backward compat)', () => {
      const resolver = new appy.ConfigResolver();
      const tree = { key: { default: 'val' } };
      const result = resolver.resolveConfig(tree, new appy.DefaultValueLoader());
      assert.equal(result.key, 'val');
      assert.equal(resolver.configTree, tree);
    });

    it('empty array: treats as resolveMaps (no loaders)', () => {
      const resolver = new appy.ConfigResolver();
      const result = resolver.resolveConfig([]);
      assert.deepEqual(result, {});
      assert.equal(resolver.configTree, null);
    });

    it('loaders + valueTree: no configTree with initial values', () => {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([new appy.NullLoader()], { existing: 'value' });
      assert.deepEqual(result, { existing: 'value' });
    });
  });

  describe('EnvLoader with prefix', () => {
    const savedEnv = {};
    const testVars = ['APP_DB_HOST', 'APP_DB_PORT', 'OTHER_KEY'];

    beforeEach(() => {
      testVars.forEach(v => { savedEnv[v] = process.env[v]; delete process.env[v]; });
      process.env.APP_DB_HOST = 'localhost';
      process.env.APP_DB_PORT = '5432';
      process.env.OTHER_KEY = 'should_be_filtered';
    });

    afterEach(() => {
      testVars.forEach(v => {
        if (savedEnv[v] === undefined) delete process.env[v];
        else process.env[v] = savedEnv[v];
      });
    });

    it('loadAllValues without prefix loads all env vars', () => {
      const loader = new appy.EnvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.APP_DB_HOST, 'localhost');
      assert.equal(result.OTHER_KEY, 'should_be_filtered');
    });

    it('loadAllValues with prefix filters by prefix', () => {
      const loader = new appy.EnvLoader({ prefix: 'APP_' });
      const result = loader.loadAllValues({});
      assert.equal(result.APP_DB_HOST, 'localhost');
      assert.equal(result.APP_DB_PORT, '5432');
      assert.equal(result.OTHER_KEY, undefined);
    });

    it('loadAllValues with prefix and stripPrefix strips prefix', () => {
      const loader = new appy.EnvLoader({ prefix: 'APP_', stripPrefix: true });
      const result = loader.loadAllValues({});
      assert.equal(result.DB_HOST, 'localhost');
      assert.equal(result.DB_PORT, '5432');
      assert.equal(result.APP_DB_HOST, undefined);
    });

    it('constructor with no args preserves backward compat', () => {
      const loader = new appy.EnvLoader();
      assert.equal(loader.mapKey, 'env');
      assert.equal(loader.prefix, null);
      assert.equal(loader.stripPrefix, false);
    });

    it('mapValue still works for configTree path', () => {
      const loader = new appy.EnvLoader({ prefix: 'APP_' });
      assert.equal(loader.mapValue('APP_DB_HOST', 'fallback'), 'localhost');
      assert.equal(loader.mapValue('NONEXISTENT', 'fallback'), 'fallback');
    });
  });

  describe('DotenvLoader with prefix', () => {
    const envFile = path.join(__dirname, 'test.env');
    const missingFile = path.join(__dirname, 'file.does.not.exist');

    it('loadAllValues loads all keys from .env', () => {
      const loader = new appy.DotenvLoader(envFile);
      const result = loader.loadAllValues({});
      assert.equal(result.TEST_ENVKEY, 'myenv value');
      assert.equal(result.TEST_ENVKEY2, '1234');
    });

    it('loadAllValues with prefix filters keys', () => {
      const loader = new appy.DotenvLoader(envFile, { prefix: 'TEST_ENVKEY2' });
      const result = loader.loadAllValues({});
      assert.equal(result.TEST_ENVKEY, undefined);
      assert.equal(result.TEST_ENVKEY2, '1234');
    });

    it('loadAllValues with prefix and stripPrefix', () => {
      const loader = new appy.DotenvLoader(envFile, { prefix: 'TEST_', stripPrefix: true });
      const result = loader.loadAllValues({});
      assert.equal(result.ENVKEY, 'myenv value');
      assert.equal(result.ENVKEY2, '1234');
    });

    it('constructor backward compat: boolean second arg sets suppressExceptions', () => {
      const loader = new appy.DotenvLoader(missingFile, true);
      assert.equal(loader.suppressExceptions, true);
      assert.doesNotThrow(() => loader.loadAllValues({}));
    });

    it('constructor with options object supports both allowMissing and suppressExceptions', () => {
      const loader = new appy.DotenvLoader(envFile, { allowMissing: true, suppressExceptions: true, prefix: 'X_' });
      assert.equal(loader.allowMissing, true);
      assert.equal(loader.suppressExceptions, true);
      assert.equal(loader.prefix, 'X_');
    });

    it('loadValues still works for configTree path', () => {
      const loader = new appy.DotenvLoader(envFile, { prefix: 'TEST_' });
      const result = loader.loadValues({
        key: { dotenv: 'TEST_ENVKEY' }
      }, {});
      assert.deepEqual(result, { key: 'myenv value' });
    });
  });

  describe('CmdArgsLoader loadAllValues', () => {
    it('returns valueTree unchanged when command is null', () => {
      const loader = new appy.CmdArgsLoader();
      const result = loader.loadAllValues({ existing: 'val' });
      assert.deepEqual(result, { existing: 'val' });
    });

    it('merges command opts into valueTree', () => {
      const loader = new appy.CmdArgsLoader();
      loader.setCommand({
        opts: () => ({ verbose: true, port: 3000 })
      });
      const result = loader.loadAllValues({});
      assert.equal(result.verbose, true);
      assert.equal(result.port, 3000);
    });
  });

  describe('JsonLoader loadAllValues', () => {
    it('loads JSON file values without configTree', () => {
      const loader = new appy.JsonLoader(path.join(__dirname, 'testconfig.json'));
      const result = loader.loadAllValues({});
      assert.equal(result.key2, 'value2');
    });
  });

  describe('YamlLoader loadAllValues', () => {
    it('loads YAML file values without configTree', () => {
      const loader = new appy.YamlLoader(path.join(__dirname, 'test.yaml'));
      const result = loader.loadAllValues({});
      assert.equal(result.key2, 'value2');
    });
  });

  describe('DefaultValueLoader and NullLoader loadAllValues', () => {
    it('DefaultValueLoader loadAllValues is no-op', () => {
      const loader = new appy.DefaultValueLoader();
      const input = { a: 1 };
      assert.deepEqual(loader.loadAllValues(input), input);
    });

    it('NullLoader loadAllValues is no-op', () => {
      const loader = new appy.NullLoader();
      const input = { a: 1 };
      assert.deepEqual(loader.loadAllValues(input), input);
    });
  });

  describe('keyCase option', () => {
    it('default keyCase is camelCase', () => {
      const resolver = new appy.ConfigResolver();
      assert.equal(resolver.keyCase, 'camelCase');
    });

    it('keyCase can be set to null to disable', () => {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      assert.equal(resolver.keyCase, null);
    });

    it('keyCase can be set to false to disable', () => {
      const resolver = new appy.ConfigResolver({ keyCase: false });
      assert.equal(resolver.keyCase, false);
    });

    it('keyCase can be set to a different case', () => {
      const resolver = new appy.ConfigResolver({ keyCase: 'snake_case' });
      assert.equal(resolver.keyCase, 'snake_case');
    });

    it('keyCase is NOT applied when configTree is provided', () => {
      const resolver = new appy.ConfigResolver();
      const result = resolver.resolveConfig(
        { my_key: { default: 'val' } },
        new appy.DefaultValueLoader()
      );
      assert.equal(result.my_key, 'val');
      assert.equal(result.myKey, undefined);
    });
  });

  describe('end-to-end no-configTree', () => {
    const savedEnv = {};
    const testVars = ['APP_DATABASE_HOST', 'APP_DATABASE_PORT', 'APP_LOG_LEVEL'];

    beforeEach(() => {
      testVars.forEach(v => { savedEnv[v] = process.env[v]; delete process.env[v]; });
      process.env.APP_DATABASE_HOST = 'localhost';
      process.env.APP_DATABASE_PORT = '5432';
      process.env.APP_LOG_LEVEL = 'debug';
    });

    afterEach(() => {
      testVars.forEach(v => {
        if (savedEnv[v] === undefined) delete process.env[v];
        else process.env[v] = savedEnv[v];
      });
    });

    it('EnvLoader with prefix, strip, and camelCase conversion', () => {
      const resolver = new appy.ConfigResolver();
      const result = resolver.resolveConfig([
        new appy.EnvLoader({ prefix: 'APP_', stripPrefix: true })
      ]);
      assert.equal(result.databaseHost, 'localhost');
      assert.equal(result.databasePort, '5432');
      assert.equal(result.logLevel, 'debug');
    });

    it('EnvLoader with prefix, strip, and snake_case conversion', () => {
      const resolver = new appy.ConfigResolver({ keyCase: 'snake_case' });
      const result = resolver.resolveConfig([
        new appy.EnvLoader({ prefix: 'APP_', stripPrefix: true })
      ]);
      assert.equal(result.database_host, 'localhost');
      assert.equal(result.database_port, '5432');
      assert.equal(result.log_level, 'debug');
    });

    it('EnvLoader with prefix, strip, and no case conversion', () => {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([
        new appy.EnvLoader({ prefix: 'APP_', stripPrefix: true })
      ]);
      assert.equal(result.DATABASE_HOST, 'localhost');
      assert.equal(result.DATABASE_PORT, '5432');
      assert.equal(result.LOG_LEVEL, 'debug');
    });

    it('DotenvLoader + EnvLoader without configTree', () => {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([
        new appy.DotenvLoader(path.join(__dirname, 'test.env')),
        new appy.EnvLoader({ prefix: 'APP_', stripPrefix: true })
      ]);
      assert.equal(result.TEST_ENVKEY, 'myenv value');
      assert.equal(result.DATABASE_HOST, 'localhost');
    });

    it('JsonLoader without configTree', () => {
      const resolver = new appy.ConfigResolver();
      const result = resolver.resolveConfig([
        new appy.JsonLoader(path.join(__dirname, 'testconfig.json'))
      ]);
      // keys from JSON file should be camelCase converted
      assert.notEqual(result, undefined);
    });

    it('resolveCommander works in no-configTree path', () => {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      let callback;
      const commandMock = {
        hook: mock.fn((_event, cb) => { callback = cb; }),
        opts: () => ({ verbose: true, port: 3000 }),
        args: [],
      };

      resolver.resolveConfig([
        new appy.EnvLoader({ prefix: 'APP_', stripPrefix: true }),
        new appy.CmdArgsLoader()
      ]);

      resolver.resolveCommander(commandMock);
      callback(commandMock, commandMock);

      assert.equal(resolver.valueTree.verbose, true);
      assert.equal(resolver.valueTree.port, 3000);
      assert.equal(resolver.valueTree.DATABASE_HOST, 'localhost');
    });
  });

  describe('nested key expansion via __', () => {
    const savedEnv = {};
    const testVars = ['APP_DATABASE__HOST', 'APP_DATABASE__PORT', 'APP_LOG_LEVEL'];

    beforeEach(() => {
      testVars.forEach(v => { savedEnv[v] = process.env[v]; delete process.env[v]; });
      process.env.APP_DATABASE__HOST = 'localhost';
      process.env.APP_DATABASE__PORT = '5432';
      process.env.APP_LOG_LEVEL = 'info';
    });

    afterEach(() => {
      testVars.forEach(v => {
        if (savedEnv[v] === undefined) delete process.env[v];
        else process.env[v] = savedEnv[v];
      });
    });

    it('EnvLoader with expand + camelCase produces nested camelCase keys', () => {
      const resolver = new appy.ConfigResolver();
      const result = resolver.resolveConfig([
        new appy.EnvLoader({ prefix: 'APP_', stripPrefix: true })
      ]);
      assert.deepEqual(result.database, { host: 'localhost', port: '5432' });
      assert.equal(result.logLevel, 'info');
    });

    it('DotenvLoader with expand + camelCase produces nested camelCase keys', () => {
      const resolver = new appy.ConfigResolver();
      const result = resolver.resolveConfig([
        new appy.DotenvLoader(path.join(__dirname, 'test.env'), { prefix: 'TEST_', stripPrefix: true })
      ]);
      assert.deepEqual(result.nested, { level1: { level2: 'deep_value' } });
      assert.equal(result.flatKey, 'flat_value');
    });

    it('expand: false keeps __ keys flat', () => {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([
        new appy.EnvLoader({ prefix: 'APP_', stripPrefix: true, expand: false })
      ]);
      assert.equal(result['DATABASE__HOST'], 'localhost');
      assert.equal(result.DATABASE, undefined);
    });
  });

  describe('exports', () => {
    it('case converter functions are exported', () => {
      assert.equal(typeof appy.convertKeys, 'function');
      assert.equal(typeof appy.splitKey, 'function');
      assert.equal(typeof appy.toCamelCase, 'function');
      assert.equal(typeof appy.toSnakeCase, 'function');
      assert.equal(typeof appy.toKebabCase, 'function');
      assert.equal(typeof appy.toPascalCase, 'function');
      assert.equal(typeof appy.toConstantCase, 'function');
      assert.equal(typeof appy.toFlatCase, 'function');
    });

    it('CASE_CONVERTERS is exported', () => {
      assert.equal(typeof appy.CASE_CONVERTERS, 'object');
      assert.equal(typeof appy.CASE_CONVERTERS.camelCase, 'function');
    });
  });
});
