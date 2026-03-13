const { describe, it, beforeEach, afterEach } = require('test');
const assert = require('node:assert/strict');
const path = require('path');
const { snapshotKeyPaths, pruneNewKeys } = require('../lib/treeLock');
const appy = require('../index');

describe('snapshotKeyPaths', () => {
  it('empty object returns empty Set', () => {
    const result = snapshotKeyPaths({});
    assert.deepEqual(result, new Set());
  });

  it('flat object returns leaf keys', () => {
    const result = snapshotKeyPaths({ a: 1, b: 'hello', c: true });
    assert.deepEqual(result, new Set(['a', 'b', 'c']));
  });

  it('nested object returns dot-delimited paths', () => {
    const result = snapshotKeyPaths({ database: { host: 'x', port: 3000 }, name: 'app' });
    assert.deepEqual(result, new Set(['database.host', 'database.port', 'name']));
  });

  it('deeply nested object returns full paths', () => {
    const result = snapshotKeyPaths({ a: { b: { c: 'val' } } });
    assert.deepEqual(result, new Set(['a.b.c']));
  });

  it('array values treated as leaves', () => {
    const result = snapshotKeyPaths({ items: [1, 2, 3], name: 'test' });
    assert.deepEqual(result, new Set(['items', 'name']));
  });
});

describe('pruneNewKeys', () => {
  it('prunes top-level keys not in snapshot', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const allowed = new Set(['a', 'b']);
    pruneNewKeys(obj, allowed);
    assert.deepEqual(obj, { a: 1, b: 2 });
  });

  it('preserves existing keys', () => {
    const obj = { a: 'new_value', b: 'also_new' };
    const allowed = new Set(['a', 'b']);
    pruneNewKeys(obj, allowed);
    assert.deepEqual(obj, { a: 'new_value', b: 'also_new' });
  });

  it('prunes nested keys not in snapshot', () => {
    const obj = { database: { host: 'localhost', newKey: 'bad' }, port: 3000 };
    const allowed = new Set(['database.host', 'port']);
    pruneNewKeys(obj, allowed);
    assert.deepEqual(obj, { database: { host: 'localhost' }, port: 3000 });
  });

  it('removes empty parent objects after pruning all children', () => {
    const obj = { database: { newKey1: 'bad', newKey2: 'also_bad' }, port: 3000 };
    const allowed = new Set(['port']);
    pruneNewKeys(obj, allowed);
    assert.deepEqual(obj, { port: 3000 });
  });

  it('allows collapsing a branch to a leaf (branch existed)', () => {
    const obj = { database: 'sqlite://local.db' };
    const allowed = new Set(['database.host', 'database.port']);
    pruneNewKeys(obj, allowed);
    assert.deepEqual(obj, { database: 'sqlite://local.db' });
  });

  it('disallows expanding a leaf to a branch (new sub-keys)', () => {
    const obj = { database: { host: 'localhost', port: 3000 } };
    const allowed = new Set(['database']);
    pruneNewKeys(obj, allowed);
    assert.deepEqual(obj, {});
  });

  it('no-op when no new keys', () => {
    const obj = { a: 1, b: { c: 2 } };
    const allowed = new Set(['a', 'b.c']);
    pruneNewKeys(obj, allowed);
    assert.deepEqual(obj, { a: 1, b: { c: 2 } });
  });
});

describe('Tree locking integration', () => {
  it('LOCK prevents new keys from EnvLoader (treeless)', () => {
    const saved = process.env.TL_EXISTING;
    const saved2 = process.env.TL_NEW;
    process.env.TL_EXISTING = 'updated';
    process.env.TL_NEW = 'should_not_appear';
    try {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([
        new appy.EnvLoader({ prefix: 'TL_', stripPrefix: true }),
      ], { EXISTING: 'original' });
      // Without lock, both keys appear
      assert.equal(result.EXISTING, 'updated');
      assert.equal(result.NEW, 'should_not_appear');

      // With lock
      const resolver2 = new appy.ConfigResolver({ keyCase: null });
      const result2 = resolver2.resolveConfig([
        appy.LOCK,
        new appy.EnvLoader({ prefix: 'TL_', stripPrefix: true }),
      ], { EXISTING: 'original' });
      assert.equal(result2.EXISTING, 'updated');
      assert.equal(result2.NEW, undefined);
    } finally {
      if (saved === undefined) delete process.env.TL_EXISTING;
      else process.env.TL_EXISTING = saved;
      if (saved2 === undefined) delete process.env.TL_NEW;
      else process.env.TL_NEW = saved2;
    }
  });

  it('LOCK prevents new keys from JsonLoader (tree-based)', () => {
    const resolver = new appy.ConfigResolver();
    const configTree = { key1: { default: 'val1' } };
    const result = resolver.resolveConfig(configTree, [
      new appy.DefaultValueLoader(),
      appy.LOCK,
      new appy.JsonLoader(path.join(__dirname, 'testconfig.json')),
    ]);
    // key1 should be there (from default), key2 from JSON should be blocked
    assert.equal(result.key1, 'val1');
    assert.equal(result.key2, undefined);
  });

  it('existing keys can be overridden while locked', () => {
    const saved = process.env.TL_HOST;
    process.env.TL_HOST = 'newhost';
    try {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([
        appy.LOCK,
        new appy.EnvLoader({ prefix: 'TL_', stripPrefix: true }),
      ], { HOST: 'oldhost', PORT: '3000' });
      assert.equal(result.HOST, 'newhost');
      assert.equal(result.PORT, '3000');
    } finally {
      if (saved === undefined) delete process.env.TL_HOST;
      else process.env.TL_HOST = saved;
    }
  });

  it('nested existing keys can be overridden while locked', () => {
    const saved = process.env.TL_DB__HOST;
    process.env.TL_DB__HOST = 'newhost';
    try {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([
        appy.LOCK,
        new appy.EnvLoader({ prefix: 'TL_', stripPrefix: true }),
      ], { DB: { HOST: 'oldhost', PORT: '5432' } });
      assert.equal(result.DB.HOST, 'newhost');
      assert.equal(result.DB.PORT, '5432');
    } finally {
      if (saved === undefined) delete process.env.TL_DB__HOST;
      else process.env.TL_DB__HOST = saved;
    }
  });

  it('UNLOCK re-enables new keys', () => {
    const saved = process.env.TL_NEW2;
    process.env.TL_NEW2 = 'appears';
    try {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([
        appy.LOCK,
        appy.UNLOCK,
        new appy.EnvLoader({ prefix: 'TL_NEW2', stripPrefix: true }),
      ], { EXISTING: 'val' });
      // After UNLOCK, new keys are allowed again
      assert.equal(result[''], 'appears');
    } finally {
      if (saved === undefined) delete process.env.TL_NEW2;
      else process.env.TL_NEW2 = saved;
    }
  });

  it('multiple LOCK/UNLOCK cycles', () => {
    const saved = {};
    const vars = ['TL_A', 'TL_B', 'TL_C'];
    vars.forEach(v => { saved[v] = process.env[v]; });
    process.env.TL_A = '1';
    process.env.TL_B = '2';
    process.env.TL_C = '3';
    try {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      // Start with EXISTING, lock, load A (blocked), unlock, load B (allowed), lock, load C (blocked)
      const loaderA = new appy.EnvLoader({ prefix: 'TL_A', stripPrefix: true });
      const loaderB = new appy.EnvLoader({ prefix: 'TL_B', stripPrefix: true });
      const loaderC = new appy.EnvLoader({ prefix: 'TL_C', stripPrefix: true });
      const result = resolver.resolveConfig([
        appy.LOCK,
        loaderA,       // new key '' blocked
        appy.UNLOCK,
        loaderB,       // new key '' allowed
        appy.LOCK,
        loaderC,       // new key '' blocked (already exists from B now)
      ], { EXISTING: 'val' });
      assert.equal(result.EXISTING, 'val');
      // loaderA was blocked, loaderB allowed '' key, loaderC can override ''
      assert.equal(result[''], '3');
    } finally {
      vars.forEach(v => {
        if (saved[v] === undefined) delete process.env[v];
        else process.env[v] = saved[v];
      });
    }
  });

  it('LOCK without UNLOCK keeps locked until end', () => {
    const saved = process.env.TL_EXTRA;
    process.env.TL_EXTRA = 'blocked';
    try {
      const resolver = new appy.ConfigResolver({ keyCase: null });
      const result = resolver.resolveConfig([
        appy.LOCK,
        new appy.EnvLoader({ prefix: 'TL_EXTRA', stripPrefix: true }),
      ], { EXISTING: 'val' });
      assert.equal(result.EXISTING, 'val');
      assert.equal(result[''], undefined);
    } finally {
      if (saved === undefined) delete process.env.TL_EXTRA;
      else process.env.TL_EXTRA = saved;
    }
  });

  it('constructor locked: true option locks from start', () => {
    const saved = process.env.TL_NEW3;
    process.env.TL_NEW3 = 'blocked';
    try {
      const resolver = new appy.ConfigResolver({ keyCase: null, locked: true });
      const result = resolver.resolveConfig([
        new appy.EnvLoader({ prefix: 'TL_NEW3', stripPrefix: true }),
      ], { EXISTING: 'val' });
      assert.equal(result.EXISTING, 'val');
      assert.equal(result[''], undefined);
    } finally {
      if (saved === undefined) delete process.env.TL_NEW3;
      else process.env.TL_NEW3 = saved;
    }
  });

  it('_isResolveMaps recognizes arrays starting with LOCK', () => {
    const resolver = new appy.ConfigResolver();
    assert.equal(resolver._isResolveMaps([appy.LOCK, new appy.EnvLoader()]), true);
    assert.equal(resolver._isResolveMaps([appy.UNLOCK, new appy.EnvLoader()]), true);
    assert.equal(resolver._isResolveMaps(appy.LOCK), true);
    assert.equal(resolver._isResolveMaps(appy.UNLOCK), true);
  });

  it('LOCK and UNLOCK are exported', () => {
    assert.notEqual(appy.LOCK, undefined);
    assert.notEqual(appy.UNLOCK, undefined);
    assert.notEqual(appy.LOCK, appy.UNLOCK);
    assert.equal(typeof appy.LOCK, 'object');
    assert.equal(typeof appy.UNLOCK, 'object');
  });
});
