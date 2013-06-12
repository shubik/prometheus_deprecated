var deferred = require('deferred');

module.exports = {
    guest: function (model, user) {
        var def = deferred();
        def.resolve({ guest: true });
        return def.promise;
    }
}