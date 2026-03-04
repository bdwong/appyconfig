const { describe, it } = require('test');
const assert = require('node:assert/strict');
const path = require('path');
const { DotenvLoader } = require('../index');

describe('DotenvLoader', () => {
  const envFile = path.join(__dirname, 'test.env');
  const missingFile = path.join(__dirname, 'file.does.not.exist');

  it('has mapKey set to "dotenv"', () => {
    const loader = new DotenvLoader(envFile);
    assert.equal(loader.mapKey, 'dotenv');
  });

  it('uses keyed mapping strategy (not file tree strategy)', () => {
    const { copyKeyedMappingAssignmentStrategy } = require('../lib/valueLoader.js');
    const loader = new DotenvLoader(envFile);
    // The assignmentStrategy should be the keyed mapping one, bound to the loader
    // We verify by checking it works with a configTree that has dotenv keys
    const result = loader.loadValues({
      values: {
        key1: { dotenv: 'TEST_ENVKEY' }
      }
    }, {});
    assert.deepEqual(result, { values: { key1: 'myenv value' } });
  });

  it('maps .env keys to config tree via dotenv mapping key', () => {
    const loader = new DotenvLoader(envFile);
    const result = loader.loadValues({
      values: {
        key1: { dotenv: 'TEST_ENVKEY' },
        key2: { dotenv: 'TEST_ENVKEY2' }
      }
    }, {});
    assert.deepEqual(result, {
      values: {
        key1: 'myenv value',
        key2: '1234'
      }
    });
  });

  it('returns current value when dotenv key is missing', () => {
    const loader = new DotenvLoader(envFile);
    const result = loader.loadValues({
      key: { dotenv: 'NONEXISTENT_KEY' }
    }, { key: 'original' });
    assert.deepEqual(result, { key: 'original' });
  });

  it('throws by default when file not found', () => {
    const loader = new DotenvLoader(missingFile);
    assert.throws(() => loader.loadValues({}, {}), /no such file or directory/);
  });

  it('suppresses exception with flag when file not found', () => {
    const loader = new DotenvLoader(missingFile, true);
    assert.doesNotThrow(() => loader.loadValues({}, {}));
  });

  it('stores parsed data in fileData after loading', () => {
    const loader = new DotenvLoader(envFile);
    loader.loadValues({ key: { dotenv: 'TEST_ENVKEY' } }, {});
    assert.notEqual(loader.fileData, null);
    assert.equal(loader.fileData['TEST_ENVKEY'], 'myenv value');
  });
});
