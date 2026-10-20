function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

module.exports = { normalizeEmail };
