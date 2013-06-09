var _ = require('underscore');

module.exports = {
    initialize: function() {
        this.on('afterInitialize', function() {
            console.log('prometheus mixins/log.js: afterInitialize');
        });

        _.extend(this.__proto__, {
            log: function(data) {
                var coll = this._name.toLowerCase().replace(/model/g, '') + '_log',
                    def  = deferred(),
                    payload;

                payload = _.extend(data || {}, {
                    ts: utils.now(13)
                });

                console.log('prometheus mixins/log.js log to %s :', coll, payload);

                def.resolve(payload);

                return def.promise;
            }
        });
    }
};