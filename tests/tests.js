const { mock, test, describe, beforeEach, it } = require('test');
const assert = require('node:assert/strict');
const appy = require('../index');
const util = require('util');

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
    appy.resolveConfig(configTree0, appy.mapNull),
    {
      key1: {
        key1a: null
      },
      key2: null
    })
})

// test default values
test('mapDefaultValues assigns value to keys', t => {
  assert.deepEqual(
    appy.resolveConfig(configTree0, appy.mapDefaultValues),
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
test('mapEnv assigns environment variables to keys', t => {
  process.env.APPY_TEST_ENV1 = "Environment Value 1";
  process.env.APPY_TEST_ENV2 = "Environment Value 2";
  assert.deepEqual(
    appy.resolveConfig(configTree1, appy.mapEnv),
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
  rootVariable1: [null, "APPY_TEST_ENV_NULL"],
  rootVariable2: [null, "APPY_TEST_ENV_STRING"],
  rootVariable3: ["Root 3 default value", "APPY_TEST_ENV_NULL"],
  rootVariable4: ["Root 4 default value", "APPY_TEST_ENV_STRING"],
  app: {
    appVariable5: [null, "APPY_TEST_ENV_NULL"],
    appVariable6: [null, "APPY_TEST_ENV_STRING"],
    appVariable7: ["Appvar 7 default value", "APPY_TEST_ENV_NULL"],
    appVariable8: ["Appvar 8 default value", "APPY_TEST_ENV_STRING"],
  }
}

// test environment overrides default values
test('second mapping overrides first mapping', t => {
  assert.equal(process.env.APPY_TEST_ENV_NULL, undefined);
  process.env.APPY_TEST_ENV_STRING = "Environment Value String";
  assert.deepEqual(
    appy.resolveConfig(configTree2, [appy.mapDefaultValues, appy.mapEnv]),
    {
      rootVariable1: null,
      rootVariable2: "Environment Value String",
      rootVariable3: "Root 3 default value",
      rootVariable4: "Environment Value String",
      app: {
        appVariable5: null,
        appVariable6: "Environment Value String",
        appVariable7: "Appvar 7 default value",
        appVariable8: "Environment Value String",
      }
    }
  )
})

test.describe('ConfigResolver', async() => {
  let resolver = null;
  let commandCallback;
  const cmdOpts = {opt1: "optvalue1", opt2: "optvalue2"};
  let commandMock = {
    hook: mock.fn((_hook, callback) => {
      commandCallback = callback;
    }),
    args: (name) => (cmdOpts[name]),
    opts: (name) => (cmdOpts[name])
  };

  beforeEach(() => {
    resolver = new appy.ConfigResolver();
    console.log(`resolver(1): ${util.inspect(resolver)}`);
    commandCallback = null;
  })

  describe('mapCommanderArgs', () => {
    it('throws an error if called before resolveConfig', () => {
      console.log(`resolver(2): ${util.inspect(resolver)}`);
      assert.throws(() => {
        resolver.resolveCommander(commandMock);
        // Manually trigger the command callback.
        commandCallback(commandMock, commandMock);
      }, /resolveCommander.. was called before resolveConfig../);
    })

    const configTree3 = {
      key1: {
        key1a: ["value1a", "opt1"]
      },
      key2: ["value2", "opt2"]
    }


    it('throws an error if mapCmdArgs is not in the resolveMaps array', () => {
      console.log(`resolver(3): ${util.inspect(resolver)}`);
      resolver.resolveConfig(configTree3, [appy.mapDefaultValues]);
      assert.throws(() => {
        resolver.resolveCommander(commandMock);
        // Manually trigger the command callback.
        commandCallback(commandMock, commandMock);
      }, /mapCmdArgs was not found/);
    })

    it('maps command line option to value.', () => {
      console.log(`resolver(3): ${util.inspect(resolver)}`);
      let config;
      assert.deepEqual(
        config = resolver.resolveConfig(configTree3, [appy.mapDefaultValues, appy.mapCmdArgs]),
        {
          key1: {
            key1a: "value1a"
          },
          key2: "value2"
        }
      );
      resolver.resolveCommander(commandMock);
      // Manually trigger the command callback.
      commandCallback(commandMock, commandMock);
      assert.deepEqual(
        resolver.valueTree,
        {
          key1: {
            key1a: "optvalue1"
          },
          key2: "optvalue2"
        }
      )
    })
  })
})
