const { mock, test, describe, beforeEach, it } = require('test');
const assert = require('node:assert/strict');
const appy = require('../index');
const path = require('path');

test('resolveConfig exists', t => {
  assert.notEqual(appy.resolveConfig, undefined);
})

test('empty tree returns empty hash', t => {
  assert.deepEqual(appy.resolveConfig({}), {});
})

const configTree0 = {
  key1: {
    key1a: {
      default: "value1a"
    }
  },
  key2: {
    default: "value2"
  }
}

test('null map returns keys only', {only: true}, t => {
  assert.deepEqual(
    appy.resolveConfig(configTree0, new appy.NullLoader),
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
    appy.resolveConfig(configTree0, new appy.DefaultValueLoader),
    {
      key1: {
        key1a: "value1a"
      },
      key2: "value2"
    })
})

test ('resolveConfig and mapDefaultValues can overlay two different config trees', t => {
  const config1 = appy.resolveConfig({key1: {default: 'value1'}}, new appy.DefaultValueLoader);
  assert.deepEqual(
    config1,
    { key1: "value1" }
  );
  const config2 = appy.resolveConfig({key2: {default: 'value2'}}, new appy.DefaultValueLoader, config1);
  assert.deepEqual(
    config2, {
      key1: "value1",
      key2: "value2",
    }
  );

})

const configTree1 = {
  root_variable1: {
    env: "APPY_TEST_ENV1"
  },
  app: {
    variable2: {
      env: "APPY_TEST_ENV2",
    },
    variable3: {
      env: ["APPY_TEST_ENV3"]
    }
  }
}

// test environment variables
test('mapEnv assigns environment variables to keys', t => {
  process.env.APPY_TEST_ENV1 = "Environment Value 1";
  process.env.APPY_TEST_ENV2 = "Environment Value 2";
  assert.deepEqual(
    appy.resolveConfig(configTree1, new appy.EnvLoader),
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
  rootVariable1: {
    default: null,
    env: "APPY_TEST_ENV_NULL",
  },
  rootVariable2: {
    default: null,
    env: "APPY_TEST_ENV_STRING",
  },
  rootVariable3: {
    default: "Root 3 default value",
    env: "APPY_TEST_ENV_NULL",
  },
  rootVariable4: {
    default: "Root 4 default value",
    env: "APPY_TEST_ENV_STRING",
  },
  app: {
    appVariable5: {
      default: null,
      env: "APPY_TEST_ENV_NULL",
    },
    appVariable6: {
      default: null,
      env: "APPY_TEST_ENV_STRING",
    },
    appVariable7: {
      default: "Appvar 7 default value",
      env: "APPY_TEST_ENV_NULL",
    },
    appVariable8: {
      default: "Appvar 8 default value",
      env: "APPY_TEST_ENV_STRING",
    },
  }
}

// test environment overrides default values
test('second mapping overrides first mapping', t => {
  assert.equal(process.env.APPY_TEST_ENV_NULL, undefined);
  process.env.APPY_TEST_ENV_STRING = "Environment Value String";
  assert.deepEqual(
    appy.resolveConfig(configTree2, [new appy.DefaultValueLoader, new appy.EnvLoader]),
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
  const cmdOpts = {opt1: "optvalue1", opt2: "optvalue2", optFalse: false};
  let commandMock = {
    hook: mock.fn((_hook, callback) => {
      commandCallback = callback;
    }),
    args: (name) => (cmdOpts[name]),
    opts: (name) => (cmdOpts[name])
  };
  let programMock = {
    hook: mock.fn((_hook, callback) => {
      commandCallback = callback;
    }),
    args: [],
    opts: (name) => (cmdOpts)
  }

  beforeEach(() => {
    resolver = new appy.ConfigResolver();
    commandCallback = null;
  })

  describe('mapCommanderArgs', () => {
    it('throws an error if called before resolveConfig', () => {
      assert.throws(() => {
        resolver.resolveCommander(commandMock);
        // Manually trigger the command callback.
        commandCallback(commandMock, commandMock);
      }, /resolveCommander.. was called before resolveConfig../);
    })

    const configTree3 = {
      key1: {
        key1a: {
          default: "value1a",
          cmdArg: "opt1",
        }
      },
      key2: {
        default: "value2",
        cmdArg: "opt2",
      },
      key3: {
        default: true,
        cmdArg: "optFalse",
      },
    }


    it('throws an error if mapCmdArgs is not in the resolveMaps array', () => {
      resolver.resolveConfig(configTree3, [new appy.DefaultValueLoader]);
      assert.throws(() => {
        resolver.resolveCommander(commandMock);
        // Manually trigger the command callback.
        commandCallback(commandMock, commandMock);
      }, /cmdArgsLoader was not found/);
    })

    it('maps command line option to value.', () => {
      let config;
      assert.deepEqual(
        config = resolver.resolveConfig(configTree3, [new appy.DefaultValueLoader, new appy.CmdArgsLoader]),
        {
          key1: {
            key1a: "value1a"
          },
          key2: "value2",
          key3: true,
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
          key2: "optvalue2",
          key3: false
        }
      )
    })

    it('maps global command line option to value.', () => {
      let config;
      assert.deepEqual(
        config = resolver.resolveConfig(configTree3, [new appy.DefaultValueLoader, new appy.CmdArgsLoader]),
        {
          key1: {
            key1a: "value1a"
          },
          key2: "value2",
          key3: true
        }
      );
      resolver.resolveCommander(programMock);
      // Manually trigger the command callback.
      commandCallback(programMock, programMock);
      assert.deepEqual(
        resolver.valueTree,
        {
          key1: {
            key1a: "optvalue1"
          },
          key2: "optvalue2",
          key3: false
        }
      )
    })
  })
})


// test JSON file loader
describe('JsonLoader', () => {
  it('assigns values to keys', () => {
    assert.deepEqual(
      appy.resolveConfig(configTree0, new appy.JsonLoader(path.join(__dirname, "testconfig.json")) ),
      {
        key1: {
          key1a: "value1a",
          keyTrue: true,
          keyNumeric: 10,
        },
        key2: "value2",
        keyFalse: false,
        keyFloat: 3.14,
      }
    );
  });

  it('raises an exception when file is not found', () => {
    assert.throws(() => {
      appy.resolveConfig(configTree0, new appy.JsonLoader(path.join(__dirname, "file.does.not.exist")) )
    }, /no such file or directory/);
  });

  it('suppresses file not found exception when suppress flag is true', () => {
    assert.doesNotThrow(() => {
      assert.deepEqual(
        appy.resolveConfig(configTree0, new appy.JsonLoader(path.join(__dirname, "file.does.not.exist"), true) ),
        {}
      );
    }, /no such file or directory/);
  });
});

const configTree4 = {
  values: {
    key1: {
      "dotenv": "TEST_ENVKEY"
    },
    key2: {
      "dotenv": "TEST_ENVKEY2"
    }
  }
}

describe('DotenvLoader', () => {
  it('assigns values to keys', () => {
    assert.deepEqual(
      appy.resolveConfig(configTree4, new appy.DotenvLoader(path.join(__dirname, "test.env")) ),
      {
        values: {
          key1: "myenv value",
          key2: "1234"
        }
      }
    );
  });
});

describe('YamlLoader', () => {
  it('assigns values to keys', () => {
    assert.deepEqual(
      appy.resolveConfig(configTree4, new appy.YamlLoader(path.join(__dirname, "test.yaml")) ),
      {
        configType: 'YAML',
        key1: {
          key1a: 'value1a',
          keyTrue: true,
          keyNumeric: 42,
        },
        key2: 'value2',
        keyFalse: false,
        keyFloat: 2.718,
      }
    )
  })

});