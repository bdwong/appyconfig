const { describe, it } = require('test');
const assert = require('node:assert/strict');
const { ValueLoader, copyKeyedMappingAssignmentStrategy } = require('../lib/valueLoader.js');

describe('ValueLoader', () => {
  describe('hasSubKeys()', () => {
    it('returns true when branch contains object values', () => {
      const loader = new ValueLoader();
      assert.equal(loader.hasSubKeys({ a: { nested: 1 } }), true);
    });

    it('returns false for primitive values only', () => {
      const loader = new ValueLoader();
      assert.equal(loader.hasSubKeys({ a: 'string', b: 42 }), false);
    });

    it('returns false for null values', () => {
      const loader = new ValueLoader();
      assert.equal(loader.hasSubKeys({ a: null }), false);
    });

    it('returns false for empty object', () => {
      const loader = new ValueLoader();
      assert.equal(loader.hasSubKeys({}), false);
    });

    it('returns false when values are arrays', () => {
      const loader = new ValueLoader();
      assert.equal(loader.hasSubKeys({ a: [1, 2, 3] }), false);
    });
  });

  describe('mapValue()', () => {
    it('throws because ValueLoader is abstract', () => {
      const loader = new ValueLoader();
      assert.throws(() => loader.mapValue('x', 'y'));
    });
  });

  describe('copyKeyedMappingAssignmentStrategy', () => {
    it('unwraps array-wrapped objects and calls mapValue', () => {
      const loader = new ValueLoader();
      loader.mapKey = 'default';
      loader.mapValue = (cfg, _value) => cfg;
      const result = loader.visitTree({ key: { default: [{ inner: true }] } }, {});
      assert.deepEqual(result, { key: { inner: true } });
    });

    it('recurses into sub-keys when branch has object children', () => {
      const loader = new ValueLoader();
      loader.mapKey = 'default';
      loader.mapValue = (cfg, _value) => cfg;
      const configTree = {
        level1: {
          level2: {
            default: 'deep'
          }
        }
      };
      assert.deepEqual(loader.visitTree(configTree, {}), { level1: { level2: 'deep' } });
    });

    it('maps leaf nodes using mapKey', () => {
      const loader = new ValueLoader();
      loader.mapKey = 'default';
      loader.mapValue = (cfg, _value) => cfg;
      const configTree = { key: { default: 'val' } };
      assert.deepEqual(loader.visitTree(configTree, {}), { key: 'val' });
    });
  });
});
