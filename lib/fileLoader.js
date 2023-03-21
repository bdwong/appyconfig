const { ValueLoader } = require('./valueLoader.js');

class FileLoader extends ValueLoader {
  constructor(filename) {
    super();
    this.filename = filename;
    this.fileData = null;
  }

  // FileLoader implementation iterates on fileBranch and valueBranch.
  visitTree(fileBranch, valueBranch = {}) {
    for(const key in fileBranch) {
      if(fileBranch[key] !== null && typeof(fileBranch[key]) === 'object' && !Array.isArray(fileBranch[key])) {
        valueBranch[key] = this.visitTree(fileBranch[key], valueBranch[key]);
      } else {
        valueBranch[key] = this.mapValue(fileBranch[key], valueBranch[key]);
      }
    }
    return valueBranch;
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