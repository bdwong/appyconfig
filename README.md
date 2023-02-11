# appyconfig

# TODO

Dealing with configuration settings

1. Create an appconfig.sample.json file (JSONC format) that contains application defaults for your configuration.
2. Choose environment variable names to represent settings in your configuration tree.
3. Resolve settings in your config.js as below
4. Require your config.js wherever the config is needed.

```js
// Your lib/config.js
const { resolveConfig, mapDefaultValues, mapCmdArgs, mapEnv,
 } = require('appconfig');


// Defines environment variable names
// These will override any settings found in the config file.
const config_tree = {
  "authorize": {
    "client": {
      "id": "APP_CLIENT_ID",
      "secret": "APP_CLIENT_SECRET"
    },
    "auth": {
      "tokenHost": "APP_AUTH_TOKENHOST"
    }  
  },
  "app": {
    "hostname": "APP_HOSTNAME",
    "authorizeCallback": "APP_AUTHORIZE_CALLBACK_URL",
    "tokenCallback": "APP_TOKEN_CALLBACK_URL",
    "oauthScope": "APP_OAUTH_SCOPE"
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

// We can choose to map options from different sources. In particular, if there is no array, it's a single mapping.

```
const config = resolve_config(config_tree, [map_defaults, map_env]);
```
module.exports = config;
```


## Commander

For Commander, appyconfig utilizes the preAction hook to grab global command line options.

This means the `Command` instance must be passed to `resolveCommander()` so that the hook can be installed. Command-line options will be extracted when the 'preAction' hook is executed (i.e. before actions are run).

In your `lib/config`

```js
const { resolveConfig } = require('appyconfig');

const config = resolve_config(config_tree, [mapDefaultValues, mapEnv, mapCommander]);

module.exports = config;

```

In your app.js

```js
const { Command } = require('commander');
const { resolveCommander } = require('appyconfig');
const config = require('lib/config');

const program = new Command();
resolveCommander(program);

// ...

program.parse(process.argv);
```