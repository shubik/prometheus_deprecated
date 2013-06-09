var ModelFactory = require('./model_factory'),
    MongodbStore = require('./stores/mongodb'),
    MD5          = require('MD5');

module.exports = {
    factory : ModelFactory,
    stores  : {
        mongodb: MongodbStore
    }
}