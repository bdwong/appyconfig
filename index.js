const { readFileSync } = require('fs');
const path = require('path');
const { parse: parseJsonc } = require('jsonc-parser');
const dotenv = require('dotenv');
const { ValueLoader, copyKeyedMappingAssignmentStrategy } = require('./lib/valueLoader.js');
const { FileLoader } = require('./lib/fileLoader.js');
const yaml = require('js-yaml');
const { convertKeys, CASE_CONVERTERS, splitKey, toCamelCase, toSnakeCase, toKebabCase, toPascalCase, toConstantCase, toFlatCase } = require('./lib/caseConverter.js');
const appRootPath = require('app-root-path');

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

  loadAllValues(valueTree) {
    if (this.command == null) return valueTree;
    const opts = this.command.opts();
    Object.assign(valueTree, opts);
    return valueTree;
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
  constructor(options = {}) {
    super();
    this.mapKey = "env";
    this.prefix = options.prefix || null;
    this.stripPrefix = options.stripPrefix || false;
  }

  mapValue(cfg, value) {
    if (process.env[cfg] !== undefined) {
      return process.env[cfg];
    } else {
      return value;
    }
  }

  loadAllValues(valueTree) {
    for (const key of Object.keys(process.env)) {
      if (this.prefix && !key.startsWith(this.prefix)) continue;
      const outKey = (this.prefix && this.stripPrefix) ? key.slice(this.prefix.length) : key;
      valueTree[outKey] = process.env[key];
    }
    return valueTree;
  }
}

class JsonLoader extends FileLoader {
  constructor(filename, optionsOrSuppressExceptions = false) {
    super(filename);
    if (typeof optionsOrSuppressExceptions === 'boolean') {
      this.suppressExceptions = optionsOrSuppressExceptions;
      this.allowMissing = false;
    } else {
      const options = optionsOrSuppressExceptions;
      this.suppressExceptions = options.suppressExceptions || false;
      this.allowMissing = options.allowMissing || false;
    }
  }

  _shouldSuppress(e) {
    if (this.allowMissing && e.code === 'ENOENT') return true;
    if (this.suppressExceptions) return true;
    return false;
  }

  loadValues(_configTree, valueTree) {
    try {
      this.fileData = parseJsonc(readFileSync(this.filename).toString());
    } catch(e) {
      if(this._shouldSuppress(e)) {
        this.fileData = {};
      } else {
        console.log(`exception: ${e}`);
        throw e;
      }
    }
    return this.visitTree(this.fileData, valueTree);
  }

  loadAllValues(valueTree) {
    return this.loadValues(null, valueTree);
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
  constructor(filename, optionsOrSuppressExceptions = {}) {
    super(filename);
    this.mapKey = "dotenv";
    this.assignmentStrategy = copyKeyedMappingAssignmentStrategy.bind(this);

    if (typeof optionsOrSuppressExceptions === 'boolean') {
      this.suppressExceptions = optionsOrSuppressExceptions;
      this.allowMissing = false;
      this.prefix = null;
      this.stripPrefix = false;
    } else {
      const options = optionsOrSuppressExceptions;
      this.suppressExceptions = options.suppressExceptions || false;
      this.allowMissing = options.allowMissing || false;
      this.prefix = options.prefix || null;
      this.stripPrefix = options.stripPrefix || false;
    }
  }

  _shouldSuppress(e) {
    if (this.allowMissing && e.code === 'ENOENT') return true;
    if (this.suppressExceptions) return true;
    return false;
  }

  loadValues(configTree, valueTree) {
    try {
      this.fileData = dotenv.parse(readFileSync(this.filename));
    } catch(e) {
      if(this._shouldSuppress(e)) {
        this.fileData = {};
      } else {
        throw e;
      }
    }
    return this.visitTree(configTree, valueTree);
  }

  loadAllValues(valueTree) {
    try {
      this.fileData = dotenv.parse(readFileSync(this.filename));
    } catch(e) {
      if(this._shouldSuppress(e)) {
        this.fileData = {};
      } else {
        throw e;
      }
    }
    for (const key of Object.keys(this.fileData)) {
      if (this.prefix && !key.startsWith(this.prefix)) continue;
      const outKey = (this.prefix && this.stripPrefix) ? key.slice(this.prefix.length) : key;
      valueTree[outKey] = this.fileData[key];
    }
    return valueTree;
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
  constructor(filename, optionsOrSuppressExceptions = false) {
    super(filename);
    if (typeof optionsOrSuppressExceptions === 'boolean') {
      this.suppressExceptions = optionsOrSuppressExceptions;
      this.allowMissing = false;
    } else {
      const options = optionsOrSuppressExceptions;
      this.suppressExceptions = options.suppressExceptions || false;
      this.allowMissing = options.allowMissing || false;
    }
  }

  _shouldSuppress(e) {
    if (this.allowMissing && e.code === 'ENOENT') return true;
    if (this.suppressExceptions) return true;
    return false;
  }

  loadValues(_configTree, valueTree) {
    try {
      this.fileData = yaml.load(readFileSync(this.filename).toString(), 'utf8');
    } catch(e) {
      if(this._shouldSuppress(e)) {
        this.fileData = {};
      } else {
        console.log(`exception: ${e}`);
        throw e;
      }
    }
    return this.visitTree(this.fileData, valueTree);
  }

  loadAllValues(valueTree) {
    return this.loadValues(null, valueTree);
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
const DEFAULT_TREELESS_MAPPING = [
  new JsonLoader(path.join(appRootPath.toString(), 'config.json'), { allowMissing: true }),
  new DotenvLoader('.env', { allowMissing: true }),
  new EnvLoader({ prefix: 'APP_', stripPrefix: true })
];

/**
 * Class to encapsulate the configuration resolution logic for easier testing.
 */
class ConfigResolver {
  constructor(options = {}) {
    this.resolveMaps = [];
    this.configTree = null;
    this.valueTree = null;
    this.keyCase = options.keyCase !== undefined ? options.keyCase : 'camelCase';
  }

  /**
   * @description Gathers app configuration from various sources and
   *    presents them as a single hash.
   *
   * Supports multiple calling conventions:
   *   resolveConfig(configTree, resolveMaps, valueTree) — original
   *   resolveConfig(resolveMaps, valueTree)             — no configTree
   *   resolveConfig(resolveMaps)                        — no configTree, default valueTree
   *   resolveConfig()                                   — no configTree, default mapping
   */
  resolveConfig(...args) {
    let configTree = null;
    let resolveMaps = null;
    let valueTree = {};

    if (args.length === 0) {
      // No args: no configTree, default treeless mapping
    } else if (this._isResolveMaps(args[0])) {
      // First arg is loaders — no configTree
      resolveMaps = args[0];
      if (args[1] !== undefined) valueTree = args[1];
    } else {
      // First arg is configTree (plain object) — original behavior
      configTree = args[0];
      if (args[1] !== undefined) resolveMaps = args[1];
      if (args[2] !== undefined) valueTree = args[2];
    }

    // Pick the appropriate default if no loaders were specified.
    if (resolveMaps === null) {
      resolveMaps = configTree === null ? DEFAULT_TREELESS_MAPPING : DEFAULT_MAPPING;
    }

    if (!Array.isArray(resolveMaps)) {
      resolveMaps = [resolveMaps]
    }
    // Save the resolve maps so we can reference them for command line parsing.
    this.resolveMaps = resolveMaps;
    this.configTree = configTree;

    if (configTree === null) {
      // No configTree path: use loadAllValues
      valueTree = resolveMaps.reduce( (innerValueTree, mapping) => {
        if (!(mapping instanceof ValueLoader)) {
          throw new Error("Mapping is not a ValueLoader instance.")
        }
        innerValueTree = mapping.loadAllValues(innerValueTree);
        return innerValueTree;
      }, valueTree);

      if (this.keyCase) {
        const converter = CASE_CONVERTERS[this.keyCase];
        if (converter) {
          valueTree = convertKeys(valueTree, converter);
        }
      }
    } else {
      // Original configTree path: use loadValues
      valueTree = resolveMaps.reduce( (innerValueTree, mapping) => {
        if (!(mapping instanceof ValueLoader)) {
          throw new Error("Mapping is not a ValueLoader instance.")
        }
        innerValueTree = mapping.loadValues(configTree, innerValueTree);
        return innerValueTree;
      }, valueTree);
    }

    this.valueTree = valueTree;
    return valueTree ?? {};
  }

  _isResolveMaps(arg) {
    if (arg instanceof ValueLoader) return true;
    if (Array.isArray(arg) && (arg.length === 0 || arg[0] instanceof ValueLoader)) return true;
    return false;
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

      cmdArgsLoader.setCommand(thisCommand);
      if (this.configTree === null) {
        this.valueTree = cmdArgsLoader.loadAllValues(this.valueTree);
      } else {
        this.valueTree = cmdArgsLoader.loadValues(this.configTree, this.valueTree);
      }

      if (thisCommand !== actionCommand) {
        cmdArgsLoader.setCommand(actionCommand);
        if (this.configTree === null) {
          this.valueTree = cmdArgsLoader.loadAllValues(this.valueTree);
        } else {
          this.valueTree = cmdArgsLoader.loadValues(this.configTree, this.valueTree);
        }
      }
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
  stringType, booleanType, intType,
  convertKeys, CASE_CONVERTERS,
  splitKey, toCamelCase, toSnakeCase, toKebabCase, toPascalCase, toConstantCase, toFlatCase,
}