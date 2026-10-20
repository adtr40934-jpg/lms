function toLiteralRegex(value, maxLength = 100) {
    if (typeof value !== 'string') return null;

    const search = value.trim().slice(0, maxLength);
    if (!search) return null;

    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
}

module.exports = { toLiteralRegex };
