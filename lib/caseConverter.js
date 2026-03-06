/**
 * Split a string into words on '_', '-', and camelCase boundaries.
 */
function splitKey(str) {
  if (!str) return [];
  // Insert boundary before uppercase letters that follow lowercase or digits
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .split(/[_\-]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}

function toCamelCase(str) {
  const words = splitKey(str);
  if (words.length === 0) return '';
  return words[0] + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

function toSnakeCase(str) {
  return splitKey(str).join('_');
}

function toKebabCase(str) {
  return splitKey(str).join('-');
}

function toPascalCase(str) {
  return splitKey(str).map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

function toConstantCase(str) {
  return splitKey(str).map(w => w.toUpperCase()).join('_');
}

function toFlatCase(str) {
  return splitKey(str).join('');
}

const CASE_CONVERTERS = {
  camelCase: toCamelCase,
  snake_case: toSnakeCase,
  'kebab-case': toKebabCase,
  PascalCase: toPascalCase,
  CONSTANT_CASE: toConstantCase,
  flatcase: toFlatCase,
};

/**
 * Recursively convert all keys in a nested object using converterFn.
 */
function convertKeys(obj, converterFn) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  const result = {};
  for (const key of Object.keys(obj)) {
    const newKey = converterFn(key);
    result[newKey] = convertKeys(obj[key], converterFn);
  }
  return result;
}

module.exports = {
  splitKey,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  toPascalCase,
  toConstantCase,
  toFlatCase,
  CASE_CONVERTERS,
  convertKeys,
};
