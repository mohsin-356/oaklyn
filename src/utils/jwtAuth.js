// JWT Authentication Module for Oaklyn POS
// Hardcoded Super Admin credentials - NO DATABASE STORAGE

// HARDCODED SUPER ADMIN CREDENTIALS
const SUPER_ADMIN = {
  email: 'alienmatrix0@gmail.com',
  password: 'AlienMatrix017**',
  licenseKey: 'A9FqX2mR8ZL7pDkWJtYB6Hc0eS1VfN4UoM5IagCwTQrEbhyKxPn3sOlDiuFvJzR4A0m8c6'
};

// JWT Secret (in production, this should be more secure)
const JWT_SECRET = 'OaklynPOS_SecretKey_2026_SuperAdmin_Session';

// Session duration types in milliseconds
const SESSION_DURATIONS = {
  '1minute': 60 * 1000,           // 1 minute
  '3days': 3 * 24 * 60 * 60 * 1000,  // 3 days
  '1month': 30 * 24 * 60 * 60 * 1000, // 1 month (30 days)
  'lifetime': Number.MAX_SAFE_INTEGER  // Infinite/Lifetime
};

// Storage keys
const STORAGE_KEYS = {
  superAdminToken: 'oaklyn_super_admin_token',
  sessionToken: 'oaklyn_session_token',
  sessionExpiry: 'oaklyn_session_expiry',
  sessionType: 'oaklyn_session_type',
  companyUser: 'oaklyn_current_user'
};

/**
 * Validate Super Admin credentials
 * @param {string} email
 * @param {string} password
 * @param {string} licenseKey
 * @returns {boolean}
 */
export function validateSuperAdmin(email, password, licenseKey) {
  return (
    email === SUPER_ADMIN.email &&
    password === SUPER_ADMIN.password &&
    licenseKey === SUPER_ADMIN.licenseKey
  );
}

/**
 * Create a Super Admin JWT token
 * @returns {string} JWT token
 */
export function createSuperAdminToken() {
  const payload = {
    type: 'super_admin',
    email: SUPER_ADMIN.email,
    iat: Date.now(),
    exp: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year expiry for super admin token
  };
  
  // Simple base64 encoding (since we're in browser without node-jwt)
  return btoa(JSON.stringify(payload));
}

/**
 * Create a Session token with duration
 * @param {string} sessionType - '1minute', '3days', '1month', 'lifetime'
 * @returns {object} { token, expiry }
 */
export function createSessionToken(sessionType) {
  const duration = SESSION_DURATIONS[sessionType];
  if (!duration) throw new Error('Invalid session type');
  
  const now = Date.now();
  const expiry = now + duration;
  
  const payload = {
    type: 'session',
    sessionType: sessionType,
    startedAt: now,
    expiresAt: expiry,
    iat: now
  };
  
  const token = btoa(JSON.stringify(payload));
  return { token, expiry, sessionType };
}

/**
 * Verify and decode a token
 * @param {string} token
 * @returns {object|null} decoded payload or null
 */
export function verifyToken(token) {
  try {
    const payload = JSON.parse(atob(token));
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Save Super Admin authentication
 */
export function saveSuperAdminAuth() {
  const token = createSuperAdminToken();
  localStorage.setItem(STORAGE_KEYS.superAdminToken, token);
}

/**
 * Save Session details
 * @param {string} sessionType
 */
export function saveSession(sessionType) {
  const { token, expiry } = createSessionToken(sessionType);
  localStorage.setItem(STORAGE_KEYS.sessionToken, token);
  localStorage.setItem(STORAGE_KEYS.sessionExpiry, expiry.toString());
  localStorage.setItem(STORAGE_KEYS.sessionType, sessionType);
}

/**
 * Save Custom Session with specific duration in milliseconds
 * @param {number} durationMs - Duration in milliseconds
 */
export function saveCustomSession(durationMs) {
  const now = Date.now();
  const expiry = now + durationMs;
  
  const payload = {
    type: 'session',
    sessionType: 'custom',
    startedAt: now,
    expiresAt: expiry,
    iat: now
  };
  
  const token = btoa(JSON.stringify(payload));
  localStorage.setItem(STORAGE_KEYS.sessionToken, token);
  localStorage.setItem(STORAGE_KEYS.sessionExpiry, expiry.toString());
  localStorage.setItem(STORAGE_KEYS.sessionType, 'custom');
}

/**
 * Check if Super Admin is authenticated
 * @returns {boolean}
 */
export function isSuperAdminAuthenticated() {
  const token = localStorage.getItem(STORAGE_KEYS.superAdminToken);
  if (!token) return false;
  
  const payload = verifyToken(token);
  return payload && payload.type === 'super_admin';
}

/**
 * Check if valid session exists and is not expired
 * @returns {object|null} session info or null
 */
export function getValidSession() {
  const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
  const expiry = localStorage.getItem(STORAGE_KEYS.sessionExpiry);
  const sessionType = localStorage.getItem(STORAGE_KEYS.sessionType);
  
  if (!token || !expiry) return null;
  
  const now = Date.now();
  if (now > parseInt(expiry)) {
    // Session expired - clear it
    clearSession();
    return null;
  }
  
  return {
    token,
    expiry: parseInt(expiry),
    sessionType,
    remainingTime: parseInt(expiry) - now
  };
}

/**
 * Check if session is expired
 * @returns {boolean}
 */
export function isSessionExpired() {
  const expiry = localStorage.getItem(STORAGE_KEYS.sessionExpiry);
  if (!expiry) return true;
  return Date.now() > parseInt(expiry);
}

/**
 * Get session remaining time in human readable format
 * @returns {string}
 */
export function getSessionRemainingTime() {
  const session = getValidSession();
  if (!session) return 'Expired';
  
  const remaining = session.remainingTime;
  
  if (remaining > 30 * 24 * 60 * 60 * 1000) {
    return 'Lifetime';
  } else if (remaining > 24 * 60 * 60 * 1000) {
    return `${Math.floor(remaining / (24 * 60 * 60 * 1000))} days`;
  } else if (remaining > 60 * 60 * 1000) {
    return `${Math.floor(remaining / (60 * 60 * 1000))} hours`;
  } else if (remaining > 60 * 1000) {
    return `${Math.floor(remaining / (60 * 1000))} minutes`;
  } else {
    return `${Math.floor(remaining / 1000)} seconds`;
  }
}

/**
 * Clear only session (keep Super Admin auth)
 */
export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.sessionToken);
  localStorage.removeItem(STORAGE_KEYS.sessionExpiry);
  localStorage.removeItem(STORAGE_KEYS.sessionType);
  localStorage.removeItem(STORAGE_KEYS.companyUser);
}

/**
 * Clear all authentication (Super Admin + Session)
 */
export function clearAllAuth() {
  localStorage.removeItem(STORAGE_KEYS.superAdminToken);
  clearSession();
}

/**
 * Logout to Company Login (clear session only)
 */
export function logoutToCompany() {
  clearSession();
}

/**
 * Validate license key for Super Admin logout
 * @param {string} licenseKey
 * @returns {boolean}
 */
export function validateLicenseKeyForLogout(licenseKey) {
  return licenseKey === SUPER_ADMIN.licenseKey;
}

/**
 * Get available session types
 * @returns {Array}
 */
export function getSessionTypes() {
  return [
    { id: '1minute', label: '1 Minute (Demo)', duration: '1 minute' },
    { id: '3days', label: '3 Days', duration: '3 days' },
    { id: '1month', label: '1 Month', duration: '30 days' },
    { id: 'lifetime', label: 'Lifetime', duration: 'Unlimited' }
  ];
}

/**
 * Check if company user is logged in
 * @returns {boolean}
 */
export function isCompanyLoggedIn() {
  const user = localStorage.getItem(STORAGE_KEYS.companyUser);
  return !!user;
}

/**
 * Save company user after login
 * @param {object} user
 */
export function saveCompanyUser(user) {
  localStorage.setItem(STORAGE_KEYS.companyUser, JSON.stringify(user));
}

/**
 * Get current company user
 * @returns {object|null}
 */
export function getCompanyUser() {
  const user = localStorage.getItem(STORAGE_KEYS.companyUser);
  return user ? JSON.parse(user) : null;
}

/**
 * Clear company user only (logout from company)
 */
export function clearCompanyUser() {
  localStorage.removeItem(STORAGE_KEYS.companyUser);
}
