const { describe, it } = require('test');
const assert = require('node:assert/strict');
const path = require('path');
const { JsonLoader } = require('../index');

describe('JsonLoader', () => {
  const jsonFile = path.join(__dirname, 'testconfig.json');
  const jsoncFile = path.join(__dirname, 'testconfig.jsonc');
  const malformedFile = path.join(__dirname, 'malformed.json');
  const missingFile = path.join(__dirname, 'file.does.not.exist');

  it('loads values from JSON file with correct types', () => {
    const loader = new JsonLoader(jsonFile);
    const result = loader.loadValues({}, {});
    assert.equal(result.key1.key1a, 'value1a');
    assert.equal(result.key1.keyTrue, true);
    assert.equal(result.key1.keyNumeric, 10);
    assert.equal(result.key2, 'value2');
    assert.equal(result.keyFalse, false);
    assert.equal(result.keyFloat, 3.14);
  });

  it('loads JSONC file with comments', () => {
    const loader = new JsonLoader(jsoncFile);
    const result = loader.loadValues({}, {});
    assert.equal(result.key1.key1a, 'value1a');
    assert.equal(result.key2, 'value2');
    assert.equal(result.keyFalse, false);
  });

  it('merges onto existing valueTree', () => {
    const loader = new JsonLoader(jsonFile);
    const existing = { existing: 'keep', key2: 'overwrite_me' };
    const result = loader.loadValues({}, existing);
    assert.equal(result.existing, 'keep');
    assert.equal(result.key2, 'value2');
  });

  it('stores parsed data in fileData', () => {
    const loader = new JsonLoader(jsonFile);
    loader.loadValues({}, {});
    assert.notEqual(loader.fileData, null);
    assert.equal(loader.fileData.key2, 'value2');
  });

  it('throws by default when file not found', () => {
    const loader = new JsonLoader(missingFile);
    assert.throws(() => loader.loadValues({}, {}), /no such file or directory/);
  });

  it('suppresses exception with flag when file not found', () => {
    const loader = new JsonLoader(missingFile, true);
    assert.doesNotThrow(() => loader.loadValues({}, {}));
  });

  it('loads nested values (booleans, numbers, floats)', () => {
    const loader = new JsonLoader(jsonFile);
    const result = loader.loadValues({}, {});
    assert.equal(typeof result.key1.keyTrue, 'boolean');
    assert.equal(typeof result.key1.keyNumeric, 'number');
    assert.equal(typeof result.keyFloat, 'number');
  });

  it('returns empty-ish result when suppressed and file missing', () => {
    const loader = new JsonLoader(missingFile, true);
    const result = loader.loadValues({}, {});
    assert.deepEqual(result, {});
  });
});
