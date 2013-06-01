var ModelFactory = require('./model_factory'),
    MongodbStore = require('./stores/mongodb'),
    Validators   = require('./helpers/validators'),
    MD5          = require('MD5');

module.exports = function(options) {
    this.options = options || {};

    return {
        factory : ModelFactory,
        stores  : {
            mongodb: MongodbStore
        },
        validators: Validators,
        MD5: MD5
    }
}