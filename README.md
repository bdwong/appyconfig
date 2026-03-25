# appyconfig

Load and override configuration from multiple sources. Use it anywhere with ease. Supports JSON, JSONC, YAML, TOML, .env files, environment variables, CLI arguments, and Commander.

# Install

```
npm install appyconfig
```

# Usage

Call `resolveConfig()` to load and consolidate configuration data in a dedicated module, and export the resulting configuration object. Then import the configuration object in other modules as needed. This is the recommended pattern.

## Basic Example

In `lib/config.js`:

```js
const { resolveConfig } = require('appyconfig');

const config = resolveConfig();

module.exports = config;
```

Import the `config` object wherever you need it, e.g. in `app.js`:

```js
const config = require('./lib/config');

// When retrieving configuration data, keys are automatically converted to camelCase.
console.log(`config.databaseHost => ${config.databaseHost}`);
console.log(`config.databasePort => ${config.databasePort}`);
```

Running your app:

```sh
node app.js --database-host myserver --database-port 1234
# config.databaseHost => "myserver"
# config.databasePort => "1234"
```

The above pattern works because Node caches module exports. Every file that imports the config module gets the same object — a single source of truth for your app's configuration.

### Default Data Sources

When `resolveConfig()` is called with no arguments, it loads configuration data from the following sources:

- `config.json` (if present)
- `.env` (if present)
- `APP_`-prefixed environment variables
- Command line arguments

To use different configuration data sources, see **Changing Loaders** below.

### Environment Variables

Continuing the above example, you could use environment variables to set the database configuration:

```sh
APP_DATABASE_HOST=localhost APP_DATABASE_PORT=5432 node app.js
# config.databaseHost => "localhost"
# config.databasePort => "5432"
```

To customize the environment variable prefix, pass an options hash when resolving the configuration:

```js
const config = resolveConfig({ prefix: 'MYAPP_' });
```

```sh
MYAPP_DATABASE_HOST=localhost node app.js
# config.databaseHost => "localhost"
```

Use an empty prefix to read all environment variables without filtering:

```js
const config = resolveConfig({ prefix: '' });
```

## Changing Loaders

You can specify which loaders (i.e. configuration data sources) will be resolved for your configuration. Pass an array of loaders to the `resolveConfig()` call. Later loaders override earlier ones.

In `lib/config.js`:

```js
const { resolveConfig, EnvLoader, DotenvLoader, JsonLoader, YamlLoader, TomlLoader } = require('appyconfig');

const config = resolveConfig([
  new JsonLoader('config/defaults.json'),
  new YamlLoader('config/local.yaml'),
  new DotenvLoader('.env'),
  new EnvLoader({ prefix: 'MYAPP_', stripPrefix: true })
]);

module.exports = config;
```

Here is a list of valid loaders:

| Data source | Class | Notes |
|--- |--- |--- |
| Environment variables | EnvLoader | Options: `{ prefix, stripPrefix, expand }` |
| JSON file | JsonLoader | Supports JSONC (comments) |
| YAML file | YamlLoader | |
| TOML file | TomlLoader | |
| .env file | DotenvLoader | Options: `{ prefix, stripPrefix, expand, allowMissing, suppressExceptions }` |
| CLI arguments (built-in) | ArgvLoader | Options: `{ aliases, onUnrecognized }`. See ArgvLoader section below |
| CLI arguments (Commander) | CmdArgsLoader | See Commander section below |

### Default Loaders

When you call `resolveConfig()` with no arguments, the defaults look for `config.json` in your project root (detected via [app-root-path](https://www.npmjs.com/package/app-root-path)), `.env` in your current working directory, `APP_`-prefixed environment variables, and command line arguments. Both files are optional and silently skipped if missing. This is equivalent to:

```js
const config = resolveConfig([
  new JsonLoader('config.json', { allowMissing: true }),
  new DotenvLoader('.env', { allowMissing: true }),
  new EnvLoader({ prefix: 'APP_', stripPrefix: true }),
  new ArgvLoader()
]);
```

## Customizing Key Case

By default, keys are converted to camelCase. Use the `ConfigResolver` class to change this.

Typically, you create a single `ConfigResolver` with one unified config tree covering all your application's settings, and share that instance across your app as a single source of truth for configuration.

In `lib/config.js`:

```js
const { ConfigResolver, EnvLoader } = require('appyconfig');

// Use snake_case keys
const resolver = new ConfigResolver({ keyCase: 'snake_case' });
const config = resolver.resolveConfig([
  new EnvLoader({ prefix: 'APP_', stripPrefix: true })
]);

// APP_DATABASE_HOST=localhost  =>  config.database_host
```

Available key cases: `camelCase`, `snake_case`, `kebab-case`, `PascalCase`, `CONSTANT_CASE`, `flatcase`.

Set `keyCase` to `null` to leave keys as-is:

```js
const resolver = new ConfigResolver({ keyCase: null });
```

## Nested Keys via `__`

Use double underscores (`__`) in environment variable names or `.env` keys to create nested configuration objects. This is enabled by default.

```sh
APP_DATABASE__HOST=localhost APP_DATABASE__PORT=5432 node app.js
```

```js
const config = resolveConfig([
  new EnvLoader({ prefix: 'APP_', stripPrefix: true })
]);

console.log(config.database.host); // "localhost"
console.log(config.database.port); // "5432"
```

Multiple levels work too: `APP_A__B__C=value` becomes `{ a: { b: { c: 'value' } } }` (after camelCase conversion).

To disable expansion, set `expand: false`:

```js
new EnvLoader({ prefix: 'APP_', stripPrefix: true, expand: false })
// APP_DATABASE__HOST=localhost  =>  { databaseHost: "localhost" }
```

The `expand` option works the same way on `DotenvLoader`:

```js
new DotenvLoader('.env', { prefix: 'APP_', stripPrefix: true })
// APP_DB__HOST=localhost in .env  =>  { db: { host: "localhost" } }
```

## Tree Locking

Use `LOCK` and `UNLOCK` to control which loaders can introduce new keys. This is useful when you want to establish the configuration structure from a trusted source (like a JSON file) and then only allow subsequent loaders to override existing values.

```js
const { ConfigResolver, JsonLoader, EnvLoader, DotenvLoader, LOCK, UNLOCK } = require('appyconfig');

const resolver = new ConfigResolver({ keyCase: null });
const config = resolver.resolveConfig([
  new JsonLoader('config.json'),   // Establishes the allowed key structure
  LOCK,                            // No new keys from here on
  new EnvLoader(),                 // Can only override existing keys
  new DotenvLoader('.env'),        // Can only override existing keys
  UNLOCK,                          // (optional) Re-allow new keys
]);
```

When the tree is locked, loaders after `LOCK` can update values for keys that already exist but cannot add new keys. `UNLOCK` restores normal behavior, allowing new keys again.

You can also lock from the start using the `locked` constructor option. In this case, the initial `valueTree` defines the allowed shape:

```js
const resolver = new ConfigResolver({ keyCase: null, locked: true });
const config = resolver.resolveConfig([
  new EnvLoader({ prefix: 'APP_', stripPrefix: true }),
], null, { HOST: 'default', PORT: '3000' });
// Only HOST and PORT can be set — any other APP_* vars are ignored
```

## Prefix Filtering

`EnvLoader` and `DotenvLoader` accept `prefix` and `stripPrefix` options to select and rename keys:

```js
// Only read env vars starting with DB_, and remove the prefix
new EnvLoader({ prefix: 'DB_', stripPrefix: true })
// DB_HOST=localhost  =>  { host: "localhost" }  (after camelCase)

// Only read matching keys from .env file
new DotenvLoader('.env', { prefix: 'DB_', stripPrefix: true })
```

## CLI Arguments (ArgvLoader)

`ArgvLoader` parses `process.argv` directly for simple CLI use cases, without requiring Commander.

```js
const { resolveConfig, ArgvLoader, JsonLoader } = require('appyconfig');

const config = resolveConfig([
  new JsonLoader('config.json', { allowMissing: true }),
  new ArgvLoader()
]);
```

```sh
node app.js --host localhost --port 5432
# config.host => "localhost", config.port => "5432"
```

Options are passed as `--key value` or `--key=value`. Consumed arguments are removed from `process.argv`, leaving positional args intact.

### Boolean Flags

If a key already exists as a boolean in the value tree (from a previous loader), the option is treated as a flag — no value is consumed from the next argument:

```js
const config = resolveConfig([
  new JsonLoader('defaults.json'),  // { "verbose": false }
  new ArgvLoader()
]);
```

```sh
node app.js --verbose        # verbose => true (flag, not consuming next arg)
node app.js --no-verbose     # verbose => false (negation)
```

The `--no-` prefix only negates when the non-negated key exists as a boolean in the value tree. Otherwise, `--no-X` is treated as a regular option named `no-X`.

### Nested Keys

Use `--` within option names to create nested objects:

```sh
node app.js --database--host localhost --database--port 5432
# config.database => { host: "localhost", port: "5432" }
```

### Short Aliases

Map single-dash shortcuts to long-form options:

```js
new ArgvLoader({
  aliases: {
    '-o': '--output-file',
    '-v': '--verbose'
  }
})
```

```sh
node app.js -o out.txt -v
# config.outputFile => "out.txt", config.verbose => true
```

### Unrecognized Arguments

By default, ArgvLoader prints an error to stderr and exits when it encounters arguments that don't match the value tree (long options) or the aliases map (short options). Control this with the `onUnrecognized` callback:

```js
const { ArgvLoader } = require('appyconfig');

// Default: print to stderr and exit with code 1
new ArgvLoader()  // equivalent to { onUnrecognized: ArgvLoader.EXIT }

// Throw an exception for programmatic handling
new ArgvLoader({ onUnrecognized: ArgvLoader.THROW })
// Catch with: const { UnrecognizedArgumentError } = require('appyconfig')

// Silently ignore (useful when downstream tools process remaining args)
new ArgvLoader({ onUnrecognized: ArgvLoader.IGNORE })

// Custom callback
new ArgvLoader({ onUnrecognized: (arg) => console.warn(`Skipping ${arg}`) })
```

Unrecognized arguments are left in `process.argv` (not consumed).

Long-option recognition requires a populated value tree from prior loaders. When the value tree is empty (no prior loaders), long options are accepted without checking.

### End-of-Options

A bare `--` stops option parsing. Everything after it remains in `process.argv`:

```sh
node app.js --verbose -- file1 file2
# config.verbose => true
# process.argv => ['node', 'app.js', 'file1', 'file2']
```

## Putting It All Together

Here is a realistic example that combines JSON defaults, a `.env` file, environment variables, CLI arguments, and tree locking into a single configuration module.

In `config/defaults.json`:

```json
{
  "host": "localhost",
  "port": 3000,
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "myapp_dev"
  },
  "verbose": false
}
```

In `lib/config.js`:

```js
const {
  ConfigResolver, JsonLoader, DotenvLoader, EnvLoader, ArgvLoader, LOCK
} = require('appyconfig');

const resolver = new ConfigResolver();
const config = resolver.resolveConfig([
  new JsonLoader('config/defaults.json'),   // 1. Start with JSON defaults
  LOCK,                                     // 2. Lock the tree — only these keys allowed
  new DotenvLoader('.env', { allowMissing: true, prefix: 'APP_', stripPrefix: true }),
  new EnvLoader({ prefix: 'APP_', stripPrefix: true }),
  new ArgvLoader({ aliases: { '-v': '--verbose' } })
]);

module.exports = config;
```

In `app.js`:

```js
const config = require('./lib/config');

console.log(config.host);          // from env, .env, or default
console.log(config.database.name); // nested key from JSON, overridable via APP_DATABASE__NAME
console.log(config.verbose);       // flag, toggleable with --verbose or -v
```

Running your app:

```sh
# Use defaults
node app.js

# Override via environment variables
APP_DATABASE__NAME=myapp_prod APP_PORT=8080 node app.js

# Override via CLI arguments
node app.js --port 8080 --database--host db.example.com -v
```

Because the tree is locked after `JsonLoader`, only keys defined in `defaults.json` can be set — stray environment variables are silently ignored, and typos in CLI arguments trigger an error exit by default (see `onUnrecognized` above).

# Advanced Usage

For more control over how each configuration key is resolved, you can define a **configuration tree** that maps each key to its data sources explicitly.

## Configuration Tree

1. Create a configuration tree that declares your configuration sources and options.
2. Call `resolveConfig(loaders, configTree)` to resolve the configuration. The loaders array is required when using a configuration tree.

In `lib/config.js`:

```js
const { resolveConfig, DefaultValueLoader, EnvLoader } = require('appyconfig');

const config_tree = {
  "dbuser": {
    default: "root",
    env: "DB_USERNAME"
  },
  "dbpass": {
    env: "DB_PASSWORD"
  }
}

const config = resolveConfig(
  [new DefaultValueLoader, new EnvLoader],
  config_tree
);

module.exports = config;
```

In `app.js`:

```js
const config = require('./lib/config');

console.log(`Using db user ${config.dbuser}.`);
```

When a configuration tree is provided, each loader looks for its own key in the tree. Key case conversion is not applied in this mode.

### Loader Keys

| Data source | Class | Key | Other considerations |
|--- |--- |--- |--- |
| Default values | DefaultValueLoader | default | Key is value to set |
| Environment variables | EnvLoader | env | Key is the environment variable to fetch |
| CLI arguments (built-in) | ArgvLoader | argv | Key is the CLI option name (without `--`) |
| CLI arguments (Commander) | CmdArgsLoader | cmdArg | Key is the command line option to retrieve |
| JSON file | JsonLoader | *N/A* | Specify filename when instantiating JsonLoader |
| YAML file | YamlLoader | *N/A* | Specify filename when instantiating YamlLoader |
| TOML file | TomlLoader | *N/A* | Specify filename when instantiating TomlLoader |
| .env file | DotenvLoader | dotenv | Specify .env file to load<br>Key is the name of the variable to fetch |

### Default values

A config option with a default value must have a property named "default"
whose value is the default.

### Environment variables

A config option with an environment variable must have a property named "env"
whose value is the name of the environment variable to read.

### Command line arguments

See the ***Commander Example*** below.

### JSON files

Pass an instance of `JsonLoader` alongside your other loaders.
You do not need to add anything to the configuration tree for JSON files.

```js
const config = resolveConfig([new JsonLoader(filename)], config_tree);
```

### YAML files

Similar to JSON files, pass an instance of `YamlLoader`.

### TOML files

Similar to JSON files, pass an instance of `TomlLoader`. TOML datetime values are preserved as `Date` objects.

### Nested Values

If the value object itself contains objects, then it will be treated as a nested option.
This is helpful for organizing your configuration.

```js
const config_tree = {
  "api": {
    "api_key": {
      default: "CLASSIFIED"
    },
    "api_secret": {
      //...
    }
  },

  "db": {
    "username": {
      //...
    },
    "password": {
      //...
    }
  }
}
```

To access your nested config, use dot notation.

```js
const config = require('./lib/config');

console.log(config.api.api_key);  // "CLASSIFIED"
```

### Configuration Values

In the configuration tree, configuration options can be set to values of any type. If the value is not a simple type, then it must be enclosed in an array.

```js
  const config_tree = {
    slogan: {         // String is a simple type
      default: "This is a cool app!"
    },
    logging: {        // Boolean is also a simple type
      default: true
    },
    db: {             // Object is enclosed in an array
      default: [
        { hostname: "localhost", port: 3425}
      ]
    },
    migrations: {     // Array is itself enclosed in an array
      default: [
        ["20210103", "20210224"]
      ]
    }
  };
```

## Customizing the Configuration Resolution Order

When using a configuration tree, you must specify which loaders to use. A common pattern is to use default config values (`DefaultValueLoader`) first, then override with environment variables (`EnvLoader`):

```js
const config = resolveConfig([
  new DefaultValueLoader,
  new EnvLoader
], config_tree);
```

For example, to fill the configuration with null values:

```js
const config = resolveConfig([new NullLoader], config_tree);
```

## Dotenv with Configuration Tree

You can load a specific `.env` file and retrieve values using the `dotenv` key in your configuration tree.

In `.env.production`:

```sh
DB_USERNAME="MyUsername"
DB_PASSWORD="secret"
```

In `lib/config.js`:

```js
const config = resolveConfig([new DotenvLoader("/approot/.env.production")], config_tree);
```

And in the config tree within `lib/config.js`:

```js
const config_tree = {
  "dbuser": {
    dotenv: "DB_USERNAME"
  },
  "dbpass": {
    dotenv: "DB_PASSWORD"
  }
}
```

If you are already parsing environment variables, you can instead load the dotenv file first, then continue to read environment variables with the '`env`' key.

In `lib/config.js`:

```js
const dotenv = require('dotenv').config();
```

## Commander

If you are using Commander, appyconfig utilizes the preAction hook to grab global command line options.

This means the `Command` instance must be passed to `resolveCommander()` so that the hook can be installed. Command-line options will be extracted when the 'preAction' hook is executed (i.e. before actions are run).

### Commander Example

The recommended pattern is: resolve config once at module level, export the `config` object and the `resolver`, and import `config` wherever you need it. The preAction hook updates `config` in place before your action handlers run — no re-resolution needed.

In `lib/config.js`:

```js
const { ConfigResolver, DefaultValueLoader, EnvLoader, CmdArgsLoader } = require('appyconfig');

const config_tree = {
  // The cmdArg key maps to the Commander option name from program.opts().
  mysetting: {
    default: "defaultValue",
    env: "MYSETTING",
    cmdArg: "mySetting" // --my-setting
  },
  anothersetting: {
    default: "the default",
    env: "ANOTHERSETTING",
    cmdArg: "otherSetting" // --other-setting
  }
};

const resolver = new ConfigResolver();
const config = resolver.resolveConfig([
  new DefaultValueLoader,
  new EnvLoader,
  new CmdArgsLoader
], config_tree);

module.exports = { config, resolver };
```

In `app.js`:

```js
const { Command } = require('commander');
const { resolver } = require('./lib/config');

const program = new Command();

// Define your program command line options here...
// Note an action must be run to trigger option parsing.

program.action(() => {
  // You can access config.mysetting here.
});

program.command('subcommand').action(() => {
  // config.mysetting also works in subcommands.
});

// Install the preAction hook
resolver.resolveCommander(program);

program.parse(process.argv);
```

The preAction hook updates `resolver.valueTree` in place — and that is the same object returned by `resolveConfig()`. Any module that imported `config` already has the updated values. Simply `require` the config module wherever you need it:

In `lib/server.js`:

```js
const { config } = require('./config');

console.log(`My setting: ${config.mysetting}`);
```

Do not call `resolveConfig()` again inside an action handler. The preAction hook has already re-resolved the config, so a second call is either redundant or, if done on a different resolver, will miss the CLI values entirely.

To change the option on the command line:

```sh
node app.js --my-setting updated
```

## Overlay Additional Configuration

You can merge additional data sources into an existing configuration by passing a `valueTree` as the third argument to `resolveConfig()`. Pass `null` for the config tree when overlaying in treeless mode.

```js
const { resolveConfig, YamlLoader } = require('appyconfig');

// Initial configuration from environment variables
const config = resolveConfig();

// Later, overlay a user-supplied YAML file onto the existing config
const userConfigFile = process.argv[2];
const updatedConfig = resolveConfig(new YamlLoader(userConfigFile), null, config);
```
