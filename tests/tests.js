const test = require('test');
const assert = require('node:assert/strict');
const appy = require('../index');

test('resolveConfig exists', t => {
  assert.notEqual(appy.resolveConfig, undefined);
})

test('empty tree returns empty hash', t => {
  assert.deepEqual(appy.resolveConfig({}), {});
})

const configTree0 = {
  key1: {
    key1a: ["value1a"]
  },
  key2: ["value2"]
}

test('null map returns keys only', t => {
  assert.deepEqual(
    appy.resolveConfig(configTree0, [appy.mapNull]),
    {
      key1: {
        key1a: null
      },
      key2: null
    })
})

// test default values
test('defaults map assigns value to keys', t => {
  assert.deepEqual(
    appy.resolveConfig(configTree0, [appy.mapDefaultValues]),
    {
      key1: {
        key1a: "value1a"
      },
      key2: "value2"
    })
})

const configTree1 = {
  root_variable1: ["APPY_TEST_ENV1"],
  app: {
    variable2: ["APPY_TEST_ENV2"],
    variable3: ["APPY_TEST_ENV3"],
  }
}

// test environment variables
test('assigns environment variables to keys', t => {
  process.env.APPY_TEST_ENV1 = "Environment Value 1";
  process.env.APPY_TEST_ENV2 = "Environment Value 2";
  assert.deepEqual(
    appy.resolveConfig(configTree1, [appy.mapEnv]),
    {
      root_variable1: "Environment Value 1",
      app: {
        variable2: "Environment Value 2",
        variable3: undefined
      }  
    }
  )
})

const configTree2 = {
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

// test environment overrides default values
