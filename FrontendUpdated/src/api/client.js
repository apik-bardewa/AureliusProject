// Thin fetch wrapper around the Aurelius Node backend (server.js).
// All endpoints and their expected payloads are documented inline.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_error) {
    throw new ApiError('Could not reach the Aurelius server. Is server.js running on port 5000?', 0);
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error || 'Something went wrong. Please try again.', response.status);
  }
  return payload;
}

export const api = {
  // --- Auth ---
  signup: (name, email, password) => request('/api/signup', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/api/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/api/me', { token }),

  // --- Onboarding ---
  starterArticles: () => request('/api/onboarding/articles'),
  onboard: (token, articleIds, topics = []) =>
    request('/api/onboard', { method: 'POST', token, body: { articleIds, topics } }),

  // --- Feed ---
  feed: (userId, seenIds = []) => request('/api/feed', { method: 'POST', body: { userId, seenIds } }),

  // --- Interactions ---
  interact: (userId, articleId, action) =>
    request('/api/interact', { method: 'POST', body: { userId, articleId, action } }),

  // --- Why am I seeing this? ---
  explain: (userId, articleId) => request('/api/explain', { method: 'POST', body: { userId, articleId } }),

  // --- Bookmarks ---
  bookmarks: (token) => request('/api/bookmarks', { token }),
  removeBookmark: (token, articleId) => request(`/api/bookmarks/${articleId}`, { method: 'DELETE', token }),
};

export { ApiError };
