# appyconfig

Read application configuration data from different sources in a unified way.

# Install

```
npm install appyconfig
```

# Configuration

1. Decide on data sources for your configuration tree.
2. Create a `config.js` file that resolves and exports your configuration.
3. Create a configuration tree that reflects your configuration options and specifies how to get the data from each configuration source.
4. Require your `config.js` wherever the config is needed.

## Data Sources

Examples of data sources are:

  - Hard coded default values
  - Environment variables
  - Command line arguments
  - JSON configuration file

Each of these data sources has a corresponding Loader class, and most have a key that will represent options in the configuration tree.

| Data source | Class | Key | Other considerations |
|--- |--- |--- |--- |
| Default values | DefaultValueLoader | default | Key is value to set |
| Environment variables | EnvLoader | env | Key is the environment variable to fetch |
| Command line arguments | CmdArgsLoader | cmdArg | Key is the command line option to retrieve |
| JSON file | JsonLoader | *N/A* | Specify filename when instantiating JsonLoader |

## Example

In your lib/config.js:

```js
// Require appyconfig.
const { resolveConfig } = require('appyconfig');

// Define default values and the environment variables that will override them.
const config_tree = {
  "authorize": {
    "client": {
      "id": {
        default: "1234567890",
        env: "APP_CLIENT_ID",
      },
      "secret": {
        default: "password123",
        env: "APP_CLIENT_SECRET",
      }
    },
    "auth": {
      "tokenHost": {
        default: "default",
        env: "APP_AUTH_TOKENHOST",
      }
    }
  },
  "app": {
    "hostname": {
      default: "localhost",
      env: "APP_HOSTNAME",
    },
    "authorizeCallback": {
      default: "https://example.com/authorize",
      env: "APP_AUTHORIZE_CALLBACK_URL"
    },
    "tokenCallback": {
      default: "https://example.com/token",
      env: "APP_TOKEN_CALLBACK_URL"
    },
    "oauthScope": {
      default: "read",
      env: "APP_OAUTH_SCOPE"
    }
  }
}

const config = resolve_config(config_tree);

// Export your config.
module.exports = config;
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

In your app.js:

```js
const { Command } = require('commander');
const { resolveCommander } = require('lib/config');

const program = new Command();
resolveCommander(program);

// Set up your program command line options here...

program.parse(process.argv);
```

And anywhere else you need the configuration:

```js
const { config } = require('lib/config');

// Use the config.
```
