const util = require('util');

const stringType = new Object(),
  booleanType = new Object(),
  intType = new Object();

class NotImplementedError extends Error {}

/**
 * @description Simplest mapping possible. Values are always overwritten as null.
 * @returns null
 */
function mapNull(cfg, value) { return null }

/**
 * @description Use the value in cfg, overriding the current value.
 * @param {*} cfg the value to use from the config tree.
 * @param {*} value the value to overwrite
 * @returns the value to use for the configuration
 */
function mapDefaultValues(cfg, value) { return cfg }

/**
 * @description If an appropriate hook has been added to a Commander instance,
 *    find the option in program.opts or program.args.
 * @param {*} cfg - the name of the option to look up.
 * @param {*} value 
 * @returns the selected command line option
 */
function mapCmdArgs(cfg, value) { throw new NotImplementedError() }

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
 * 
 * @param {*} configTree 
 * @param {*} resolveMaps 
 * @returns 
 */
function resolveConfig(configTree, resolveMaps = DEFAULT_MAPPING) {
  let valueTree = {};
  if (!Array.isArray(resolveMaps)) {
    resolveMaps = [resolveMaps]
  }
  valueTree = resolveMaps.reduce(function(innerValueTree, mapping, index){
    innerValueTree = visitTree([configTree, innerValueTree, index], mapping);
    return innerValueTree;
  }, valueTree);

  return valueTree;
}

module.exports = {
  resolveConfig, mapDefaultValues, mapCmdArgs, mapEnv, mapValidation, mapNull,
  stringType, booleanType, intType
}