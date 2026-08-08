// --- Input validation helpers ---

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validIdList(value, maximum = 10000) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, maximum);
}

function validTopicList(value, maximum = 20) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((topic) => String(topic).trim()).filter(Boolean))].slice(0, maximum);
}

function normaliseEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function validName(value) {
  const name = String(value || '').trim();
  return name.length >= 1 && name.length <= 100 ? name : null;
}

function validPassword(value) {
  const password = String(value || '');
  return password.length >= 8 && password.length <= 200 ? password : null;
}

module.exports = {
  validIdList,
  validTopicList,
  normaliseEmail,
  validName,
  validPassword,
};
