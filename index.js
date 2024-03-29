const { readFileSync } = require('fs');
const { parse: parseJsonc } = require('jsonc-parser');
const dotenv = require('dotenv');
const { ValueLoader, copyKeyedMappingAssignmentStrategy } = require('./lib/valueLoader.js');
const { FileLoader } = require('./lib/fileLoader.js');
const yaml = require('js-yaml');

const stringType = new Object(),
  booleanType = new Object(),
  intType = new Object();

class NotImplementedError extends Error {}


/**
 * @description Simplest mapping possible. Values are always overwritten as null.
 * @returns null
 */
class NullLoader extends ValueLoader {
  mapValue(_cfg, _value) {
    return null;
  }
}

/**
 * @description Use the value in cfg, overriding the current value.
 * @param {*} cfg the value to use from the config tree.
 * @param {*} value the value to overwrite
 * @returns the value to use for the configuration
 */
class DefaultValueLoader extends ValueLoader {
  constructor() {
    super();
    this.mapKey = "default";
  }

  mapValue(cfg, _value) {
    return cfg;
  }
}

/**
 * @description Used to map command line arguments (i.e. Commander options) into the config tree.
 * @description If an appropriate hook has been added to a Commander instance,
 *    find the option in program.opts or program.args.
 * @param {*} cfg - the name of the option to look up.
 * @param {*} value - current value of the value tree
 * @returns the value of the selected command line option if arguments have been parsed, otherwise returns value.
 */
class CmdArgsLoader extends ValueLoader {
  constructor() {
    super();
    this.mapKey = "cmdArg";
  }

  setCommand(newCommand) {
    // the Commander program or subcommand that has parsed options.
    this.command = newCommand;
  }

  mapValue(cfg, value) {
    if (this.command == null) { // Command line args have not been parsed yet.
      return value;
    }

    if (!(this.command.args instanceof Function)) {
      // Top-level program.args is an array, not a function.
      // Also, top-level opts(cfg) always returns the whole options hash.
      if (this.command.opts(cfg)[cfg] != undefined) {
        return this.command.opts(cfg)[cfg];
      } else {
        return value;
      }
    }

    if (this.command.args(cfg) != undefined) {
      return this.command.args(cfg);
    } else if (this.command.opts(cfg) != undefined) {
      return this.command.opts(cfg);
    } else {
      return value;
    }
  }
}

/**
 * @description If the environment variable cfg exists, then use its value,
 *    otherwise keep the current value.
 * @param {*} cfg
 * @param {*} value
 * @returns value of the environment variable if it exists, otherwise value.
 */
class EnvLoader extends ValueLoader {
  constructor() {
    super();
    this.mapKey = "env";
  }

  mapValue(cfg, value) {
    if (process.env[cfg] !== undefined) {
      return process.env[cfg];
    } else {
      return value;
    }
  }
}

class JsonLoader extends FileLoader {
  constructor(filename, suppressExceptions = false) {
    super(filename);
    this.suppressExceptions = suppressExceptions;
  }

  loadValues(_configTree, valueTree) {
    try {
      this.fileData = parseJsonc(readFileSync(this.filename).toString());
    } catch(e) {
      console.log(`exception: ${e}`);
      if(!this.suppressExceptions) {
        throw e;
      }
      this.fileData = {};
    }
    return this.visitTree(this.fileData, valueTree);
  }

  mapValue(cfg, value) {
    if (cfg !== undefined) {
      return cfg;
    } else {
      return value;
    }
  }
}

class DotenvLoader extends FileLoader {
  constructor(filename, suppressExceptions = false) {
    super(filename);
    this.mapKey = "dotenv";
    this.suppressExceptions = suppressExceptions;
    this.assignmentStrategy = copyKeyedMappingAssignmentStrategy.bind(this);
  }

  loadValues(configTree, valueTree) {
    try {
      this.fileData = dotenv.parse(readFileSync(this.filename));
    } catch(e) {
      if(!this.suppressExceptions) {
        throw e;
      }
      this.fileData = {};
    }
    return this.visitTree(configTree, valueTree);
  }

  mapValue(cfg, value) {
    if (this.fileData[cfg] !== undefined) {
      return this.fileData[cfg];
    } else {
      return value;
    }
  }
}

class YamlLoader extends FileLoader {
  constructor(filename, suppressExceptions = false) {
    super(filename);
    this.suppressExceptions = suppressExceptions;
  }

  loadValues(_configTree, valueTree) {
    try {
      this.fileData = yaml.load(readFileSync(this.filename).toString(), 'utf8');
    } catch(e) {
      console.log(`exception: ${e}`);
      if(!this.suppressExceptions) {
        throw e;
      }
      this.fileData = {};
    }
    return this.visitTree(this.fileData, valueTree);
  }

  mapValue(cfg, value) {
    if (cfg !== undefined) {
      return cfg;
    } else {
      return value;
    }
  }
}

class ValidationLoader extends ValueLoader {
  mapValue(_cfg, _value) {
    throw new NotImplemented("ValidationLoader is not yet implemented.");
  }
}

const DEFAULT_MAPPING = [new DefaultValueLoader(), new EnvLoader()];

/**
 * Class to encapsulate the configuration resolution logic for easier testing.
 */
class ConfigResolver {
  constructor() {
    this.resolveMaps = [];
    this.configTree = {};
    this.valueTree = null;
  }

  /**
   * @description Gathers app configuration from various sources and
   *    presents them as a single hash.
   * @param {Object} configTree
   * @param {Array} resolveMaps - array of Loader instances.
   * @param {Object} valueTree - initial value of the config object, defaults to an empty object.
   * @returns configuration values resolved from different sources.
   */
  resolveConfig(configTree, resolveMaps = DEFAULT_MAPPING, valueTree = {}) {
    if (!Array.isArray(resolveMaps)) {
      resolveMaps = [resolveMaps]
    }
    // Save the resolve maps so we can reference them for command line parsing.
    this.resolveMaps = resolveMaps;
    this.configTree = configTree;

    valueTree = resolveMaps.reduce( (innerValueTree, mapping) => {
      if (!(mapping instanceof ValueLoader)) {
        throw new Error("Mapping is not a ValueLoader instance.")
      }
      innerValueTree = mapping.loadValues(configTree, innerValueTree);
      return innerValueTree;
    }, valueTree);

    this.valueTree = valueTree;
    return valueTree ?? {};
  }

  resolveCommander(commandInstance) {
    commandInstance.hook('preAction', (thisCommand, actionCommand) => {
      // There are two possible scenarios when the hook is called.
      // 1) The config is already resolved, minus the command line options.
      //    - get the existing config tree and value tree and resolve immediately.
      // 2) The config has not yet been resolved.
      //    - We cannot continue because we don't have access to the config tree.

      if (this.valueTree === null) {
        throw new Error("resolveCommander() was called before resolveConfig().");
      }

      const cmdArgsLoader = this.resolveMaps.find( (obj) => (obj instanceof CmdArgsLoader));
      if (!cmdArgsLoader) {
        throw new Error("cmdArgsLoader was not found in the configuration resolver order.");
      }

      cmdArgsLoader.setCommand(actionCommand);
      this.valueTree = cmdArgsLoader.loadValues(this.configTree, this.valueTree);
    })
  }
}

let g_configResolver = new ConfigResolver();

module.exports = {
  ConfigResolver,
  resolveConfig: g_configResolver.resolveConfig.bind(g_configResolver),
  resolveCommander: g_configResolver.resolveCommander.bind(g_configResolver),
  DefaultValueLoader, CmdArgsLoader, EnvLoader, ValidationLoader, NullLoader,
  JsonLoader, DotenvLoader, YamlLoader,
  stringType, booleanType, intType
}