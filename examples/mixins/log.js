var _            = require('underscore'),
    ModelFactory = require('../../lib').factory;

module.exports = {
    initialize: function() {

        /* --- Example of using a hook --- */

        this.on('afterInitialize', function() {
            console.log('prometheus mixins/log.js: afterInitialize');
        });

        this.on('afterDestroy', function() {
            console.log('prometheus mixins/log.js: - delete logs for this item');
        });

        /* --- Example of adding temporary item to schema --- */

        this._schema._log = {
            name: 'Log',
            default: null,
            type: ModelFactory.types.STRING,
            sync: false
        },

        /* --- Extending model prototype with mixin's methods --- */

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