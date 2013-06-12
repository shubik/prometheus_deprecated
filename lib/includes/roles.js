var deferred = require('deferred');

module.exports = {
    guest: {
        allowed: function (session_user) {
            var def = deferred();
            def.resolve(1);
            return def.promise;
        }
    }
}