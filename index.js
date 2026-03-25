const { readFileSync } = require('fs');
const path = require('path');
const { parse: parseJsonc } = require('jsonc-parser');
const dotenv = require('dotenv');
const { ValueLoader, copyKeyedMappingAssignmentStrategy } = require('./lib/valueLoader.js');
const { FileLoader } = require('./lib/fileLoader.js');
const yaml = require('js-yaml');
const { parse: parseToml } = require('smol-toml');
const { convertKeys, CASE_CONVERTERS, splitKey, toCamelCase, toSnakeCase, toKebabCase, toPascalCase, toConstantCase, toFlatCase } = require('./lib/caseConverter.js');
const appRootPath = require('app-root-path');
const { snapshotKeyPaths, pruneNewKeys } = require('./lib/treeLock.js');

// TODO: Implement ValidationLoader to validate value types using these sentinels if needed.
const stringType = new Object(),
  booleanType = new Object(),
  intType = new Object();

const LOCK = new Object();
const UNLOCK = new Object();

class NotImplementedError extends Error {}

class UnrecognizedArgumentError extends Error {
  constructor(arg) {
    super(`Unrecognized argument: ${arg}`);
    this.name = 'UnrecognizedArgumentError';
    this.arg = arg;
  }
}

function setNestedValue(obj, keys, value, originalKey) {
  if (keys.some(k => k === '')) {
    console.warn(`appyconfig: skipping key "${originalKey}" — nested expansion produced an empty key segment`);
    return;
  }
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}


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
    this.expand = options.expand !== undefined ? options.expand : true;
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
      if (this.expand && outKey.includes('__')) {
        setNestedValue(valueTree, outKey.split('__'), process.env[key], outKey);
      } else {
        valueTree[outKey] = process.env[key];
      }
    }
    return valueTree;
  }
}

class JsonLoader extends FileLoader {
  constructor(filename, optionsOrSuppressExceptions = false) {
    super(filename, optionsOrSuppressExceptions);
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
    super(filename, optionsOrSuppressExceptions);
    this.mapKey = "dotenv";
    this.assignmentStrategy = copyKeyedMappingAssignmentStrategy.bind(this);

    if (typeof optionsOrSuppressExceptions === 'boolean') {
      this.prefix = null;
      this.stripPrefix = false;
      this.expand = true;
    } else {
      const options = optionsOrSuppressExceptions;
      this.prefix = options.prefix || null;
      this.stripPrefix = options.stripPrefix || false;
      this.expand = options.expand !== undefined ? options.expand : true;
    }
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
      if (this.expand && outKey.includes('__')) {
        setNestedValue(valueTree, outKey.split('__'), this.fileData[key], outKey);
      } else {
        valueTree[outKey] = this.fileData[key];
      }
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
    super(filename, optionsOrSuppressExceptions);
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

class TomlLoader extends FileLoader {
  constructor(filename, optionsOrSuppressExceptions = false) {
    super(filename, optionsOrSuppressExceptions);
  }

  loadValues(_configTree, valueTree) {
    try {
      this.fileData = parseToml(readFileSync(this.filename).toString());
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

class ArgvLoader extends ValueLoader {
  constructor(options = {}) {
    super();
    this.mapKey = 'argv';
    this.aliases = options.aliases || {};
    this.onUnrecognized = options.onUnrecognized || ArgvLoader.EXIT;
    this.parsed = false;
    this.argv = {};
  }

  _getNestedValue(obj, keys) {
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return current;
  }

  _parse(valueTree, { checkLongOptions = false } = {}) {
    if (this.parsed) return;
    this.parsed = true;

    const args = process.argv;
    const consumedIndices = new Set();
    const hasValueTreeKeys = checkLongOptions && Object.keys(valueTree).length > 0;
    let i = 2;

    while (i < args.length) {
      const arg = args[i];

      // Bare -- sentinel: stop parsing, consume it
      if (arg === '--') {
        consumedIndices.add(i);
        break;
      }

      // Single-dash option
      if (arg.startsWith('-') && !arg.startsWith('--')) {
        if (this.aliases[arg]) {
          // Expand alias and reprocess as long form
          const expanded = this.aliases[arg];
          // Replace in-place for processing, but track original index
          consumedIndices.add(i);
          i++;
          // Process expanded form
          const optName = expanded.replace(/^--/, '');
          const pathSegments = optName.split('--');
          const existingValue = pathSegments.length > 1
            ? this._getNestedValue(valueTree, pathSegments)
            : valueTree[optName];

          let value;
          if (typeof existingValue === 'boolean') {
            value = true;
          } else if (i < args.length && !args[i].startsWith('-')) {
            value = args[i];
            consumedIndices.add(i);
            i++;
          } else {
            value = true;
          }

          if (pathSegments.length > 1) {
            setNestedValue(this.argv, pathSegments, value, optName);
          } else {
            this.argv[optName] = value;
          }
          continue;
        } else {
          this.onUnrecognized(arg);
          i++;
          continue;
        }
      }

      // Long-form option
      if (arg.startsWith('--')) {
        let optName, inlineValue;

        const eqIndex = arg.indexOf('=');
        if (eqIndex !== -1) {
          optName = arg.slice(2, eqIndex);
          inlineValue = arg.slice(eqIndex + 1);
        } else {
          optName = arg.slice(2);
          inlineValue = undefined;
        }

        // Check no- prefix negation
        let isNegation = false;
        let resolvedName = optName;
        if (optName.startsWith('no-')) {
          const nonNegated = optName.slice(3);
          const nonNegatedSegments = nonNegated.split('--');
          const existingValue = nonNegatedSegments.length > 1
            ? this._getNestedValue(valueTree, nonNegatedSegments)
            : valueTree[nonNegated];
          if (typeof existingValue === 'boolean') {
            isNegation = true;
            resolvedName = nonNegated;
          }
        }

        // Check if this long option is recognized
        const pathSegments = resolvedName.split('--');
        if (hasValueTreeKeys) {
          const existingInTree = pathSegments.length > 1
            ? this._getNestedValue(valueTree, pathSegments)
            : valueTree[resolvedName];
          if (existingInTree === undefined) {
            this.onUnrecognized(arg);
            // Skip value if present (don't consume)
            if (inlineValue === undefined && i + 1 < args.length && !args[i + 1].startsWith('-')) {
              i++;
            }
            i++;
            continue;
          }
        }

        consumedIndices.add(i);
        let value;

        if (inlineValue !== undefined) {
          value = inlineValue;
        } else if (isNegation) {
          value = false;
        } else {
          const existingValue = pathSegments.length > 1
            ? this._getNestedValue(valueTree, pathSegments)
            : valueTree[resolvedName];

          if (typeof existingValue === 'boolean') {
            value = true;
          } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            i++;
            value = args[i];
            consumedIndices.add(i);
          } else {
            value = true;
          }
        }

        if (pathSegments.length > 1) {
          setNestedValue(this.argv, pathSegments, value, resolvedName);
        } else {
          this.argv[resolvedName] = value;
        }

        i++;
        continue;
      }

      // Not an option — skip (positional arg)
      i++;
    }

    // Remove consumed indices from process.argv in reverse order
    const sorted = Array.from(consumedIndices).sort((a, b) => b - a);
    for (const idx of sorted) {
      process.argv.splice(idx, 1);
    }
  }

  _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
          && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  _collectArgvKeys(configBranch, valueTree, valueBranch, target) {
    if (configBranch === null || typeof configBranch !== 'object' || Array.isArray(configBranch)) {
      return target;
    }

    if (this.hasSubKeys(configBranch)) {
      for (const key in configBranch) {
        this._collectArgvKeys(configBranch[key], valueTree, valueBranch?.[key], target);
      }
    } else if (configBranch[this.mapKey] !== undefined) {
      const argvKey = configBranch[this.mapKey];
      target[argvKey] = valueBranch !== undefined ? valueBranch : null;
    }

    return target;
  }

  loadValues(configTree, valueTree) {
    const syntheticTree = this._collectArgvKeys(configTree, valueTree, valueTree, {});
    if (Object.keys(syntheticTree).length > 0) {
      this._parse(syntheticTree, { checkLongOptions: true });
    } else {
      this._parse({});
    }
    return super.loadValues(configTree, valueTree);
  }

  loadAllValues(valueTree) {
    this._parse(valueTree, { checkLongOptions: true });
    return this._deepMerge(valueTree, this.argv);
  }

  mapValue(cfg, value) {
    this._parse({});
    if (this.argv[cfg] !== undefined) {
      if (typeof value === 'boolean') {
        if (this.argv[cfg] === true || this.argv[cfg] === 'true') return true;
        if (this.argv[cfg] === false || this.argv[cfg] === 'false') return false;
        return this.argv[cfg];
      }
      return this.argv[cfg];
    }
    return value;
  }
}

ArgvLoader.EXIT = (arg) => {
  process.stderr.write(`Error: unrecognized argument: ${arg}\n`);
  process.exit(1);
};
ArgvLoader.THROW = (arg) => { throw new UnrecognizedArgumentError(arg); };
ArgvLoader.IGNORE = () => {};

const DEFAULT_TREELESS_MAPPING = [
  new JsonLoader(path.join(appRootPath.toString(), 'config.json'), { allowMissing: true }),
  new DotenvLoader('.env', { allowMissing: true }),
  new EnvLoader({ prefix: 'APP_', stripPrefix: true }),
  new ArgvLoader()
];

/**
 * Class to encapsulate the configuration resolution logic for easier testing.
 */
class ConfigResolver {
  static OPTIONS_KEYS = new Set(['prefix']);

  constructor(options = {}) {
    this.resolveMaps = [];
    this.configTree = null;
    this.valueTree = null;
    this.keyCase = options.keyCase !== undefined ? options.keyCase : 'camelCase';
    this.locked = options.locked || false;
  }

  /**
   * @description Gathers app configuration from various sources and
   *    presents them as a single hash.
   *
   * Supports multiple calling conventions:
   *   resolveConfig(resolveMaps, configTree, valueTree) — loaders + configTree + overlay
   *   resolveConfig(resolveMaps, configTree)            — loaders + configTree
   *   resolveConfig(resolveMaps, null, valueTree)       — loaders + overlay (no configTree)
   *   resolveConfig(resolveMaps)                        — loaders only (no configTree)
   *   resolveConfig(options)                            — options hash (no configTree)
   *   resolveConfig()                                   — no configTree, default mapping
   */
  resolveConfig(...args) {
    let configTree = null;
    let resolveMaps = null;
    let valueTree = {};
    let options = {};

    if (args.length === 0) {
      // No args: no configTree, default treeless mapping
    } else if (this._isOptions(args[0])) {
      // First arg is options hash — no configTree, no loaders
      options = args[0];
    } else if (this._isResolveMaps(args[0])) {
      // First arg is loaders
      resolveMaps = args[0];
      if (args[1] != null) configTree = args[1];
      if (args[2] !== undefined) valueTree = args[2];
    } else {
      throw new Error('First argument must be a loader, array of loaders, or options hash');
    }

    // Pick the appropriate default if no loaders were specified.
    if (resolveMaps === null) {
      resolveMaps = Object.keys(options).length > 0
        ? this._buildDefaultTreelessMapping(options)
        : DEFAULT_TREELESS_MAPPING;
    }

    if (!Array.isArray(resolveMaps)) {
      resolveMaps = [resolveMaps]
    }
    // Save the resolve maps so we can reference them for command line parsing.
    this.resolveMaps = resolveMaps;
    this.configTree = configTree;

    if (configTree === null) {
      // No configTree path: use loadAllValues
      valueTree = this._reduceLoaders(resolveMaps, valueTree, (loader, vt) => loader.loadAllValues(vt));

      if (this.keyCase) {
        const converter = CASE_CONVERTERS[this.keyCase];
        if (converter) {
          valueTree = convertKeys(valueTree, converter);
        }
      }
    } else {
      // Original configTree path: use loadValues
      valueTree = this._reduceLoaders(resolveMaps, valueTree, (loader, vt) => loader.loadValues(configTree, vt));
    }

    this.valueTree = valueTree;
    return valueTree ?? {};
  }

  _reduceLoaders(resolveMaps, valueTree, loaderFn) {
    let locked = this.locked || false;
    let snapshot = null;
    if (locked) snapshot = snapshotKeyPaths(valueTree);
    return resolveMaps.reduce((vt, mapping) => {
      if (mapping === LOCK) {
        locked = true;
        snapshot = snapshotKeyPaths(vt);
        return vt;
      }
      if (mapping === UNLOCK) {
        locked = false;
        snapshot = null;
        return vt;
      }
      if (!(mapping instanceof ValueLoader)) {
        throw new Error("Mapping is not a ValueLoader instance.");
      }
      vt = loaderFn(mapping, vt);
      if (locked && snapshot) pruneNewKeys(vt, snapshot);
      return vt;
    }, valueTree);
  }

  _isOptions(arg) {
    if (arg === null || arg === undefined) return false;
    if (typeof arg !== 'object' || Array.isArray(arg)) return false;
    if (arg instanceof ValueLoader) return false;
    const keys = Object.keys(arg);
    if (keys.length === 0) return false;
    return keys.every(k => ConfigResolver.OPTIONS_KEYS.has(k));
  }

  _buildDefaultTreelessMapping(options = {}) {
    const prefix = options.prefix !== undefined ? options.prefix : 'APP_';
    const envOpts = prefix === ''
      ? {}
      : { prefix, stripPrefix: true };
    return [
      new JsonLoader(path.join(appRootPath.toString(), 'config.json'), { allowMissing: true }),
      new DotenvLoader('.env', { allowMissing: true }),
      new EnvLoader(envOpts),
      new ArgvLoader()
    ];
  }

  _isResolveMaps(arg) {
    if (arg instanceof ValueLoader) return true;
    if (arg === LOCK || arg === UNLOCK) return true;
    if (Array.isArray(arg) && (arg.length === 0 ||
        arg[0] instanceof ValueLoader || arg[0] === LOCK || arg[0] === UNLOCK)) return true;
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
  DefaultValueLoader, CmdArgsLoader, EnvLoader, ArgvLoader, NullLoader, UnrecognizedArgumentError,
  JsonLoader, DotenvLoader, YamlLoader, TomlLoader,
  LOCK, UNLOCK,
  stringType, booleanType, intType,
  convertKeys, CASE_CONVERTERS,
  splitKey, toCamelCase, toSnakeCase, toKebabCase, toPascalCase, toConstantCase, toFlatCase,
}