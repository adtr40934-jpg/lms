function isPendingOrderConflict(error) {
    const keys = error?.keyPattern;
    return error?.code === 11000 &&
        keys?.course === 1 &&
        keys?.status === 1 &&
        ['user', 'email', 'phone'].some(field => keys[field] === 1);
}

module.exports = { isPendingOrderConflict };
