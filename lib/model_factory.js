var _             = require('underscore'),
    Events        = require('events').EventEmitter,
    deferred      = require('deferred'),
    form_builder  = require('./helpers/form_builder'),
    form_parser   = require('./helpers/form_parser'),
    table_builder = require('./helpers/table_builder'),
    datatypes     = require('./includes/datatypes'),
    indextypes    = require('./includes/indexes'),
    roles_default = require('./includes/roles'),
    evt_handlers  = require('./includes/evt_handlers'),
    is_json       = require('./utils/is_json'),
    reusable_pool = {},
    ModelFactory,

    CREATE        = 'create',
    READ          = 'read',
    UPDATE        = 'update',
    DESTROY       = 'destroy';

/**
Creates a constructor for specific types of models using passed options.

Expected options are:
    store               - {Object} instance of a store (e.g. a MongoDB store)
    schema              - {Object} rules describing a model: default, validate, permitted, unique
        name            - {String} friendly name for this attribute
        default         - {Mixed} default attribute value
        type            - {String} data type from list of constants in ModelFactory.types
        [validate]      - {Function} that validates attribute value
        [permitted]     - {Array} permitted values
        [unique]        - {Boolean} true if value must be unique
        [content_type]  - {String} comma separated mime types, default `text/plain`
        [resize]        - {Array} desired image sizes
        [maxlength]     - {Number} number if string has a max length
        [maketag]       - {Function} that returns HTML tag for this field, by usign value of the attribute
        [readonly]      - {Boolean} true if user is not allowed to change value
        [sync]          - {Boolean} false if should not be synced with store
        [required]      - {Boolean} true if value can not be empty or default
    [uploads]           - {Object} "path" and "path_public" params for uploader
    [query]             - {Function} returns a query used to initially load a model
    [mixins]            - {Array} list of mixins
    [prototype_methods] - {Object} hash with methods that will be added to model constructor's prototype
    [static_methods]    - {Object} hash with static methods that will be added to model's constructor
    [hooks]             - {Object} hash with callbacks to be executed on model lifecycle events
    [permissions]       - {Object} list of CRUD+Transfer permissions
    [roles]             - {Object} list of permissions checkers for each role

@class ModelFactory
@param {Object} options Options specific to a model type necessary to produce a model constructor
@return {Function} Returns a specific model type constructor used to instantiate models
*/

ModelFactory = function(options) {

    var format_query = options.store.query,
        mixins       = options.mixins || [],
        permissions  = options.permissions || {},
        hooks        = options.hooks || [],
        model_name   = options.name,
        roles        = _.extend({}, roles_default, options.roles || {});

    reusable_pool[model_name] = reusable_pool[model_name] || [];

    /**
    Constructor for a specific types of models, augmented by type specific options

    @class ModelConstructor
    @constructor
    @param {Object} query Query used to load object (must be for a unique attribute, e.g. id, _id, email etc.)
    @param {Object} [options] Additional options, e.g. { req: req }
    @return {Object} Returns a model instance
    */

    var ModelConstructor = function(query, options) {

        query   = query || {};
        options = options || {};

        /*

        We provision using this model constructor without `new` keyword.
        If it is used without `new` keyword, we will look up available model in the object pool. If such model is found,
        we initialize it again and return its instance. Else we create and return new instance, which we add to the pool.

        */

        if (!(this instanceof ModelConstructor)) {

            /* --- We are in an Object Pool mode --- */

            var avail_inst = _.filter(reusable_pool[model_name], function(inst) {
                    return !inst._inuse;
                }),
                model;

            if (avail_inst.length) {
                model = avail_inst.pop();
                model._initialize(query, options);
            } else {
                model = new ModelConstructor(query, options);
                reusable_pool[model_name].push(model);
            }

            return model;
        }

        /* --- Add EventEmitter API --- */

        var self = this,
            events = new Events;

        _.extend(this, events.__proto__);
        this.setMaxListeners(0);

        /* --- Make sure schema item keys do not clash with this model methods and properties --- */

        _.each(this._schema, function(item, attr) {
            if (self[attr] || self.__proto__[attr]) {
                throw new Error('ModelConstructor(): schema item clashes with model method or property: ' + attr);
            }
        });

        /* --- Define setters and getters --- */

        _.each(this._schema, function(item, attr) {
            self.__defineSetter__(attr, function(val) {
                self._attributes[attr] = val;
            });

            self.__defineGetter__(attr, function() {
                return self._attributes[attr];
            });
        });

        /* --- Setup model internal attributes --- */

        this._reset_model();


        /* --- Initialize this model --- */

        // here goes logic of Object Pool Pattern
        this._initialize(query, options);

        return this;
    }

    /* --- Static methods and attributes --- */

    _.extend(ModelConstructor, options.static_methods || {}, {

        /**
        Friendly name of this model
        @property model_name
        @static
        */

        model_name: model_name,

        /**
        Static store that can be used by static methods
        @property {Object} store
        @static
        */

        store: options.store,

        /**
        Allows to find model(s) in collection without instantiating this constructor
        @method find
        @static
        @param {Object} query Query object that contains key-values to look for in collection
        @param {Object} options Contains [offset] [limit] [sortkey, sortval]
        @return {Function} Returns a promise that is resolved with query results or error
        */

        find: function(query, options) {
            options = options || {};

            var def = deferred();

            this.store.find(query, options)(function(items) {
                def.resolve(items);
            });

            return def.promise;
        },

        /**
        Returns number of entries in this model's collection by calling db-specific method
        @method count
        @return {Function} Returns a promise that is resolved with number of results
        */

        count: function() {
            return this.store.count();
        }
    });

    /* --- Prototype methods and attributes --- */

    _.extend(ModelConstructor.prototype, {

        /**
        Friendly name of the model
        @property _name
        @private
        */

        _name: model_name,

        /**
        Store instance specific to this model type
        @property _store
        @private
        */

        _store: options.store,

        /**
        Model rules specific to this model type
        @property _schema
        @private
        */

        _schema: options.schema,

        /**
        Formatted query for loading model specific to this model type
        @property _format_query
        @private
        */

        _format_query: format_query,

        /**
        Hooks used in model lifecycle specific to this model type
        @property _hooks
        @private
        */

        _hooks: hooks,

        /**
        Object with info for handling uploads
        @property _uploads
        @private
        */

        _uploads: options.uploads,

        /**
        Object with CRUD permissions
        @property _permissions
        @private
        */

        _permissions: permissions,

        /**
        Object with role functions to check against _permissions
        @property _roles
        @private
        */

        _roles: roles,

        /**
        Resets model properties
        @method _reset_model
        @private
        */

        _reset_model: function() {

            var self = this;

            /* --- Instance "private" attributes --- */

            this._inuse           = false;
            this._isnew           = null;
            this._loading         = deferred();
            this._ready           = this._loading.promise;
            this._attributes      = {};
            this._attributes_orig = {};
            this._allowed         = {};

            /* --- Instance "public" attributes --- */

            this.id      = null;
            this.ready   = this._loading.promise;

            /* --- Reset event listeners --- */

            this.removeAllListeners();

            evt_handlers.call(this, {
                datatypes: datatypes
            });

            /* --- Initialize mixins --- */

            _.each(mixins, function(mixin) {
                mixin.initialize && mixin.initialize.call(self);
            });
        },

        /**
        Initializes model instance
        @method _initialize
        @private
        */

        _initialize: function(query, options) {

            var self = this;

            this.options = options;
            this._inuse = true;

            /* --- Create or load model --- */

            if (_.keys(query).length === 0) {

                this._attributes = _.reduce(this._schema, function(memo, val, key) {
                    memo[key] = val.default;
                    return memo;
                }, {});

                this._isnew = true;

                this._cache_permissions(this._attributes)(function() {
                    self.emit('afterInitialize');
                    self._loading.resolve(self);
                });

            } else {
                this.load(this._format_query(query));
            }
        },

        /**
        Checks if current session user is allowed to perform a CRUD operation
        @method _cache_permissions
        @param {String} crudop
        @private
        */

        _cache_permissions: function(model_data) {

            var self  = this,
                def   = deferred(),
                roles;

            /*
            Iterate through roles and check permission values;
            Add (AND) values for each role listed per activity (CRUD);
            Store these values in this._allowed.create, this._allowed.read etc.
            */

            roles = _.reduce(this._permissions, function(memo, items) {
                memo = memo.concat(items);
                return memo;
            }, []);

            roles = _.uniq(roles);

            deferred.map(roles, function(role) {
                return self._roles[role](model_data, self.options.req || null);
            })(function(results) {

                var allowed = {};

                _.each(results, function(item) {
                    _.extend(allowed, item);
                });

                _.each(self._permissions, function(roles, type) {
                    self._allowed[type] = _.reduce(roles, function(memo, role) {
                        memo = memo || allowed[role];
                        return memo;
                    }, false);
                });

                def.resolve(1);
            });

            return def.promise;
        },

        _is_allowed: function(action) {
            action = String(action).toLowerCase();

            var allowed = this._allowed[action];

            return allowed;
        },

        /**
        Attempts to load model from store and resolve _loading promise with this model
        Checks and caches agent's permissions once model is loaded
        If model is not in the store, it will resolve with error

        @method load
        @param {Object} query Query used by store to retrieve a record
        */

        load: function(query) {
            var self = this;

            this._store.findOne(query)(function(data) {

                data = (self._store.parse) ? self._store.parse(data) : data;

                self._cache_permissions(data)(function() {

                    if (data === null) {
                        self._isnew = true;
                        self._attributes = null;
                    } else {
                        self._isnew = false;
                        self._attributes = data;
                        self._attributes_orig = _.extend({}, data);
                        self.id = self._attributes.id;
                    }

                    self.emit('afterInitialize');
                    self._loading.resolve(self);

                }, function(err) {
                    self._loading.resolve(err);
                });
            }, function(err) {
                self._loading.resolve(err);
            });
        },

        /**
        Retrieves an attribute of the model, or an entire model if attribute name is not provided

        @method get
        @param {String} [attr] Name of the attribute to look for in the model
        @return {Any} Returns value of a signle attribute or the entire model hash
        */

        get: function(attr) {
            if (this._is_allowed(READ)) {
                if (attr === undefined) {
                    return this._attributes;
                } else {
                    return this._attributes[attr];
                }
            } else {
                var err = new Error('You are not allowed to READ this object.');
                this.emit('forbidden', err);
                return err;
            }
        },

        /**
        Assigns new value to an attribute or a number of attributes of the model.
        If given only 1 param which is an Object, method will use keys of the object as attributes.

        @method set
        @param {String} attr Name of attribute to change. It can be an Object if secont param is undefined.
        @param {Any} [val] New value of the attribute.
        @return {Object} self for chaining like model.set({field:data}).save()
        */

        set: function(attr, val) {
            var self    = this,
                changed = false;
            self._attributes = self._attributes || {};
            if (_.isObject(attr) && _.isUndefined(val)) {
                _.each(attr, function(val, key) {
                    if (!self._schema[key].readonly) {
                        self._attributes[key] = val;
                    }
                });
            } else if ((_.isString(attr) || _.isNumber(attr)) && !_.isUndefined(val)) {
                this._attributes[attr] = val;
            }

            return self;
        },

        /**
        Saves a new model or model that has been changed by set()
        @method save
        @return {Function} Returns a promise that will be resolved by this model once entity has been created or updated by the store
        */

        save: function() {
            var self = this,
                def  = deferred(),
                data = {};

            /*******************************************************************************
             *  Only save attributes present in the schema and discart any extra attribute
             *  If attribute not present - use default from schema
             *******************************************************************************/

            _.each(this._schema, function(val, attr) {
                if (self._schema[attr].sync && self._schema[attr].sync === false) {
                    return;
                } else if (self._attributes[attr] !== undefined) {
                    data[attr] = self._attributes[attr];
                } else {
                    data[attr] = val.default;
                }
            });

            this._attributes = data;

            this._ready(function() {
                self.emit('beforeSave');
                self.emit('beforeValidation');

                if (self.validate()) {

                    self.emit('afterValidation');

                    if (self._isnew) {

                        if (self._is_allowed(CREATE)) {
                            self.emit('beforeCreate');

                            self._store.create(self._attributes, self._schema)(function(id){
                                self._isnew = false;
                                self.id = id.toString ? id.toString() : id;
                                self.emit('afterCreate');
                                self.emit('afterSave');
                                def.resolve(self);
                            }, function(err) {
                                def.resolve(err);
                            });
                        } else {
                            var err = new Error('You are not allowed to CREATE this object.');
                            self.emit('forbidden', err);
                            def.resolve(err);
                        }

                    } else {

                        /* --- Attempt to update only attributes that were changed --- */

                        /*
                        data = _.reduce(self._attributes, function(memo, val, attr) {
                            if (!_.isEqual(val, self._attributes_orig[attr])) {
                                memo[attr] = val;
                                //if (attr === 'settings') console.log('not equal:', attr, val.Services.Zeroconf.friendlyname, self._attributes_orig[attr].Services.Zeroconf.friendlyname);
                            } else {
                                //if (attr === 'settings') console.log('equal:', attr, val.Services.Zeroconf.friendlyname, self._attributes_orig[attr].Services.Zeroconf.friendlyname);
                            }
                            return memo;
                        }, {});
                        */

                        data = _.extend({}, self._attributes);

                        if (self._is_allowed(UPDATE)) {
                            self.emit('beforeUpdate');

                            self._store.update(self.id, data)(function(result) {
                                self._isnew = false;
                                self.emit('afterUpdate');
                                self.emit('afterSave');
                                self._attributes_orig = _.extend({}, self._attributes);
                                def.resolve(self);
                            }, function(err) {
                                def.resolve(err);
                            });
                        } else {
                            var err = new Error('You are not allowed to UPDATE this object.');
                            self.emit('forbidden', err);
                            def.resolve(err);
                        }


                    }

                } else {
                    def.resolve(new Error('model_factory.js save() - could not validate model'));
                }
            });

            return def.promise;
        },

        /**
        Deletes model from a store
        @method destroy
        @return {Function} Returns a promise that will be resolved by this model once entity has been deleted from the store
        */

        destroy: function() {
            var self = this,
                def  = deferred();

            this._ready(function() {

                if (self._is_allowed(DESTROY)) {
                    self.emit('beforeDestroy');

                    self._store.destroy(self.id)(function() {
                        self.emit('afterDestroy');

                        self._attributes = null;
                        self._attributes_orig = null;
                        self.__proto__ = Object.prototype;

                        def.resolve(self);
                    });
                } else {
                    var err = new Error('You are not allowed to DESTROY this object.');
                    self.emit('forbidden', err);
                    def.resolve(err);
                }

            });

            return def.promise;
        },

        /**
        Validates model attributes using validators in model schema
        @method validate
        @return {Boolean} Returns true if model is valid, false if model is invalid
        */

        validate: function() {
            var self = this,
                validation_results,
                valid;

            validation_results = _.reduce(this._schema, function(memo, schema_item, attr) {

                var attr_val   = self._attributes[attr],
                    valid_type = true,
                    valid_func = true,
                    valid_perm = true,
                    valid_indx = true;

                /* --- Validate by data type --- */

                if (attr_val !== schema_item.default) {
                    switch (schema_item.type) {
                        case ModelFactory.types.STRING:
                        case ModelFactory.types.PASSWORD:
                            valid_type = _.isString(attr_val) && String(attr_val).length < 256;
                            break;

                        case ModelFactory.types.NUMBER:
                            valid_type = !isNaN(parseFloat(attr_val)) && isFinite(attr_val);
                            break;

                        case ModelFactory.types.DECIMAL:
                            valid_type = !isNaN(parseFloat(attr_val)) && parseFloat(attr_val) % 1 === 0;
                            break;

                        case ModelFactory.types.BOOLEAN:
                            valid_type = _.isBoolean(attr_val);
                            break;

                        case ModelFactory.types.JSON:
                            valid_type = _.isObject(attr_val) || is_json(attr_val);
                            break;

                        case ModelFactory.types.ARRAY:
                            valid_type = _.isArray(attr_val);
                            break;

                        case ModelFactory.types.TEXT:
                            valid_type = _.isString(attr_val);
                            break;

                        case ModelFactory.types.EMAIL:
                            var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            valid_type = re.test(attr_val);
                            break;

                        case ModelFactory.types.IPV4:
                            var re = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;
                            valid_type = re.test(attr_val);
                            break;

                        case ModelFactory.types.DATE:
                        case ModelFactory.types.DATETIME:
                        case ModelFactory.types.TIMESTAMP:
                            valid_type = !isNaN(Date.parse(attr_val));
                            break;

                        default:
                            console.log('ModelFactory validator for %s not implemented', schema_item.type);
                            valid_type = true;
                    }

                    if (!valid_type) {
                        console.log('validate() fail type:', attr, typeof attr_val, attr_val);
                    }
                }

                /* --- Validate by explicit validator --- */

                if (schema_item.validate) {
                    valid_func = schema_item.validate(attr_val) || attr_val === schema_item.default;

                    if (!valid_func) {
                        console.log('validate() fail validator fn:', attr, typeof attr_val, attr_val);
                    }
                }

                /* --- Validate by permitted values --- */

                if (schema_item.permitted) {
                    if (_.isArray(attr_val)) {
                        valid_perm = _.intersection(schema_item.permitted, attr_val).length > 0;
                    } else {
                        valid_perm = schema_item.permitted.indexOf(attr_val) !== -1;
                    }

                    if (!valid_perm) {
                        console.log('validate() fail permitted:', attr, typeof attr_val, attr_val);
                    }
                }

                /* --- Validate required, unique index or primaty index value --- */

                if (schema_item.required || schema_item.index && [indextypes.UNIQUE, indextypes.PRIMARY].indexOf(schema_item.index) !== -1) {
                    valid_indx = attr_val !== schema_item.default && attr_val !== '' && attr_val !== null;

                    if (!valid_indx) {
                        console.log('validate() fail required:', attr, typeof attr_val, attr_val);
                    }
                }

                memo[attr] = valid_type && valid_func && valid_perm && valid_indx;

                return memo;

            }, {});

            valid = _.reduce(validation_results, function(memo, result) {
                memo = memo && result;
                return memo;
            }, true);

            if (!valid) {
                this.emit('error:validation');
            }

            return valid;
        },

        /**
        Returns object with model attributes
        @method toJSON
        @return {Object} Returns an object with model hash
        */

        toJSON: function(key) {
            this.emit('crud:read');

            if (key === undefined) {
                return this._attributes;
            } else {
                return this._attributes[key];
            }
        },

        /**
        Returns HTML for form fields AND <form> tag
        @method toForm
        @return {Object} Returns object with form tag and form inputs
        */

        toForm: function(options) {
            this.emit('crud:read');

            options = options || {};

            var opts = {
                show_hidden : options.show_hidden || false,
                name        : this._name,
                method      : options.method || 'GET',
                url         : options.url || '/'
            }

            return form_builder(this._schema, this._attributes, opts);
        },

        /**
        Returns HTML for form fields AND <form> tag
        @method toTable
        @return {Object} Returns object with table fields data
        */

        toTable: function(options) {
            this.emit('crud:read');

            options = options || {};

            var opts = {
                show_hidden : options.show_hidden || false
            }

            return table_builder(this._schema, this._attributes, opts);
        },

        /**
        Adds values returned from HTML form to model attributes. Similar to set() method
        @method parseForm
        @param {Object} req HTTP request object
        @return {Object} Object which can be used by template engine to create a table
        */

        parseForm: form_parser,

        /**
        Releases this instance for future reuse
        @method release
        */

        release: function() {
            this._reset_model();
        }

    }, options.prototype_methods || {});

    return ModelConstructor;
}

/**
Data types used in schema and validator
@property {Object} types
@static
*/

ModelFactory.types = datatypes;
ModelFactory.indexes = indextypes;
ModelFactory.reusable_pool = reusable_pool;

module.exports = ModelFactory;