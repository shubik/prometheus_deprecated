var _          = require('underscore'),
    mongo      = require('mongodb'),
    deferred   = require('deferred'),
    indextypes = require('../includes/indexes'),
    is_json    = require('../utils/is_json'),
    ObjectID   = mongo.ObjectID,
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

    var self           = this,
        host           = options.host || '127.0.0.1',
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

        var self    = this,
            def     = deferred(),
            indexes;


        /* --- Ensure indexes --- */

        indexes = _.pluck(schema, 'index');

        indexes = _.filter(indexes, function(index) {
            return index !== undefined;
        });

        _.each(indexes, function(type) {
            var attrs = _.reduce(schema, function(memo, val, attr) {
                if (val.index && val.index === type) {
                    memo.push(attr);
                }
                return memo;
            }, []);
            self.create_index(attrs, type);
        });

        /* --- Insert data --- */

        this.collection(function(coll) {
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
        query   = query || {};
        options = options || {};

        if (is_json(query)) {
            query = JSON.parse(query);
        }

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

            var cursor;

            if (_.isArray(query)) {

                /* --- Find by a list of object ids --- */

                var obj_ids = _.reduce(query, function(memo, id) {
                    var _id;

                    if (id instanceof ObjectID) {
                        _id = id;
                    } else {
                        try {
                            _id = new ObjectID(id);
                        } catch(err) {
                            console.log(err);
                        }
                    }

                    memo.push(_id);
                    return memo;
                }, []);

                cursor = coll.find({ _id: { $in: obj_ids } });

            } else {

                /* --- Find by a query --- */

                cursor = coll.find(query);

            }


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
    },

    create_index: function(attr, type) {
        attr = _.isArray(attr) ? attr : [attr];
        type = String(type || 'compound').toLowerCase();

        var fields = _.reduce(attr, function(memo, key) {
                memo[key] = (type === indextypes.HASHED) ? 'hashed' : 1;
                return memo;
            }, {}),

            default_opts = { background: true },
            opts;

        switch(type) {
            case indextypes.UNIQUE:
                opts = { unique: true };
                break;

            case indextypes.SPARSE:
                opts = { sparse: true };
                break;

            default:
                return;
        }

        this.collection(function(coll) {
            coll.createIndex(fields, _.extend({}, default_opts, opts || {}));
        });
    },

    remove_index: function(attr) {
        if (attr) {
            attr = _.isArray(attr) ? attr : [attr];

            var fields = _.reduce(attr, function(memo, key) {
                memo[key] = 1;
                return memo;
            }, {});

            this.collection(function(coll) {
                coll.dropIndex(fields);
            });
        } else {
            this.collection(function(coll) {
                coll.dropIndex();
            });
        }
    }
});

MongodbStore.ObjectID = ObjectID;

module.exports = MongodbStore;