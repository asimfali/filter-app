export const can = (user, code) => {
    if (!user) return false;
    return user.permissions?.includes(code) ?? false;
};

export const canAny = (user, codes) => {
    if (!user) return false;
    return codes.some(code => can(user, code));
};