const { describe, it } = require('test');
const assert = require('node:assert/strict');
const path = require('path');
const { YamlLoader } = require('../index');

describe('YamlLoader', () => {
  const yamlFile = path.join(__dirname, 'test.yaml');
  const malformedFile = path.join(__dirname, 'malformed.yaml');
  const missingFile = path.join(__dirname, 'file.does.not.exist');

  it('loads values from YAML file with correct types', () => {
    const loader = new YamlLoader(yamlFile);
    const result = loader.loadValues({}, {});
    assert.equal(result.configType, 'YAML');
    assert.equal(result.key1.key1a, 'value1a');
    assert.equal(result.key1.keyTrue, true);
    assert.equal(result.key1.keyNumeric, 42);
    assert.equal(result.key2, 'value2');
    assert.equal(result.keyFalse, false);
    assert.equal(result.keyFloat, 2.718);
  });

  it('preserves boolean types', () => {
    const loader = new YamlLoader(yamlFile);
    const result = loader.loadValues({}, {});
    assert.equal(typeof result.key1.keyTrue, 'boolean');
    assert.equal(typeof result.keyFalse, 'boolean');
  });

  it('preserves number types', () => {
    const loader = new YamlLoader(yamlFile);
    const result = loader.loadValues({}, {});
    assert.equal(typeof result.key1.keyNumeric, 'number');
    assert.equal(typeof result.keyFloat, 'number');
  });

  it('throws by default when file not found', () => {
    const loader = new YamlLoader(missingFile);
    assert.throws(() => loader.loadValues({}, {}), /no such file or directory/);
  });

  it('skips missing file with allowMissing flag', () => {
    const loader = new YamlLoader(missingFile, true);
    assert.doesNotThrow(() => loader.loadValues({}, {}));
  });

  it('throws by default on malformed YAML', () => {
    const loader = new YamlLoader(malformedFile);
    assert.throws(() => loader.loadValues({}, {}));
  });

  it('suppresses exception on malformed YAML with suppressExceptions flag', () => {
    const loader = new YamlLoader(malformedFile, true);
    assert.doesNotThrow(() => loader.loadValues({}, {}));
  });

  it('throws on malformed YAML with only allowMissing', () => {
    const loader = new YamlLoader(malformedFile, { allowMissing: true });
    assert.throws(() => loader.loadValues({}, {}));
  });
});
