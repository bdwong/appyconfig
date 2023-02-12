# appyconfig

Read application configuration data from different sources in a unified way.

Dealing with configuration settings

1. Create an appconfig.sample.json file (JSONC format) that contains application defaults for your configuration.
2. Choose environment variable names to represent settings in your configuration tree.
3. Resolve settings in your config.js as below
4. Require your config.js wherever the config is needed.

```js
// Your lib/config.js
const { resolveConfig } = require('appyconfig');


// Define default values and the environment variables that will override them.
const config_tree = {
  "authorize": {
    "client": {
      "id": ["1234567890", "APP_CLIENT_ID"],
      "secret": ["password123", "APP_CLIENT_SECRET"]
    },
    "auth": {
      "tokenHost": ["default", "APP_AUTH_TOKENHOST"]
    }  
  },
  "app": {
    "hostname": ["localhost", "APP_HOSTNAME"],
    "authorizeCallback": ["https://example.com/authorize", "APP_AUTHORIZE_CALLBACK_URL"],
    "tokenCallback": ["https://example.com/token", "APP_TOKEN_CALLBACK_URL"],
    "oauthScope": ["read", "APP_OAUTH_SCOPE"]
  }
}

// The array is ordered the same as the map_* arguments in the resolve_config call.
// For this example, we only want map_defaults and map_env.

const config_tree = {
  authorize: {
    client: {
      id: ["<client-id>", "APP_CLIENT_ID"],
      secret: ["<client-secret>", "APP_CLIENT_SECRET"],
    },
    auth: {
      tokenHost: ["https://api.oauth.com", "APP_AUTH_TOKENHOST"],
    }  
  },
  app: {
    hostname: ["localhost", "APP_HOSTNAME"],
    authorizeCallback: ["<authorize callback url>", "APP_AUTHORIZE_CALLBACK_URL"],
    tokenCallback: ["<token callback url>", "APP_TOKEN_CALLBACK_URL"],
    oauthScope: ["meeting:write", "APP_OAUTH_SCOPE"],
  }
}

const config = resolve_config(config_tree);

// By default, appyconfig will use default config values (map_defaults) and override those
// values with environment variables (map_env). We can choose to use different sources.
// For example, to fill the configuration with null values:
//
//   const config = resolve_config(config_tree, [mapNull])

module.exports = config;
```


## Commander

For Commander, appyconfig utilizes the preAction hook to grab global command line options.

This means the `Command` instance must be passed to `resolveCommander()` so that the hook can be installed. Command-line options will be extracted when the 'preAction' hook is executed (i.e. before actions are run).

In your `lib/config`

```js
const { ConfigResolver } = require('appyconfig');

const config_tree = { /* Define your config tree here */ };

const resolver = new ConfigResolver();
const config = resolver.resolve_config(config_tree, [mapDefaultValues, mapEnv, mapCommander]);

module.exports = { config, resolveCommander: resolver.resolveCommander };
```

In your app.js

```js
const { Command } = require('commander');
const { resolveCommander } = require('lib/config');

const program = new Command();
resolveCommander(program);

// ...

program.parse(process.argv);
```

And anywhere else you need the configuration:

```js
const { config } = require('lib/config');

// Use the config.
```
