const { ValueLoader } = require('./valueLoader.js');
const util = require('util');

// Copy the values from the source tree to the target tree.
// The File loader does this by default
function copyValueTreeAssignmentStrategy(sourceBranch, valueBranch={}) {
  for(const key in sourceBranch) {
    if(sourceBranch[key] !== null && typeof(sourceBranch[key]) === 'object' && !Array.isArray(sourceBranch[key])) {
      valueBranch[key] = this.assignmentStrategy(sourceBranch[key], valueBranch[key]);
    } else {
      valueBranch[key] = this.mapValue(sourceBranch[key], valueBranch[key]);
    }
  }
  return valueBranch;
}

class FileLoader extends ValueLoader {
  constructor(filename, optionsOrSuppressExceptions = false) {
    super();
    this.filename = filename;
    this.fileData = null;
    this.assignmentStrategy = copyValueTreeAssignmentStrategy.bind(this);

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


  // FileLoader implementation iterates on fileBranch and valueBranch.
  visitTree(fileBranch, valueBranch = {}) {
    return this.assignmentStrategy(fileBranch, valueBranch);
  }

  mapValue(_cfg, _value) {
    throw new NotImplemented("FileLoader is abstract and cannot be mapped.");
  }

  loadValues(_configTree, valueTree) {
    this.fileData = readFileSync(this.filename);
    return this.visitTree(this.fileData, valueTree);
  }
}

module.exports = {
  FileLoader,
}