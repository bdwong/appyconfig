# appyconfig

Read and unify application configuration data from different sources.

# Install

```
npm install appyconfig
```

# Configuration

1. Create a configuration tree in `config.js` that declares your configuration sources and options.
2. Call `resolve_config()` to resolve the configuration.
3. Require/import your `config.js` wherever the config is needed.

## Example

In your lib/config.js:

```js
const { resolveConfig } = require('appyconfig');

// Define default values and the environment variables that will override them.
const config_tree = {
  "dbuser": {
    default: "root",
    env: "DB_USERNAME"
  },
  "dbpass": {
    env: "DB_PASSWORD"
  }
}

const config = resolve_config(config_tree);

// Export your config.
module.exports = config;
```

Now require 'lib/config' from your app to get the global configuration.

```js
const config = require('lib/config');

console.log(`Using db user #{config.dbuser}.`);
```

## Data Sources

Examples of data sources are:

  - Hard coded default values
  - Environment variables
  - Command line arguments
  - YAML or JSON configuration file

Each of these data sources has a corresponding Loader class, and most have a key that will represent options in the configuration tree.

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

To read from JSON files, you will need to instantiate a new `ConfigResolver` and pass an instance of `JsonLoader`.
The file will be read and the configuration will be merged in the order you provide to the ConfigResolver.

You do not need to add anything to the configuration tree for JSON files.

In `config.js`:

```
const config = resolve_config(config_tree, [
  new JsonLoader(filename) // file to read.
]);

module.exports = config;
```

### YAML files

Similar to JSON files, you will need to instantiate a new `ConfigResolver` and pass an instance of `YamlLoader`.

## Configuration tree structure

Appyconfig expects the configuration tree to be an object with properties, where
each property name is the name of the configuration option and its value is
an object containing the parameters to use for different data sources.

### Nested Values

If the value object itself contains objects, then it will be treated as a nested option.
This is helpful for organizing your configuration.

```js
// Nested values example
const config_tree = {
  "api": {  // api options
    "api_key": {
      //...
    },
    "api_secret": {
      //...
    }
  },

  "db": {   // database options
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
    }
    migrations: {     // Array is itself enclosed in an array
      default: [
        ["20210103", "20210224"]
      ]
    }
  };
```

## Customizing the Configuration Resolution Order

By default when running `resolve_config()`, appyconfig will use default config values (`DefaultValueLoader`) first, then override those values with environment variables (`EnvLoader`).
This is equivalent to the following code:

```js
const config = resolve_config(config_tree, [
  new DefaultValueLoader,
  new EnvLoader
]);
```

You can choose to use different sources. For example, to fill the configuration with null values:

```js
const config = resolve_config(config_tree, [new NullLoader])
```

## Dotenv

You can load a specific `.env ` file and retrieve values in the same way that you retrieve environment variables.

```sh
# dotenv file
DB_USERNAME="MyUsername"
DB_PASSWORD="secret"
```

In your config.js:

```js
const config = resolve_config(config_tree, [new DotenvLoader("/approot/.env.production")]);
```

And in your config tree:

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

If you are already parsing environment variables, you can instead load the dotenv file first, then continue to read environment variables with the '`env`' key. In config.js:

```js
const dotenv = require('dotenv').config();
```

## Commander

If you are using Commander, appyconfig utilizes the preAction hook to grab global command line options.

This means the `Command` instance must be passed to `resolveCommander()` so that the hook can be installed. Command-line options will be extracted when the 'preAction' hook is executed (i.e. before actions are run).

### Commander Example

In your `lib/config`:

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
const config = resolver.resolve_config(config_tree, [
  new DefaultValueLoader,
  new EnvLoader,
  new CmdArgsLoader
]);

module.exports = { config, resolveCommander: resolver.resolveCommander };
```

In `app.js`:

```js
const { Command } = require('commander');
const { resolveCommander } = require('lib/config');

const program = new Command();
resolveCommander(program);

// Set up your program command line options here...

program.parse(process.argv);
```

Using the configuration:

```js
const { config } = require('lib/config');

console.log(`My setting: ${config.mysetting}`);
```

To change the option on the command line:

```sh
node app.js --my-setting updated
```

## Overlay Additional Configuration

If you want to merge the resolved configuration object with another data source after the fact, you can call resolveConfig(), passing in the existing configuration object and a new data source. Depending on your data source, you may need a different configuration tree from the one you created in `lib/config.js`:

```js
const config = require('lib/config');
const { program } = require('commander');

// Grab a user configuration file from program arguments.
const userConfigFile = program.args[0];

// YamlLoader does not use the config tree, so it's okay to pass an empty object.
const newConfig = resolve_config({}, new YamlLoader(userConfigFile), config);

// Do something with newConfig...
```
