module.exports = {
    log: function(data) {

        var coll = this._name.toLowerCase().replace(/model/g, '') + '_log',
            def  = deferred(),
            payload;

        payload = _.extend(data || {}, {
            ts: utils.now(13)
        });

        console.log('heraclitus mixin_log.js log to %s :', coll, payload);
        def.resolve(payload);

        return def.promise;
    }
};