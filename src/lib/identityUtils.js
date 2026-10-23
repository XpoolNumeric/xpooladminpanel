/**
 * Canonical Identity & Contact Utility for Xpool Admin Operations Panel
 * Ensures synthetic compatibility emails are never displayed as real contact identities,
 * and canonical phone numbers are mapped and displayed correctly.
 */

/**
 * Checks if an email address is a synthetic / internal compatibility identifier.
 * Matches patterns like xpool.user.<digits>@gmail.com, @phone.xpool.internal, or synthetic hashes.
 *
 * @param {string|null|undefined} email - Email address to check
 * @returns {boolean} true if email is synthetic
 */
export const isSyntheticEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const clean = email.trim().toLowerCase();
    return (
        clean.startsWith('xpool.user.') ||
        clean.endsWith('@phone.xpool.internal') ||
        clean.endsWith('@xpool.internal') ||
        clean.endsWith('@internal.xpool.app') ||
        /^xpool\.user\.\d+@gmail\.com$/i.test(clean)
    );
};

/**
 * Resolves the genuine user contact email.
 * If the email is synthetic, internal, or empty, returns null.
 *
 * @param {string|null|undefined} email - Raw email string
 * @returns {string|null} Canonical real contact email or null
 */
export const getContactEmail = (email) => {
    if (!email || typeof email !== 'string') return null;
    const clean = email.trim();
    if (!clean || isSyntheticEmail(clean)) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return null;
    return clean;
};

/**
 * Normalizes an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Returns null if the number is malformed.
 *
 * @param {string|null|undefined} phoneNumber - Phone number input
 * @returns {string|null} E.164 phone or null
 */
export const canonicalizeIndianPhone = (phoneNumber) => {
    if (!phoneNumber || typeof phoneNumber !== 'string') return null;
    const digitsOnly = phoneNumber.trim().replace(/\D/g, '');
    let mobile10 = digitsOnly;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        mobile10 = digitsOnly.slice(2);
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
        mobile10 = digitsOnly.slice(1);
    } else if (digitsOnly.length > 10) {
        mobile10 = digitsOnly.slice(-10);
    }
    if (mobile10.length !== 10 || !/^[6-9]\d{9}$/.test(mobile10)) {
        return null;
    }
    return `+91${mobile10}`;
};

/**
 * Formats a phone number for user-friendly presentation (e.g. "+91 98765 43210").
 * Handles both profile.phone and profile.phone_number columns.
 *
 * @param {string|null|undefined} phoneNumber - Raw or canonical phone
 * @returns {string} Formatted phone or "—"
 */
export const formatPhoneDisplay = (phoneNumber) => {
    if (!phoneNumber) return '—';
    const canonical = canonicalizeIndianPhone(phoneNumber);
    if (!canonical) {
        const clean = String(phoneNumber).trim();
        return clean.length >= 10 ? clean : '—';
    }
    return `${canonical.slice(0, 3)} ${canonical.slice(3, 8)} ${canonical.slice(8)}`;
};

/**
 * Derives presentation-ready contact information for user directories, cards, and detail views.
 *
 * @param {object|null} user - Profile or User record
 * @returns {{ emailDisplay: string, phoneDisplay: string, isPhoneVerified: boolean, isPhoneAvailable: boolean, isEmailAvailable: boolean, canonicalPhone: string|null, realEmail: string|null }}
 */
export const getUserContactInfo = (user) => {
    if (!user) {
        return {
            emailDisplay: '—',
            phoneDisplay: '—',
            isPhoneVerified: false,
            isPhoneAvailable: false,
            isEmailAvailable: false,
            canonicalPhone: null,
            realEmail: null
        };
    }

    const rawEmail = user.email || null;
    const realEmail = getContactEmail(rawEmail);
    const rawPhone = user.phone || user.phone_number || null;
    const canonicalPhone = canonicalizeIndianPhone(rawPhone) || (rawPhone ? String(rawPhone).trim() : null);

    const isPhoneAvailable = Boolean(canonicalPhone && canonicalPhone !== '—');
    const isEmailAvailable = Boolean(realEmail);

    return {
        emailDisplay: realEmail ? realEmail : 'Not provided',
        emailCardDisplay: realEmail ? realEmail : '—',
        phoneDisplay: isPhoneAvailable ? formatPhoneDisplay(canonicalPhone) : 'Unavailable',
        phoneCardDisplay: isPhoneAvailable ? formatPhoneDisplay(canonicalPhone) : '—',
        isPhoneVerified: Boolean(isPhoneAvailable && (user.auth_provider === 'phone' || canonicalizeIndianPhone(rawPhone))),
        isPhoneAvailable,
        isEmailAvailable,
        canonicalPhone,
        realEmail
    };
};
