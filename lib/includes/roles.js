var deferred = require('deferred');

module.exports = {
    app: function (model, req) {
        var def = deferred();
        def.resolve({ app: req === null });
        return def.promise;
    },

    guest: function (model, req) {
        var def = deferred();
        def.resolve({ user: req !== null });
        return def.promise;
    }
}