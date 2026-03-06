# appyconfig

Read and unify application configuration data from different sources.

# Install

```
npm install appyconfig
```

# Usage

Call `resolveConfig()` to gather configuration from different sources. With no arguments, it loads from `config.json` (if present), `.env` (if present), and `APP_`-prefixed environment variables. Keys are automatically converted to camelCase.

## Basic Example

In `lib/config.js`:

```js
const { resolveConfig } = require('appyconfig');

const config = resolveConfig();

module.exports = config;
```

In `app.js`:

```js
const config = require('./lib/config');

console.log(config.databaseHost); // "localhost"
console.log(config.databasePort); // "5432"
```

Running your app:

```sh
APP_DATABASE_HOST=localhost APP_DATABASE_PORT=5432 node app.js
```

The defaults look for `config.json` and `.env` in your project root (detected via [app-root-path](https://www.npmjs.com/package/app-root-path)), then read `APP_`-prefixed environment variables. Both files are optional and silently skipped if missing. This is equivalent to:

```js
const config = resolveConfig([
  new JsonLoader('config.json', true),  // allowMissing
  new DotenvLoader('.env', { allowMissing: true }),
  new EnvLoader({ prefix: 'APP_', stripPrefix: true })
]);
```

## Multiple Loaders

Pass an array of loaders. Later loaders override earlier ones.

In `lib/config.js`:

```js
const { resolveConfig, EnvLoader, DotenvLoader, JsonLoader, YamlLoader } = require('appyconfig');

const config = resolveConfig([
  new JsonLoader('config/defaults.json'),
  new YamlLoader('config/local.yaml'),
  new DotenvLoader('.env'),
  new EnvLoader({ prefix: 'MYAPP_', stripPrefix: true })
]);

module.exports = config;
```

## Customizing Key Case

By default, keys are converted to camelCase. Use the `ConfigResolver` class to change this.

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

## Prefix Filtering

`EnvLoader` and `DotenvLoader` accept `prefix` and `stripPrefix` options to select and rename keys:

```js
// Only read env vars starting with DB_, and remove the prefix
new EnvLoader({ prefix: 'DB_', stripPrefix: true })
// DB_HOST=localhost  =>  { host: "localhost" }  (after camelCase)

// Only read matching keys from .env file
new DotenvLoader('.env', { prefix: 'DB_', stripPrefix: true })
```

## Data Sources

| Data source | Class | Notes |
|--- |--- |--- |
| Environment variables | EnvLoader | Options: `{ prefix, stripPrefix }` |
| JSON file | JsonLoader | Supports JSONC (comments) |
| YAML file | YamlLoader | |
| .env file | DotenvLoader | Options: `{ prefix, stripPrefix, allowMissing }` |
| Command line arguments | CmdArgsLoader | See Commander section below |

# Advanced Usage

For more control over how each configuration key is resolved, you can define a **configuration tree** that maps each key to its data sources explicitly.

## Configuration Tree

1. Create a configuration tree that declares your configuration sources and options.
2. Call `resolveConfig(configTree)` to resolve the configuration.

In `lib/config.js`:

```js
const { resolveConfig } = require('appyconfig');

const config_tree = {
  "dbuser": {
    default: "root",
    env: "DB_USERNAME"
  },
  "dbpass": {
    env: "DB_PASSWORD"
  }
}

const config = resolveConfig(config_tree);

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
| Command line arguments | CmdArgsLoader | cmdArg | Key is the command line option to retrieve |
| JSON file | JsonLoader | *N/A* | Specify filename when instantiating JsonLoader |
| YAML file | YamlLoader | *N/A* | Specify filename when instantiating YamlLoader |
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
const config = resolveConfig(config_tree, [
  new JsonLoader(filename)
]);
```

### YAML files

Similar to JSON files, pass an instance of `YamlLoader`.

### Nested Values

If the value object itself contains objects, then it will be treated as a nested option.
This is helpful for organizing your configuration.

```js
const config_tree = {
  "api": {
    "api_key": {
      //...
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

By default when running `resolveConfig()` with a configuration tree, appyconfig will use default config values (`DefaultValueLoader`) first, then override those values with environment variables (`EnvLoader`).
This is equivalent to the following code:

```js
const config = resolveConfig(config_tree, [
  new DefaultValueLoader,
  new EnvLoader
]);
```

You can choose to use different sources. For example, to fill the configuration with null values:

```js
const config = resolveConfig(config_tree, [new NullLoader])
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
const config = resolveConfig(config_tree, [new DotenvLoader("/approot/.env.production")]);
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

In `lib/config.js`:

```js
const { ConfigResolver, DefaultValueLoader, EnvLoader, CmdArgsLoader } = require('appyconfig');

const config_tree = {
  // Define your config tree here.
  // The key for parsing command line args is cmdArgs, and it contains
  // the command line option key to retrieve from program.opts().
  mysetting: {
    default: "defaultValue",
    env: "MYSETTING",
    cmdArg: "mySetting" // --my-setting
  }
};

const resolver = new ConfigResolver();
const config = resolver.resolveConfig(config_tree, [
  new DefaultValueLoader,
  new EnvLoader,
  new CmdArgsLoader
]);

module.exports = { config, resolveCommander: resolver.resolveCommander.bind(resolver) };
```

In `app.js`:

```js
const { Command } = require('commander');
const { resolveCommander } = require('./lib/config');

const program = new Command();
resolveCommander(program);

// Note an action must be run to trigger option parsing.
program.action(() => {});

// Set up your program command line options here...

program.parse(process.argv);
```

Using the configuration elsewhere, e.g. in `lib/server.js`:

```js
const { config } = require('./config');

console.log(`My setting: ${config.mysetting}`);
```

To change the option on the command line:

```sh
node app.js --my-setting updated
```

## Overlay Additional Configuration

If you want to merge the resolved configuration object with another data source after the fact, you can call resolveConfig(), passing in the existing configuration object and a new data source. Depending on your data source, you may need a different configuration tree from the one you created in `lib/config.js`.

In `app.js`:

```js
const config = require('./lib/config');
const { program } = require('commander');

// Grab a user configuration file from program arguments.
const userConfigFile = program.args[0];

// YamlLoader does not use the config tree, so it's okay to pass an empty object.
const newConfig = resolveConfig({}, new YamlLoader(userConfigFile), config);

// Do something with newConfig...
```
