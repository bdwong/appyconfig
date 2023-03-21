class ValueLoader {
  constructor() {
    this.mapKey = null;
  }

  hasSubKeys(configBranch) {
    return configBranch && Object.keys(configBranch).some( (key) => {
      return configBranch[key] !== null && typeof(configBranch[key]) === 'object' && !Array.isArray(configBranch[key]);
    })
  }

  // Default implementation iterates on configBranch and valueBranch.
  visitTree(configBranch, valueBranch) {
    // Recursion, return end cases.
    if (Array.isArray(configBranch)) {
      return this.mapValue(configBranch[0], valueBranch);
    }
    if (configBranch === null || typeof(configBranch) !== 'object') {
      return this.mapValue(configBranch, valueBranch);
    }

    // Look one level deeper to differentiate subkeys from mapping keys.
    // if contains an object, it's a subkey.
    if (this.hasSubKeys(configBranch)) {
      // Visit subkeys
      valueBranch ??= {};
      for(const key in configBranch) {
        valueBranch[key] = this.visitTree(configBranch[key], valueBranch[key]);
      }
    } else {
      // Perform the config mapping with mapping keys.
      valueBranch = this.visitTree(configBranch[this.mapKey], valueBranch);
    }

    return valueBranch;
  }

  mapValue(_cfg, _value) {
    throw new NotImplemented("ValueLoader is abstract and cannot be mapped.");
  }

  loadValues(configTree, valueTree) {
    return this.visitTree(configTree, valueTree);
  }
}

module.exports = {
  ValueLoader
};