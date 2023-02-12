const util = require('util');

const stringType = new Object(),
  booleanType = new Object(),
  intType = new Object();

class NotImplementedError extends Error {}

/**
 * @description Simplest mapping possible. Values are always overwritten as null.
 * @returns null
 */
function mapNull(_cfg, _value) { return null }

/**
 * @description Use the value in cfg, overriding the current value.
 * @param {*} cfg the value to use from the config tree.
 * @param {*} value the value to overwrite
 * @returns the value to use for the configuration
 */
function mapDefaultValues(cfg, _value) { return cfg }

/**
 * @description Dummy function whose name is used in the config tree when mapping Commander options.
 * @param {*} _cfg - name of the option to look up
 * @param {*} value - value to return
 * @returns value
 */
function mapCmdArgs(_cfg, value) {
  return value;
}

/**
 * @description If the environment variable cfg exists, then use its value,
 *    otherwise keep the current value.
 * @param {*} cfg
 * @param {*} value
 * @returns value of the environment variable if it exists, otherwise value.
 */
function mapEnv(cfg, value) {
  if (process.env[cfg] !== undefined) {
    return process.env[cfg];
  } else {
    return value;
  }
}

function mapValidation(cfg, value) {  throw new NotImplementedError() }

const DEFAULT_MAPPING = [mapDefaultValues, mapEnv];

/**
 * @description Visit every key in the config tree and value tree in parallel.
 *              Perform a task if its value is a leaf node.
 * @param {*} branch : current branch/node of the tree
 * @param {*} task : task to execute on the node
 * @returns a new tree transformed by task.
 */
function visitTree([configBranch, valueBranch, index], taskFn) {
  for(const key of Object.keys(configBranch)) {
    if (Array.isArray(configBranch[key])) {
      valueBranch[key] = taskFn(configBranch[key][index], valueBranch[key]);
    } else {
      valueBranch[key] = visitTree([configBranch[key], valueBranch[key] ?? {}, index], taskFn);
    }
  }
  return valueBranch;
}


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
   * @description If an appropriate hook has been added to a Commander instance,
   *    find the option in program.opts or program.args.
   * @param {*} command - the Commander program or subcommand that has parsed options.
   * @param {*} cfg - the name of the option to look up.
   * @param {*} value - current value of the value tree
   * @returns the value of the selected command line option
   */
  mapCommanderArgs(command, cfg, value) {
    if (this.valueTree == null) { // This should never happen.
      throw new Error(
        "mapCommanderArgs() called during config resolver stage.\n" +
        "Do not specify mapCommanderArgs in the config tree directly."
      );
    }

    if (command.args(cfg)) {
      return command.args(cfg);
    } else if (command.opts(cfg)) {
      return command.opts(cfg);
    } else {
      return value;
    }
  }

  /**
   * @description Gathers app configuration from various sources and
   *    presents them as a single hash.
   * @param {*} configTree
   * @param {*} resolveMaps
   * @returns configuration values resolved from different sources.
   */
  resolveConfig(configTree, resolveMaps = DEFAULT_MAPPING) {
    let valueTree = {};
    if (!Array.isArray(resolveMaps)) {
      resolveMaps = [resolveMaps]
    }
    // Save the resolve maps so we can reference them for command line parsing.
    this.resolveMaps = resolveMaps;
    this.configTree = configTree;

    valueTree = resolveMaps.reduce( (innerValueTree, mapping, index) => {
      innerValueTree = visitTree([configTree, innerValueTree, index], mapping);
      return innerValueTree;
    }, valueTree);

    this.valueTree = valueTree;
    return valueTree;
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

      let index = this.resolveMaps.indexOf(mapCmdArgs);
      if (index === -1) {
        // Cannot continue without access to the config elements for mapCmdArgs.
        throw new Error("mapCmdArgs was not found in the configuration resolver order.");
      }

      this.valueTree = visitTree(
        [this.configTree, this.valueTree, index],
        // Partial application of function mapCommanderArgs in place of mapCmdArgs,
        // to pass in actionCommand for opts and args.
        this.mapCommanderArgs.bind(this, actionCommand)
      );
    })
  }
}

let g_configResolver = new ConfigResolver();

module.exports = {
  ConfigResolver,
  resolveConfig: g_configResolver.resolveConfig,
  resolveCommander: g_configResolver.resolveCommander,
  mapDefaultValues, mapCmdArgs, mapEnv, mapValidation, mapNull,
  stringType, booleanType, intType
}