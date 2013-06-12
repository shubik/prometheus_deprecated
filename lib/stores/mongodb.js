var mongo          = require('mongodb'),
    deferred       = require('deferred'),
    ObjectID       = mongo.ObjectID,
    MongodbStore;

/**
Allows to use using native MongoDB Node.js driver but with a standard CRUD API.

@class MongodbStore
@constructor
@param {Object} options Required param in options is `collection`; optional params are `host`, `port`, `opts`, `database` for MongoDB client
*/

MongodbStore = function(options) {

    if (!options.collection) {
        throw new Error('heraclitus stores/mongodb MongodbStore(): collection name is missing')
    }

    var host           = options.host || '127.0.0.1',
        port           = options.port || 27017,
        opts           = options.opts || {},
        database       = options.database || 'test',
        mongo_server   = mongo.Server(host, port, opts),
        mongo_database = new mongo.Db(database, mongo_server, { w: 1 }),
        def            = deferred();

    this.collection = def.promise;

    mongo_database.open(function(err, client) {
        if (err) {
            def.resolve(err);
        } else {
            client.collection(options.collection.toLowerCase(), function(err, collection) {
                def.resolve(err || collection);
            });
        }
    });
}

_.extend(MongodbStore.prototype, {

    /**
    Builds default query to retrieve item from collection
    @method query
    @param {Object} model Model instance for which we are building this query
    @return {Object} Returns actual query that will be used
    */

    query: function(query) {
        return _.reduce(query, function(memo, val, attr) {
            if ((attr === '_id' || attr === 'id') && !(val instanceof ObjectID)) {
                memo._id = new ObjectID(val);
            } else {
                memo[attr] = val;
            }
            return memo;
        }, {});
    },

    /**
    Parses retrieved model
    @method parse
    @param {Object} attributes Attributes of the model
    @return {Object} Returns parsed attributes of the model
    */

    parse: function(attributes) {
        if (attributes && attributes._id) {
            attributes.id = attributes._id.toString();
        }
        return attributes;
    },

    /**
    Inserts new record to collection

    @method create
    @param {Object} data Hash with model attributes
    @param {Object} schema Hash with model settings. Specifically we will be looking for unique attributes that need to be checked before insert.
    @return {Function} Returns a promise that is resolved with either new model _id (ObjectID) or error.
    */

    create: function(data, schema) {

        var self = this,
            def = deferred(),

            unique = _.reduce(schema, function(memo, val, key) {
                if (val.unique) {
                    memo.push(key);
                }
                return memo;
            }, []),

            /**
            Checks uniqueness of attribute values before insertion
            This func returns TRUE if attr val not found in collection, or FALSE if it was. It may also be resolved with an error.

            @method check_unique
            @param {String} attr Attribute name which value must be unique
            @return {Function} Returns a promise that will be resolved with boolean or error
            */

            check_unique = function(attr) {
                var lookup = deferred(),
                    query  = {};

                query[attr] = data[attr];

                self.collection(function(coll) {
                    coll.findOne(query, function(err, item) {
                        if (err) {
                            lookup.resolve(err);
                        } else {
                            lookup.resolve(item === null);
                        }
                    });
                }, function(err) {
                    lookup.resolve(err);
                });

                return lookup.promise;
            },

            /**
            Inserts data if ALL checks for unique values returned TRUE

            @method insert_data
            @param {Array} result This is an array that has 0 length if model does not have unique attributes. Otherwise it's an array with booleans.
            @return {Function} Returns a promise that is resolved with newly inserted item _id or error.
            */

            insert_data = function(result) {
                if (result.length === 0 || result.indexOf(false) === -1) {
                    self.collection(function(coll) {
                        coll.insert(data, function(err, items) {
                            if (err) {
                                def.resolve(err);
                            } else {
                                def.resolve(items.pop()._id);
                            }
                        });
                    }, function(err) {
                        def.resolve(err);
                    });
                } else {
                    def.resolve(new Error('mongodb_store.js create() - one of the values is not unique'));
                }
            };

        deferred.map(unique, check_unique)(insert_data);

        return def.promise;
    },

    /**
    Finds one entry in collection matching the ID

    @method read
    @param {ObjectID} id MongoDB ObjectID only
    @return {Function} Returns a promise that is resolved with item hash or error.
    */

    read: function(id) {
        var def = deferred(),
            query = { _id: new ObjectID(id) };

        this.collection(function(coll) {
            coll.findOne(query, function(err, item) {
                def.resolve(err || item);
            });
        }, function(err) {
            def.resolve(err);
        });

        return def.promise;
    },

    /**
    Updates one item in collection with new data

    @method update
    @param {ObjectID} id MongoDB ObjectID only
    @param {Object} data Hash with new attributes of this model
    @return {Function} Returns a promise that is resolved with item hash or error.
    */

    update: function(id, data) {
        var def = deferred(),
            query = { _id: new ObjectID(id) };

        this.collection(function(coll) {
            coll.update(query, { $set: data }, { safe: true }, function(err) {
                def.resolve(err || data);
            });
        }, function(err) {
            def.resolve(err);
        });

        return def.promise;
    },

    /**
    Deletes item(s) from collection

    @method destroy
    @param {ObjectID} id MongoDB ObjectID only
    @param {Boolean} single If true, deletes only one match, otherwise deletes all matches
    @return {Function} Returns a promise that is resolved with nothing or error.
    */

    destroy: function(id, single) {
        single = !!single || false;

        var def = deferred(),
            query = { _id: new ObjectID(id) };

        this.collection(function(coll) {
            coll.remove(query, { single: single }, function(err) {
                def.resolve(err || 1);
            });
        }, function(err) {
            def.resolve(err);
        });

        return def.promise;
    },

    /**
    Finds items in collection matching a query and cursor options

    @method find
    @param {Object} query Query object that contains key-values to look for in collection
    @param {Object} options Contains offset, limit and sort options
    @return {Function} Returns a promise that is resolved with found items or error.
    */

    find: function(query, options) {
        query = query || {};

        var offset   = options.offset || 0,
            limit    = options.limit || null,
            sort_key = options.sort_key || null,
            sort_dir = options.sort_dir || 1,
            def      = deferred(),
            sort     = null;

        /* --- MongoDB will fail if any of these params have incorrect values --- */

        if (!_.isNaN(sort_dir)) {
            sort_dir = parseInt(sort_dir, 10);
        }

        if (([1, -1, 'asc', 'desc']).indexOf(sort_dir) === -1) {
            sort_dir = 1;
        }

        if (_.isNaN(offset) || offset < 1) {
            offset = null;
        } else {
            offset = parseInt(offset, 10);
        }

        if (_.isNaN(limit) || limit < 1) {
            limit = null;
        } else {
            limit = parseInt(limit, 10);
        }

        if (sort_key) {
            sort = {};
            sort[sort_key] = sort_dir;
        }

        /* --- Make a query --- */

        this.collection()(function(coll) {
            var cursor = coll.find(query);

            if (offset) {
                cursor.skip(offset);
            }

            if (limit) {
                cursor.limit(limit);
            }

            if (sort) {
                cursor.sort(sort);
            }

            cursor.toArray(function(err, items) {
                def.resolve(err || items);
            });

        }, function(err) {
            def.resolve(err);
        });

        return def.promise;
    },

    /**
    Returns all items in a collection

    @method all
    @return {Function} Returns a promise that is resolved with found items or error.
    */

    all: function() {
        var def = deferred();

        this.collection(function(coll) {
            coll.find().toArray(function(err, items) {
                def.resolve(err || items);
            });
        }, function(err) {
            def.resolve(err);
        });

        return def.promise;
    },

    /**
    Returns one item from collection that matches a query

    @method findOne
    @param {Object} query Query object that contains key-values to look for in collection
    @return {Function} Returns a promise that is resolved with found item or error.
    */

    findOne: function(query) {
        var def = deferred();

        if (!query) {
            def.resolve(new Error('MongoDB findOne(): model ID is invalid'));
        } else {
            this.collection(function(coll) {
                coll.findOne(query, function(err, item) {
                    def.resolve(err || item);
                });
            }, function(err) {
                def.resolve(err);
            });
        }

        return def.promise;
    },

    /**
    Returns number of items in collection

    @method count
    @return {Function} Returns a promise that is resolved with number of items or error.
    */

    count: function() {
        var def = deferred();

        this.collection(function(coll) {
            coll.count(function(err, count) {
                def.resolve(err || count);
            });
        }, function(err) {
            def.resolve(err);
        });

        return def.promise;
    }
});

module.exports = MongodbStore;