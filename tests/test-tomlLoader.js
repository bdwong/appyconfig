const { describe, it } = require('test');
const assert = require('node:assert/strict');
const path = require('path');
const { TomlLoader } = require('../index');

describe('TomlLoader', () => {
  const tomlFile = path.join(__dirname, 'test.toml');
  const malformedFile = path.join(__dirname, 'malformed.toml');
  const missingFile = path.join(__dirname, 'file.does.not.exist');

  it('loads values from TOML file with correct types', () => {
    const loader = new TomlLoader(tomlFile);
    const result = loader.loadValues({}, {});
    assert.equal(result.configType, 'TOML');
    assert.equal(result.key1.key1a, 'value1a');
    assert.equal(result.key1.keyTrue, true);
    assert.equal(result.key1.keyNumeric, 42);
    assert.equal(result.key2, 'value2');
    assert.equal(result.keyFalse, false);
    assert.equal(result.keyFloat, 2.718);
  });

  it('preserves boolean types', () => {
    const loader = new TomlLoader(tomlFile);
    const result = loader.loadValues({}, {});
    assert.equal(typeof result.key1.keyTrue, 'boolean');
    assert.equal(typeof result.keyFalse, 'boolean');
  });

  it('preserves number types', () => {
    const loader = new TomlLoader(tomlFile);
    const result = loader.loadValues({}, {});
    assert.equal(typeof result.key1.keyNumeric, 'number');
    assert.equal(typeof result.keyFloat, 'number');
  });

  it('preserves Date types from TOML datetime', () => {
    const loader = new TomlLoader(tomlFile);
    const result = loader.loadValues({}, {});
    assert.ok(result.keyDate instanceof Date);
    assert.equal(result.keyDate.toISOString(), '2025-01-15T10:30:00.000Z');
  });

  it('throws by default when file not found', () => {
    const loader = new TomlLoader(missingFile);
    assert.throws(() => loader.loadValues({}, {}), /no such file or directory/);
  });

  it('skips missing file with allowMissing flag', () => {
    const loader = new TomlLoader(missingFile, true);
    assert.doesNotThrow(() => loader.loadValues({}, {}));
  });

  it('throws by default on malformed TOML', () => {
    const loader = new TomlLoader(malformedFile);
    assert.throws(() => loader.loadValues({}, {}));
  });

  it('suppresses exception on malformed TOML with suppressExceptions flag', () => {
    const loader = new TomlLoader(malformedFile, true);
    assert.doesNotThrow(() => loader.loadValues({}, {}));
  });

  it('throws on malformed TOML with only allowMissing', () => {
    const loader = new TomlLoader(malformedFile, { allowMissing: true });
    assert.throws(() => loader.loadValues({}, {}));
  });

  it('loadAllValues delegates to loadValues', () => {
    const loader = new TomlLoader(tomlFile);
    const result = loader.loadAllValues({});
    assert.equal(result.configType, 'TOML');
    assert.equal(result.key1.key1a, 'value1a');
  });
});
