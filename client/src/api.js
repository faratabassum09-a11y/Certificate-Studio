let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(url, options = {}) {
  const res = await fetch('/api' + url, options);
  if (res.status === 401) onUnauthorized();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

const json = (method, data) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const api = {
  // auth
  status: () => request('/auth/status'),
  me: () => request('/auth/me'),
  login: (data) => request('/auth/login', json('POST', data)),
  signup: (data) => request('/auth/signup', json('POST', data)),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // certificate templates
  list: () => request('/templates'),
  get: (id) => request(`/templates/${id}`),
  create: (formData) => request('/templates', { method: 'POST', body: formData }),
  update: (id, formData) => request(`/templates/${id}`, { method: 'PUT', body: formData }),
  remove: (id) => request(`/templates/${id}`, { method: 'DELETE' }),

  // team (admin)
  users: () => request('/users'),
  addUser: (data) => request('/users', json('POST', data)),
  updateUser: (id, data) => request(`/users/${id}`, json('PUT', data)),
  removeUser: (id) => request(`/users/${id}`, { method: 'DELETE' })
};
