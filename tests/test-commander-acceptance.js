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
});
