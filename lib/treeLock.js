/**
 * Recursively collect all leaf key paths as a Set of dot-delimited strings.
 * Arrays and non-plain-object values are treated as leaves.
 */
function snapshotKeyPaths(obj, prefix = '') {
  const paths = new Set();
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? prefix + '.' + key : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      for (const p of snapshotKeyPaths(val, fullPath)) {
        paths.add(p);
      }
    } else {
      paths.add(fullPath);
    }
  }
  return paths;
}

/**
 * Recursively prune keys from obj that are not in allowedPaths.
 * A leaf is kept if its path exactly matches an allowed path, or if some
 * allowed path starts with path + '.' (collapsing a branch to a leaf).
 * Expanding a leaf to a branch (obj has sub-keys where snapshot had a leaf) is not allowed.
 */
function pruneNewKeys(obj, allowedPaths, prefix = '') {
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? prefix + '.' + key : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      // Check if this branch path was a leaf in the snapshot — if so, it's
      // being expanded (leaf→branch), which is not allowed.
      if (allowedPaths.has(fullPath)) {
        delete obj[key];
        continue;
      }
      pruneNewKeys(val, allowedPaths, fullPath);
      // Remove empty parent after pruning children
      if (Object.keys(val).length === 0) {
        delete obj[key];
      }
    } else {
      // Leaf: keep if exact match or if collapsing a branch (some allowed path starts with fullPath + '.')
      if (allowedPaths.has(fullPath)) continue;
      let branchExists = false;
      for (const p of allowedPaths) {
        if (p.startsWith(fullPath + '.')) {
          branchExists = true;
          break;
        }
      }
      if (!branchExists) {
        delete obj[key];
      }
    }
  }
}

module.exports = { snapshotKeyPaths, pruneNewKeys };
