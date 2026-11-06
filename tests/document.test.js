const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  getDocument,
  updateDocument,
  getDocumentHistory,
  syncDocEdit,
  _resetInMemoryDocs,
} = require('../src/controllers/documentController');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
};

describe('Document Controller', () => {
  beforeEach(() => {
    _resetInMemoryDocs();
  });

  test('getDocument returns seeded document for an existing room', async () => {
    const req = { params: { roomId: 'general-hq' } };
    const res = createMockRes();
    await getDocument(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.roomId, 'general-hq');
    assert.ok(res.jsonData.data.content.includes('General Headquarters'));
    assert.equal(res.jsonData.data.version, 1);
  });

  test('getDocument auto-initializes document when room has none', async () => {
    const req = { params: { roomId: 'brand-new-room' } };
    const res = createMockRes();
    await getDocument(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.roomId, 'brand-new-room');
    assert.ok(res.jsonData.data.content.length > 0);
  });

  test('updateDocument updates document content and increments version', async () => {
    const req = {
      params: { roomId: 'general-hq' },
      body: {
        content: '# Updated General HQ Document\n\nAdding real-time specs.',
        author: 'developer-1',
        changeType: 'edit',
      },
    };
    const res = createMockRes();
    await updateDocument(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.content, '# Updated General HQ Document\n\nAdding real-time specs.');
    assert.equal(res.jsonData.data.version, 2);
    assert.equal(res.jsonData.data.lastModifiedBy, 'developer-1');
  });

  test('getDocumentHistory returns change revision trail', async () => {
    // Perform an update first
    const updateReq = {
      params: { roomId: 'general-hq' },
      body: { content: 'Revision 2 content', author: 'jeevan', changeType: 'edit' },
    };
    const updateRes = createMockRes();
    await updateDocument(updateReq, updateRes, () => {});

    const req = { params: { roomId: 'general-hq' } };
    const res = createMockRes();
    await getDocumentHistory(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.ok(res.jsonData.data.length >= 2);
    assert.equal(res.jsonData.version, 2);
    assert.equal(res.jsonData.data[res.jsonData.data.length - 1].author, 'jeevan');
  });

  test('syncDocEdit helper updates doc and returns updated state', async () => {
    const updated = await syncDocEdit('general-hq', 'Direct socket edit content', 'socket-client', 'edit');

    assert.equal(updated.content, 'Direct socket edit content');
    assert.equal(updated.lastModifiedBy, 'socket-client');
    assert.ok(updated.version >= 2);
  });
});
