const { describe, it } = require('test');
const assert = require('node:assert/strict');
const { CmdArgsLoader } = require('../index');

describe('CmdArgsLoader', () => {
  it('has mapKey set to "cmdArg"', () => {
    const loader = new CmdArgsLoader();
    assert.equal(loader.mapKey, 'cmdArg');
  });

  it('setCommand stores the command reference', () => {
    const loader = new CmdArgsLoader();
    const cmd = { fake: true };
    loader.setCommand(cmd);
    assert.equal(loader.command, cmd);
  });

  it('returns current value when command is null (pre-parsing)', () => {
    const loader = new CmdArgsLoader();
    assert.equal(loader.mapValue('opt1', 'current'), 'current');
  });

  describe('subcommand parsing — args is Function', () => {
    const cmdOpts = { opt1: 'optvalue1', opt2: 'optvalue2', optFalse: false, optZero: 0 };
    const subcommandMock = {
      args: (name) => cmdOpts[name],
      opts: (name) => cmdOpts[name]
    };

    it('returns args(cfg) when defined', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(subcommandMock);
      assert.equal(loader.mapValue('opt1', 'default'), 'optvalue1');
    });

    it('falls back to opts(cfg) when args returns undefined', () => {
      const loader = new CmdArgsLoader();
      const mock = {
        args: (_name) => undefined,
        opts: (name) => cmdOpts[name]
      };
      loader.setCommand(mock);
      assert.equal(loader.mapValue('opt1', 'default'), 'optvalue1');
    });

    it('returns current value when both args and opts return undefined', () => {
      const loader = new CmdArgsLoader();
      const mock = {
        args: (_name) => undefined,
        opts: (_name) => undefined
      };
      loader.setCommand(mock);
      assert.equal(loader.mapValue('nonexistent', 'current'), 'current');
    });

    it('handles false values correctly', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(subcommandMock);
      assert.equal(loader.mapValue('optFalse', true), false);
    });

    it('handles 0 values correctly', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(subcommandMock);
      assert.equal(loader.mapValue('optZero', 99), 0);
    });

    it('resolves nested config tree via loadValues', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(subcommandMock);
      const result = loader.loadValues({
        parent: {
          child: { cmdArg: 'opt1' }
        }
      }, { parent: { child: 'old' } });
      assert.deepEqual(result, { parent: { child: 'optvalue1' } });
    });

    it('resolves deeply nested config tree via loadValues', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(subcommandMock);
      const result = loader.loadValues({
        server: {
          connection: {
            host: { cmdArg: 'opt1' },
            port: { cmdArg: 'opt2' }
          },
          flags: {
            debug: { cmdArg: 'optFalse' }
          }
        }
      }, { server: { connection: { host: 'old', port: 'old' }, flags: { debug: true } } });
      assert.deepEqual(result, {
        server: {
          connection: { host: 'optvalue1', port: 'optvalue2' },
          flags: { debug: false }
        }
      });
    });
  });

  describe('program-level parsing — args is Array', () => {
    const fullHash = { opt1: 'optvalue1', opt2: 'optvalue2', optFalse: false, optZero: 0 };
    const programMock = {
      args: [],
      opts: (_name) => fullHash
    };

    it('returns opts(cfg)[cfg] when key exists in hash', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(programMock);
      assert.equal(loader.mapValue('opt1', 'default'), 'optvalue1');
    });

    it('returns current value when key not in hash', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(programMock);
      assert.equal(loader.mapValue('nonexistent', 'current'), 'current');
    });

    it('handles false values correctly', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(programMock);
      assert.equal(loader.mapValue('optFalse', true), false);
    });

    it('handles 0 values correctly', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(programMock);
      assert.equal(loader.mapValue('optZero', 99), 0);
    });

    it('resolves nested config tree via loadValues', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(programMock);
      const result = loader.loadValues({
        parent: {
          child: { cmdArg: 'opt1' }
        }
      }, { parent: { child: 'old' } });
      assert.deepEqual(result, { parent: { child: 'optvalue1' } });
    });

    it('resolves deeply nested config tree via loadValues', () => {
      const loader = new CmdArgsLoader();
      loader.setCommand(programMock);
      const result = loader.loadValues({
        server: {
          connection: {
            host: { cmdArg: 'opt1' },
            port: { cmdArg: 'opt2' }
          },
          flags: {
            debug: { cmdArg: 'optFalse' }
          }
        }
      }, { server: { connection: { host: 'old', port: 'old' }, flags: { debug: true } } });
      assert.deepEqual(result, {
        server: {
          connection: { host: 'optvalue1', port: 'optvalue2' },
          flags: { debug: false }
        }
      });
    });
  });
});
