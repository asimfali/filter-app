import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tokenStorage, apiFetch, authApi } from '../auth';

const ok = (data, status = 200) => Promise.resolve({ ok: true, status, json: async () => data });
const fail = (data, status = 400) => Promise.resolve({ ok: false, status, json: async () => data });

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tokenStorage', () => {
  it('returns null for both tokens when nothing is stored', () => {
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });

  it('set() stores both access and refresh tokens', () => {
    tokenStorage.set('access-1', 'refresh-1');
    expect(tokenStorage.getAccess()).toBe('access-1');
    expect(tokenStorage.getRefresh()).toBe('refresh-1');
  });

  it('set() without a refresh token leaves a previously stored refresh token untouched', () => {
    tokenStorage.set('access-1', 'refresh-1');
    tokenStorage.set('access-2');
    expect(tokenStorage.getAccess()).toBe('access-2');
    expect(tokenStorage.getRefresh()).toBe('refresh-1');
  });

  it('clear() removes both tokens', () => {
    tokenStorage.set('access-1', 'refresh-1');
    tokenStorage.clear();
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});

describe('apiFetch', () => {
  it('attaches an Authorization header when an access token is stored', async () => {
    tokenStorage.set('tok123');
    let headers;
    fetchMock.mockImplementationOnce((url, opts) => {
      headers = opts.headers;
      return ok({});
    });

    await apiFetch('/api/v1/x/');

    expect(headers.Authorization).toBe('Bearer tok123');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('omits the Authorization header when no access token is stored', async () => {
    let headers;
    fetchMock.mockImplementationOnce((url, opts) => {
      headers = opts.headers;
      return ok({});
    });

    await apiFetch('/api/v1/x/');

    expect(headers.Authorization).toBeUndefined();
  });

  it('does not set a JSON Content-Type when the body is FormData', async () => {
    let headers;
    fetchMock.mockImplementationOnce((url, opts) => {
      headers = opts.headers;
      return ok({});
    });

    await apiFetch('/api/v1/x/', { method: 'POST', body: new FormData() });

    expect(headers['Content-Type']).toBeUndefined();
  });

  it('returns non-401 responses as-is, with no retry', async () => {
    fetchMock.mockImplementationOnce(() => ok({ hello: 'world' }));

    const res = await apiFetch('/api/v1/catalog/products/');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });

  it('returns the 401 response as-is when no refresh token is stored (no refresh attempt)', async () => {
    tokenStorage.set('old-access');
    fetchMock.mockImplementationOnce(() => fail({}, 401));

    const res = await apiFetch('/api/v1/catalog/products/');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
  });

  it('on 401, refreshes the token and retries the original request', async () => {
    tokenStorage.set('old-access', 'refresh-tok');
    let firstHeaders, retryHeaders, refreshUrl, refreshBody;

    fetchMock
      .mockImplementationOnce((url, opts) => {
        firstHeaders = { ...opts.headers };
        return fail({}, 401);
      })
      .mockImplementationOnce((url, opts) => {
        refreshUrl = url;
        refreshBody = JSON.parse(opts.body);
        return ok({ access: 'new-access', refresh: 'new-refresh' });
      })
      .mockImplementationOnce((url, opts) => {
        retryHeaders = { ...opts.headers };
        return ok({ hello: 'world' });
      });

    const res = await apiFetch('/api/v1/catalog/products/');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/catalog/products/');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/catalog/products/');
    expect(refreshUrl).toBe('/api/v1/auth/token/refresh/');
    expect(refreshBody).toEqual({ refresh: 'refresh-tok' });
    expect(firstHeaders.Authorization).toBe('Bearer old-access');
    expect(retryHeaders.Authorization).toBe('Bearer new-access');
    expect(res.ok).toBe(true);
    expect(tokenStorage.getAccess()).toBe('new-access');
    expect(tokenStorage.getRefresh()).toBe('new-refresh');
  });

  it('on 401 with a failed refresh response, clears tokens and returns the original 401 without retrying', async () => {
    tokenStorage.set('old-access', 'bad-refresh');
    fetchMock
      .mockImplementationOnce(() => fail({}, 401))
      .mockImplementationOnce(() => fail({}, 401));

    const res = await apiFetch('/api/v1/catalog/products/');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(401);
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });

  it('treats a network error during refresh as a failed refresh (clears tokens, no retry)', async () => {
    tokenStorage.set('old-access', 'refresh-tok');
    fetchMock
      .mockImplementationOnce(() => fail({}, 401))
      .mockImplementationOnce(() => Promise.reject(new Error('network down')));

    const res = await apiFetch('/api/v1/catalog/products/');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(401);
    expect(tokenStorage.getAccess()).toBeNull();
  });
});

describe('authApi — unauthenticated endpoints (plain fetch, никогда не шлют токен)', () => {
  it('login posts email+password and ignores any stored token', async () => {
    tokenStorage.set('should-not-be-sent');
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({ access: 'a', refresh: 'r' });
    });

    const result = await authApi.login('user@example.com', 'pw');

    expect(capturedUrl).toBe('/api/v1/auth/login/');
    expect(capturedOpts.method).toBe('POST');
    expect(JSON.parse(capturedOpts.body)).toEqual({ email: 'user@example.com', password: 'pw' });
    expect(capturedOpts.headers.Authorization).toBeUndefined();
    expect(result).toEqual({ ok: true, status: 200, data: { access: 'a', refresh: 'r' } });
  });

  it('login2fa sends a 2fa_code field instead of a password', async () => {
    let capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedOpts = opts;
      return ok({ access: 'a', refresh: 'r' });
    });

    await authApi.login2fa('user@example.com', '123456');

    expect(JSON.parse(capturedOpts.body)).toEqual({ email: 'user@example.com', '2fa_code': '123456' });
  });

  it('register posts the payload as-is', async () => {
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({ id: 1 });
    });

    await authApi.register({ email: 'new@example.com', password: 'pw', department_id: 3 });

    expect(capturedUrl).toBe('/api/v1/auth/register/');
    expect(JSON.parse(capturedOpts.body)).toEqual({ email: 'new@example.com', password: 'pw', department_id: 3 });
  });

  it('activate sends email + activation_code', async () => {
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({});
    });

    await authApi.activate('user@example.com', '654321');

    expect(capturedUrl).toBe('/api/v1/auth/activate/');
    expect(JSON.parse(capturedOpts.body)).toEqual({ email: 'user@example.com', activation_code: '654321' });
  });

  it('passwordResetRequest posts the email and returns { ok, data } without a status field', async () => {
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({ sent: true });
    });

    const result = await authApi.passwordResetRequest('user@example.com');

    expect(capturedUrl).toBe('/api/v1/auth/password-reset/');
    expect(JSON.parse(capturedOpts.body)).toEqual({ email: 'user@example.com' });
    expect(result).toEqual({ ok: true, data: { sent: true } });
  });

  it('passwordResetConfirm posts email/code/password/password_confirm', async () => {
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({});
    });

    await authApi.passwordResetConfirm('user@example.com', '111111', 'newpass', 'newpass');

    expect(capturedUrl).toBe('/api/v1/auth/password-reset/confirm/');
    expect(JSON.parse(capturedOpts.body)).toEqual({
      email: 'user@example.com',
      code: '111111',
      password: 'newpass',
      password_confirm: 'newpass',
    });
  });
});

describe('authApi — authenticated GET endpoints (через apiFetch)', () => {
  it.each([
    ['profile', () => authApi.profile(), '/api/v1/auth/profile/'],
    ['departments', () => authApi.departments(), '/api/v1/auth/departments/?root_only=false'],
    ['roles', () => authApi.roles(), '/api/v1/auth/roles/'],
    ['specMatrix', () => authApi.specMatrix(7), '/api/v1/auth/departments/7/permissions/spec-matrix/'],
    ['getPreferences', () => authApi.getPreferences(), '/api/v1/auth/preferences/'],
  ])('%s calls %s and returns { ok, data }', async (_name, call, expectedUrl) => {
    let capturedUrl;
    fetchMock.mockImplementationOnce((url) => {
      capturedUrl = url;
      return ok({ value: 42 });
    });

    const result = await call();

    expect(capturedUrl).toBe(expectedUrl);
    expect(result).toEqual({ ok: true, data: { value: 42 } });
  });
});

describe('authApi — write endpoints (через apiFetch)', () => {
  it('specToggle posts role_id/spec_id to the department spec-toggle endpoint', async () => {
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({ success: true });
    });

    await authApi.specToggle(3, 5, 9);

    expect(capturedUrl).toBe('/api/v1/auth/departments/3/permissions/spec-toggle/');
    expect(capturedOpts.method).toBe('POST');
    expect(JSON.parse(capturedOpts.body)).toEqual({ role_id: 5, spec_id: 9 });
  });

  it('updatePreferences PATCHes the given data as-is', async () => {
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({});
    });

    await authApi.updatePreferences({ theme: 'dark' });

    expect(capturedUrl).toBe('/api/v1/auth/preferences/');
    expect(capturedOpts.method).toBe('PATCH');
    expect(JSON.parse(capturedOpts.body)).toEqual({ theme: 'dark' });
  });

  it('saveColumnPrefs nests the columns under table_column_prefs[tableKey]', async () => {
    let capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedOpts = opts;
      return ok({});
    });

    await authApi.saveColumnPrefs('products', ['id', 'name']);

    expect(capturedOpts.method).toBe('PATCH');
    expect(JSON.parse(capturedOpts.body)).toEqual({
      table_column_prefs: { products: { columns: ['id', 'name'] } },
    });
  });

  it('uploadAvatar sends the file as multipart FormData without a JSON Content-Type', async () => {
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({ avatar_url: '/media/avatar.png' });
    });
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });

    const result = await authApi.uploadAvatar(file);

    expect(capturedUrl).toBe('/api/v1/auth/avatar/');
    expect(capturedOpts.method).toBe('POST');
    expect(capturedOpts.body).toBeInstanceOf(FormData);
    expect(capturedOpts.body.get('avatar')).toBe(file);
    expect(capturedOpts.headers['Content-Type']).toBeUndefined();
    expect(result).toEqual({ ok: true, data: { avatar_url: '/media/avatar.png' } });
  });

  it('deleteAvatar sends a DELETE request', async () => {
    let capturedUrl, capturedOpts;
    fetchMock.mockImplementationOnce((url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return ok({});
    });

    await authApi.deleteAvatar();

    expect(capturedUrl).toBe('/api/v1/auth/avatar/');
    expect(capturedOpts.method).toBe('DELETE');
  });

  it('logout clears local tokens even when the server request fails', async () => {
    tokenStorage.set('acc', 'ref');
    fetchMock.mockImplementationOnce(() => fail({}, 500));

    await authApi.logout('ref');

    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});
