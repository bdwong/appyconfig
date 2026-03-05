const { describe, it } = require('test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const appy = require('../index');

describe('Commander acceptance — program-level options', () => {
  it('resolves program-level options into valueTree', () => {
    const program = new Command();
    program
      .option('--name <n>', 'name option')
      .option('--verbose', 'verbose flag')
      .action(() => {});

    const configTree = {
      name: { default: 'nobody', cmdArg: 'name' },
      verbose: { default: false, cmdArg: 'verbose' }
    };

    const resolver = new appy.ConfigResolver();
    resolver.resolveConfig(configTree,
      [new appy.DefaultValueLoader(), new appy.CmdArgsLoader()]);

    // Before parsing, defaults are in place.
    assert.equal(resolver.valueTree.name, 'nobody');
    assert.equal(resolver.valueTree.verbose, false);

    resolver.resolveCommander(program);
    program.parse(['node', 'test', '--name', 'alice', '--verbose']);

    // After parsing, commander options override defaults.
    assert.equal(resolver.valueTree.name, 'alice');
    assert.equal(resolver.valueTree.verbose, true);
  });

  it('resolves nested config with program-level options', () => {
    const program = new Command();
    program
      .option('--host <h>', 'host')
      .option('--port <n>', 'port')
      .option('--debug', 'debug flag')
      .action(() => {});

    const configTree = {
      server: {
        connection: {
          host: { default: 'localhost', cmdArg: 'host' },
          port: { default: '3000', cmdArg: 'port' }
        },
        flags: {
          debug: { default: false, cmdArg: 'debug' }
        }
      }
    };

    const resolver = new appy.ConfigResolver();
    resolver.resolveConfig(configTree,
      [new appy.DefaultValueLoader(), new appy.CmdArgsLoader()]);

    assert.deepEqual(resolver.valueTree, {
      server: {
        connection: { host: 'localhost', port: '3000' },
        flags: { debug: false }
      }
    });

    resolver.resolveCommander(program);
    program.parse(['node', 'test', '--host', '0.0.0.0', '--port', '8080', '--debug']);

    assert.deepEqual(resolver.valueTree, {
      server: {
        connection: { host: '0.0.0.0', port: '8080' },
        flags: { debug: true }
      }
    });
  });
});

describe('Commander acceptance — subcommand options', () => {
  it('resolves subcommand and program-level options into valueTree', () => {
    const program = new Command();
    program.option('--verbose', 'verbose flag');

    program
      .command('serve')
      .option('--port <n>', 'port')
      .option('--host <h>', 'host')
      .action(() => {});

    const configTree = {
      verbose: { default: false, cmdArg: 'verbose' },
      port: { default: '3000', cmdArg: 'port' },
      host: { default: 'localhost', cmdArg: 'host' }
    };

    const resolver = new appy.ConfigResolver();
    resolver.resolveConfig(configTree,
      [new appy.DefaultValueLoader(), new appy.CmdArgsLoader()]);

    assert.equal(resolver.valueTree.verbose, false);
    assert.equal(resolver.valueTree.port, '3000');
    assert.equal(resolver.valueTree.host, 'localhost');

    resolver.resolveCommander(program);
    program.parse(['node', 'test', '--verbose', 'serve', '--port', '8080', '--host', '0.0.0.0']);

    // Subcommand options should resolve.
    assert.equal(resolver.valueTree.port, '8080');
    assert.equal(resolver.valueTree.host, '0.0.0.0');

    // Program-level option should also resolve.
    // With real Commander, actionCommand is the subcommand, and its opts()
    // only contains subcommand options — not program-level options.
    assert.equal(resolver.valueTree.verbose, true);
  });

  it('resolves nested config with subcommand and program-level options', () => {
    const program = new Command();
    program.option('--verbose', 'verbose flag');

    program
      .command('serve')
      .option('--port <n>', 'port')
      .option('--host <h>', 'host')
      .action(() => {});

    const configTree = {
      app: {
        flags: {
          verbose: { default: false, cmdArg: 'verbose' }
        },
        server: {
          host: { default: 'localhost', cmdArg: 'host' },
          port: { default: '3000', cmdArg: 'port' }
        }
      }
    };

    const resolver = new appy.ConfigResolver();
    resolver.resolveConfig(configTree,
      [new appy.DefaultValueLoader(), new appy.CmdArgsLoader()]);

    assert.deepEqual(resolver.valueTree, {
      app: {
        flags: { verbose: false },
        server: { host: 'localhost', port: '3000' }
      }
    });

    resolver.resolveCommander(program);
    program.parse(['node', 'test', '--verbose', 'serve', '--port', '8080', '--host', '0.0.0.0']);

    assert.deepEqual(resolver.valueTree, {
      app: {
        flags: { verbose: true },
        server: { host: '0.0.0.0', port: '8080' }
      }
    });
  });
});
