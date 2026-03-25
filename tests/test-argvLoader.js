const { describe, it, beforeEach, afterEach, mock } = require('test');
const assert = require('node:assert/strict');
const { ArgvLoader, UnrecognizedArgumentError } = require('../index');

describe('ArgvLoader', () => {
  let savedArgv;

  beforeEach(() => {
    savedArgv = process.argv.slice();
  });

  afterEach(() => {
    process.argv = savedArgv;
  });

  describe('constructor', () => {
    it('has mapKey set to "argv"', () => {
      const loader = new ArgvLoader();
      assert.equal(loader.mapKey, 'argv');
    });

    it('accepts aliases option', () => {
      const loader = new ArgvLoader({ aliases: { '-o': '--output-file' } });
      assert.deepEqual(loader.aliases, { '-o': '--output-file' });
    });

    it('defaults aliases to empty object', () => {
      const loader = new ArgvLoader();
      assert.deepEqual(loader.aliases, {});
    });
  });

  describe('basic parsing', () => {
    it('parses --key value', () => {
      process.argv = ['node', 'script.js', '--host', 'localhost'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.host, 'localhost');
    });

    it('parses --key=value', () => {
      process.argv = ['node', 'script.js', '--host=localhost'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.host, 'localhost');
    });

    it('parses multiple options', () => {
      process.argv = ['node', 'script.js', '--host', 'localhost', '--port', '5432'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.host, 'localhost');
      assert.equal(result.port, '5432');
    });

    it('parses --key=value with = in value', () => {
      process.argv = ['node', 'script.js', '--formula=a=b'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.formula, 'a=b');
    });

    it('parses --key= as empty string', () => {
      process.argv = ['node', 'script.js', '--name='];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.name, '');
    });
  });

  describe('nested expansion via --', () => {
    it('expands --database--host into nested object', () => {
      process.argv = ['node', 'script.js', '--database--host', 'localhost'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.deepEqual(result.database, { host: 'localhost' });
    });

    it('expands multiple levels', () => {
      process.argv = ['node', 'script.js', '--a--b--c', 'deep'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.deepEqual(result.a, { b: { c: 'deep' } });
    });

    it('merges nested values into existing objects', () => {
      process.argv = ['node', 'script.js', '--database--host', 'localhost', '--database--port', '5432'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.deepEqual(result.database, { host: 'localhost', port: '5432' });
    });
  });

  describe('boolean flags', () => {
    it('bare flag becomes true when no value tree context', () => {
      process.argv = ['node', 'script.js', '--verbose'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.verbose, true);
    });

    it('flag with next arg starting with - becomes true', () => {
      process.argv = ['node', 'script.js', '--verbose', '--host', 'localhost'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.verbose, true);
      assert.equal(result.host, 'localhost');
    });

    it('existing boolean in value tree makes option a flag', () => {
      process.argv = ['node', 'script.js', '--debug', 'not-consumed'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({ debug: false });
      assert.equal(result.debug, true);
      // 'not-consumed' should remain in process.argv
      assert.ok(process.argv.includes('not-consumed'));
    });

    it('--no-X negates when non-negated key is boolean in value tree', () => {
      process.argv = ['node', 'script.js', '--no-debug'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({ debug: true });
      assert.equal(result.debug, false);
    });

    it('--no-X is treated as regular key when non-negated key is not boolean', () => {
      process.argv = ['node', 'script.js', '--no-debug', 'value'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result['no-debug'], 'value');
    });

    it('--no-X as flag when non-negated key is not in value tree', () => {
      process.argv = ['node', 'script.js', '--no-debug'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result['no-debug'], true);
    });
  });

  describe('short aliases', () => {
    it('expands short alias to long form', () => {
      process.argv = ['node', 'script.js', '-o', 'out.txt'];
      const loader = new ArgvLoader({ aliases: { '-o': '--output-file' } });
      const result = loader.loadAllValues({});
      assert.equal(result['output-file'], 'out.txt');
    });

    it('expands boolean short alias', () => {
      process.argv = ['node', 'script.js', '-v'];
      const loader = new ArgvLoader({ aliases: { '-v': '--verbose' } });
      const result = loader.loadAllValues({ verbose: false });
      assert.equal(result.verbose, true);
    });

    it('exits on unrecognized short option by default', () => {
      process.argv = ['node', 'script.js', '-x', '--host', 'localhost'];
      const exitMock = mock.method(process, 'exit', () => {});
      const stderrMock = mock.method(process.stderr, 'write', () => {});
      try {
        const loader = new ArgvLoader();
        loader.loadAllValues({ host: 'default' });
        assert.equal(exitMock.mock.callCount(), 1);
        assert.equal(exitMock.mock.calls[0].arguments[0], 1);
        assert.ok(stderrMock.mock.calls[0].arguments[0].includes('-x'));
      } finally {
        exitMock.mock.restore();
        stderrMock.mock.restore();
      }
    });
  });

  describe('end-of-options --', () => {
    it('stops parsing at bare --', () => {
      process.argv = ['node', 'script.js', '--host', 'localhost', '--', '--not-parsed', 'positional'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.host, 'localhost');
      assert.equal(result['not-parsed'], undefined);
    });

    it('removes -- sentinel from process.argv', () => {
      process.argv = ['node', 'script.js', '--host', 'localhost', '--', 'positional'];
      const loader = new ArgvLoader();
      loader.loadAllValues({});
      assert.ok(!process.argv.includes('--'));
      assert.ok(process.argv.includes('positional'));
    });
  });

  describe('argv cleanup', () => {
    it('removes consumed args from process.argv', () => {
      process.argv = ['node', 'script.js', '--host', 'localhost', 'positional'];
      const loader = new ArgvLoader();
      loader.loadAllValues({});
      assert.deepEqual(process.argv, ['node', 'script.js', 'positional']);
    });

    it('preserves node and script args', () => {
      process.argv = ['node', 'script.js', '--verbose'];
      const loader = new ArgvLoader();
      loader.loadAllValues({});
      assert.equal(process.argv[0], 'node');
      assert.equal(process.argv[1], 'script.js');
    });

    it('leaves positional args after -- in argv', () => {
      process.argv = ['node', 'script.js', '--verbose', '--', 'file1', 'file2'];
      const loader = new ArgvLoader();
      loader.loadAllValues({});
      assert.ok(process.argv.includes('file1'));
      assert.ok(process.argv.includes('file2'));
    });
  });

  describe('config tree mode (mapValue)', () => {
    it('returns argv value for matching key', () => {
      process.argv = ['node', 'script.js', '--host', 'localhost'];
      const loader = new ArgvLoader();
      const result = loader.mapValue('host', 'default');
      assert.equal(result, 'localhost');
    });

    it('returns original value when key not in argv', () => {
      process.argv = ['node', 'script.js', '--host', 'localhost'];
      const loader = new ArgvLoader();
      loader.mapValue('host', 'default'); // trigger parse
      const result = loader.mapValue('port', '3000');
      assert.equal(result, '3000');
    });

    it('coerces string to boolean true when value is boolean', () => {
      process.argv = ['node', 'script.js', '--verbose'];
      const loader = new ArgvLoader();
      const result = loader.mapValue('verbose', false);
      assert.equal(result, true);
    });

    it('coerces "false" string to boolean false when value is boolean', () => {
      process.argv = ['node', 'script.js', '--verbose=false'];
      const loader = new ArgvLoader();
      const result = loader.mapValue('verbose', true);
      assert.equal(result, false);
    });

    it('coerces "true" string to boolean true when value is boolean', () => {
      process.argv = ['node', 'script.js', '--verbose=true'];
      const loader = new ArgvLoader();
      const result = loader.mapValue('verbose', false);
      assert.equal(result, true);
    });
  });

  describe('edge cases', () => {
    it('handles empty argv (no args beyond node and script)', () => {
      process.argv = ['node', 'script.js'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.deepEqual(result, {});
    });

    it('last value wins for repeated options', () => {
      process.argv = ['node', 'script.js', '--host', 'first', '--host', 'second'];
      const loader = new ArgvLoader();
      const result = loader.loadAllValues({});
      assert.equal(result.host, 'second');
    });

    it('only parses once (lazy parsing)', () => {
      process.argv = ['node', 'script.js', '--host', 'localhost'];
      const loader = new ArgvLoader();
      loader.loadAllValues({});
      // Change argv after parse — should not affect results
      process.argv = ['node', 'script.js', '--host', 'changed'];
      const result = loader.loadAllValues({});
      assert.equal(result.host, 'localhost');
    });
  });

  describe('unrecognized option handling', () => {
    describe('constructor', () => {
      it('defaults onUnrecognized to ArgvLoader.EXIT', () => {
        const loader = new ArgvLoader();
        assert.equal(loader.onUnrecognized, ArgvLoader.EXIT);
      });

      it('accepts a custom callback', () => {
        const cb = () => {};
        const loader = new ArgvLoader({ onUnrecognized: cb });
        assert.equal(loader.onUnrecognized, cb);
      });
    });

    describe('static callbacks', () => {
      it('ArgvLoader.THROW throws UnrecognizedArgumentError', () => {
        process.argv = ['node', 'script.js', '-x'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        assert.throws(
          () => loader.loadAllValues({}),
          (err) => {
            assert.ok(err instanceof UnrecognizedArgumentError);
            assert.equal(err.arg, '-x');
            return true;
          }
        );
      });

      it('ArgvLoader.IGNORE silently skips unrecognized args', () => {
        process.argv = ['node', 'script.js', '-x', '--host', 'localhost'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.IGNORE });
        const result = loader.loadAllValues({ host: 'default' });
        assert.equal(result.host, 'localhost');
      });

      it('ArgvLoader.EXIT writes to stderr and exits', () => {
        process.argv = ['node', 'script.js', '--unknown'];
        const exitMock = mock.method(process, 'exit', () => {});
        const stderrMock = mock.method(process.stderr, 'write', () => {});
        try {
          const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.EXIT });
          loader.loadAllValues({ host: 'default' });
          assert.equal(exitMock.mock.callCount(), 1);
          assert.equal(exitMock.mock.calls[0].arguments[0], 1);
          assert.ok(stderrMock.mock.calls[0].arguments[0].includes('--unknown'));
        } finally {
          exitMock.mock.restore();
          stderrMock.mock.restore();
        }
      });
    });

    describe('callback receives the argument', () => {
      it('passes unrecognized short option to callback', () => {
        process.argv = ['node', 'script.js', '-x'];
        const received = [];
        const loader = new ArgvLoader({ onUnrecognized: (arg) => received.push(arg) });
        loader.loadAllValues({});
        assert.deepEqual(received, ['-x']);
      });

      it('passes unrecognized long option to callback', () => {
        process.argv = ['node', 'script.js', '--unknown', 'val'];
        const received = [];
        const loader = new ArgvLoader({ onUnrecognized: (arg) => received.push(arg) });
        loader.loadAllValues({ host: 'default' });
        assert.deepEqual(received, ['--unknown']);
      });

      it('calls callback for --unknown=value form', () => {
        process.argv = ['node', 'script.js', '--unknown=val'];
        const received = [];
        const loader = new ArgvLoader({ onUnrecognized: (arg) => received.push(arg) });
        loader.loadAllValues({ host: 'default' });
        assert.deepEqual(received, ['--unknown=val']);
      });

      it('calls callback for --no-unknown when unknown is not a boolean key', () => {
        process.argv = ['node', 'script.js', '--no-unknown'];
        const received = [];
        const loader = new ArgvLoader({ onUnrecognized: (arg) => received.push(arg) });
        loader.loadAllValues({ host: 'default' });
        assert.deepEqual(received, ['--no-unknown']);
      });

      it('does not call callback for --no-X when X is a boolean key', () => {
        process.argv = ['node', 'script.js', '--no-debug'];
        const received = [];
        const loader = new ArgvLoader({ onUnrecognized: (arg) => received.push(arg) });
        const result = loader.loadAllValues({ debug: true });
        assert.equal(result.debug, false);
        assert.deepEqual(received, []);
      });
    });

    describe('edge cases', () => {
      it('args after -- sentinel are never flagged', () => {
        process.argv = ['node', 'script.js', '--host', 'localhost', '--', '--unknown'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const result = loader.loadAllValues({ host: 'default' });
        assert.equal(result.host, 'localhost');
      });

      it('positional args are never flagged', () => {
        process.argv = ['node', 'script.js', 'positional', '--host', 'localhost'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const result = loader.loadAllValues({ host: 'default' });
        assert.equal(result.host, 'localhost');
      });

      it('empty argv does not trigger callback', () => {
        process.argv = ['node', 'script.js'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const result = loader.loadAllValues({ host: 'default' });
        assert.equal(result.host, 'default');
      });

      it('does not check long options when valueTree is empty', () => {
        process.argv = ['node', 'script.js', '--anything', 'val'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const result = loader.loadAllValues({});
        assert.equal(result.anything, 'val');
      });

      it('config-tree mode (mapValue) does not flag unrecognized long options', () => {
        process.argv = ['node', 'script.js', '--unknown', 'val', '--host', 'localhost'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const result = loader.mapValue('host', 'default');
        assert.equal(result, 'localhost');
      });

      it('config-tree mode (loadValues) flags unrecognized long options', () => {
        process.argv = ['node', 'script.js', '--unknown', 'val', '--host', 'localhost'];
        const received = [];
        const loader = new ArgvLoader({ onUnrecognized: (arg) => received.push(arg) });
        const configTree = {
          host: { default: 'default-host', argv: 'host' },
        };
        loader.loadValues(configTree, {});
        assert.deepEqual(received, ['--unknown']);
      });

      it('config-tree mode (loadValues) allows recognized argv keys', () => {
        process.argv = ['node', 'script.js', '--host', 'localhost', '--port', '5432'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const configTree = {
          host: { default: 'default-host', argv: 'host' },
          port: { default: '3000', argv: 'port' },
        };
        const result = loader.loadValues(configTree, {});
        assert.equal(result.host, 'localhost');
        assert.equal(result.port, '5432');
      });

      it('config-tree mode (loadValues) unrecognized args remain in process.argv', () => {
        process.argv = ['node', 'script.js', '--unknown', 'val', '--host', 'localhost'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.IGNORE });
        const configTree = {
          host: { default: 'default-host', argv: 'host' },
        };
        loader.loadValues(configTree, {});
        assert.ok(process.argv.includes('--unknown'));
        assert.ok(process.argv.includes('val'));
      });

      it('config-tree mode (loadValues) boolean flags work with type info from valueTree', () => {
        process.argv = ['node', 'script.js', '--verbose', 'not-consumed'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const configTree = {
          verbose: { default: false, argv: 'verbose' },
        };
        const result = loader.loadValues(configTree, { verbose: false });
        assert.equal(result.verbose, true);
        assert.ok(process.argv.includes('not-consumed'));
      });

      it('config-tree mode (loadValues) --no-X negation works with type info', () => {
        process.argv = ['node', 'script.js', '--no-debug'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const configTree = {
          debug: { default: true, argv: 'debug' },
        };
        const result = loader.loadValues(configTree, { debug: true });
        assert.equal(result.debug, false);
      });

      it('config-tree mode (loadValues) handles nested config trees', () => {
        process.argv = ['node', 'script.js', '--db-host', 'localhost', '--db-port', '5432'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const configTree = {
          database: {
            host: { default: 'default-host', argv: 'db-host' },
            port: { default: '3000', argv: 'db-port' },
          },
        };
        const result = loader.loadValues(configTree, {});
        assert.equal(result.database.host, 'localhost');
        assert.equal(result.database.port, '5432');
      });

      it('config-tree mode does not validate when valueTree has no argv keys', () => {
        process.argv = ['node', 'script.js', '--anything', 'val'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.THROW });
        const configTree = {
          host: { default: 'default-host' },
        };
        const result = loader.loadValues(configTree, {});
        // No argv keys in config tree, so no validation
        assert.equal(result.host, undefined);
      });

      it('leaves unrecognized args in process.argv', () => {
        process.argv = ['node', 'script.js', '-x', '--unknown', 'val', '--host', 'localhost'];
        const loader = new ArgvLoader({ onUnrecognized: ArgvLoader.IGNORE });
        loader.loadAllValues({ host: 'default' });
        assert.ok(process.argv.includes('-x'));
        assert.ok(process.argv.includes('--unknown'));
        assert.ok(process.argv.includes('val'));
      });
    });
  });
});
