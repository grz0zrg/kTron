var _COMMON_CONFIG = {
    velocity: 3,
    allowed_origin: ["127.0.0.1:3000", "127.0.0.1:8080", "http://127.0.0.1:8080", "http://127.0.0.1:3000", "file://"]
};

if (typeof module !== 'undefined') {
    module.exports = _COMMON_CONFIG;
}