const { describe, it, beforeEach, afterEach, mock } = require('test');
const assert = require('node:assert/strict');
const { ArgvLoader } = require('../index');

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

    it('warns on unrecognized short option', () => {
      process.argv = ['node', 'script.js', '-x', '--host', 'localhost'];
      const warnMock = mock.method(console, 'warn', () => {});
      try {
        const loader = new ArgvLoader();
        const result = loader.loadAllValues({});
        assert.equal(warnMock.mock.callCount() > 0, true);
        assert.ok(warnMock.mock.calls[0].arguments[0].includes('-x'));
        // -x should remain in process.argv
        assert.ok(process.argv.includes('-x'));
        assert.equal(result.host, 'localhost');
      } finally {
        warnMock.mock.restore();
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
});
