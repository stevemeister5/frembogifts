const assert = require('node:assert/strict');
const test = require('node:test');
const app = require('../server');

test('renders the admin dashboard through Express and redirects the legacy URL', async (t) => {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${baseUrl}/admin`, { headers: { connection: 'close' } });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<title>Giftopia - Admin Dashboard<\/title>/);
  assert.match(html, /id="adminDashboardApp"/);
  assert.match(html, /href="\/assets\/styles\.css"/);
  assert.match(html, /name="productOccasions"/);
  assert.match(html, /type="text" inputmode="url" id="productImage"/);

  const imageResponse = await fetch(`${baseUrl}/assets/images/giftopia-placeholder.svg`);
  assert.equal(imageResponse.status, 200);
  assert.match(imageResponse.headers.get('content-type'), /image\/svg\+xml/);

  const stylesheetResponse = await fetch(`${baseUrl}/assets/styles.css`);
  assert.equal(stylesheetResponse.status, 200);
  assert.match(await stylesheetResponse.text(), /\.collection-filter/);

  const legacyResponse = await fetch(`${baseUrl}/admin.html`, {
    headers: { connection: 'close' },
    redirect: 'manual'
  });
  assert.equal(legacyResponse.status, 301);
  assert.equal(legacyResponse.headers.get('location'), '/admin');
});
