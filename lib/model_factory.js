var _             = require('underscore'),
    Events        = require('events').EventEmitter,
    deferred      = require('deferred'),
    form_builder  = require('./helpers/form_builder'),
    form_parser   = require('./helpers/form_parser'),
    table_builder = require('./helpers/table_builder'),
    datatypes     = require('./includes/datatypes'),
    roles_default = require('./includes/roles'),
    evt_handlers  = require('./includes/evt_handlers'),
    events,
    Forbidden,
    ModelFactory;

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
        roles        = _.extend({}, roles_default, options.roles || {});

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

        var self = this;

        /* --- Instance "private" attributes --- */

        this._isnew           = null;
        this._loading         = deferred();
        this._ready           = this._loading.promise;
        this._attributes      = {};
        this._attributes_orig = {};
        this._allowed         = {};

        /* --- Instance "public" attributes --- */

        this.options = options;
        this.id      = null;
        this.ready   = this._loading.promise;

        /* --- Make sure schema item keys do not clash with this model methods and properties --- */

        _.each(this._schema, function(item, attr) {
            if (self[attr] || self.__proto__[attr]) {
                throw new Error('ModelConstructor(): schema item clashes with model method or property: ' + attr);
            }
        });

        /* --- Event subscribers --- */

        evt_handlers.call(this, {
            datatypes: datatypes
        });

        /* --- Create or load model --- */

        if (_.keys(query).length === 0) {

            this._attributes = _.reduce(this._schema, function(memo, val, key) {
                memo[key] = val.default;
                return memo;
            }, {});

            this._isnew = true;
            this.emit('afterInitialize');
            this._loading.resolve(this);

        } else {

            this.load(this._format_query(query));

        }

        /* --- Define setters and getters --- */

        _.each(this._schema, function(item, attr) {
            self.__defineSetter__(attr, function(val) {
                self._attributes[attr] = val;
            });

            self.__defineGetter__(attr, function() {
                return self._attributes[attr];
            });
        });

        /* --- Initialize mixins --- */

        _.each(mixins, function(mixin) {
            mixin.initialize && mixin.initialize.call(self);
        });

        return this;
    }

    /* --- Static methods and attributes --- */

    _.extend(ModelConstructor, options.static_methods || {}, {

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

    events = new Events;
    events.setMaxListeners(0);

    _.extend(ModelConstructor.prototype, events, {

        /**
        Friendly name of this model
        @property _name
        @private
        */

        _name: options.name,

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

        _hooks: options.hooks,

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
            this.emit('crud:read');

            if (attr === undefined) {
                return this._attributes;
            } else {
                return this._attributes[attr];
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

                        self.emit('crud:create');
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

                        /* --- Attempt to update only attributes that were changed --- */

                        data = _.reduce(self._attributes, function(memo, val, attr) {
                            if (val !== self._attributes_orig[attr]) {
                                memo[attr] = val;
                            }
                            return memo;
                        }, {});

                        self.emit('crud:update');
                        self.emit('beforeUpdate');

                        self._store.update(self.id, data)(function() {
                            self._isnew = false;
                            self.emit('afterUpdate');
                            self.emit('afterSave');
                            self._attributes_orig = _.extend({}, self._attributes);
                            def.resolve(self);
                        }, function(err) {
                            def.resolve(err);
                        });

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

                self.emit('crud:destroy');
                self.emit('beforeDestroy');

                self._store.destroy(self.id)(function() {
                    self.emit('afterDestroy');

                    self._attributes = null;
                    self._attributes_orig = null;
                    self.__proto__ = Object.prototype;

                    def.resolve(self);
                });
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
                valid;

            function isJSON (str) {
                try {
                    JSON.parse(str);
                } catch (e) {
                    return false;
                }
                return true;
            }

            valid = _.reduce(this._schema, function(memo, val, attr) {

                var pass     = true,
                    attr_val = self._attributes[attr];

                /* --- Validate by data type --- */

                if (attr_val !== val.default) {
                    switch (val.type) {
                        case ModelFactory.types.STRING:
                            pass = _.isString(attr_val) && String(attr_val).length < 256;
                            break;

                        case ModelFactory.types.NUMBER:
                            pass = !isNaN(parseFloat(attr_val)) && isFinite(attr_val);
                            break;

                        case ModelFactory.types.DECIMAL:
                            pass = !isNaN(parseFloat(attr_val)) && parseFloat(attr_val) % 1 === 0;
                            break;

                        case ModelFactory.types.BOOLEAN:
                            pass = _.isBoolean(attr_val);
                            break;

                        case ModelFactory.types.JSON:
                            pass = _.isObject(attr_val) || isJSON(attr_val);
                            break;

                        case ModelFactory.types.ARRAY:
                            pass = _.isArray(attr_val);
                            break;

                        case ModelFactory.types.TEXT:
                            pass = _.isString(attr_val);
                            break;

                        case ModelFactory.types.EMAIL:
                            var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            pass = re.test(attr_val);
                            break;

                        case ModelFactory.types.IPV4:
                            var re = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;
                            pass = re.test(attr_val);
                            break;

                        case ModelFactory.types.DATE:
                        case ModelFactory.types.DATETIME:
                        case ModelFactory.types.TIMESTAMP:
                            pass = !isNaN(Date.parse(attr_val));
                            break;

                        default:
                            console.log('ModelFactory validator for %s not implemented', val.type);
                            pass = true;
                    }

                    if (!pass) {
                        console.log('validate() fail type:', attr, typeof attr_val, attr_val, val);
                    }

                    memo = memo && pass;
                }

                /* --- Validate by explicit validator --- */

                if (val.validate) {
                    pass = val.validate(attr_val) || attr_val === val.default;
                    memo = memo && pass;

                    if (!pass) {
                        console.log('validate() fail validator:', attr, typeof attr_val, attr_val, val);
                    }
                }

                /* --- Validate by permitted values --- */

                if (val.permitted) {
                    if (_.isArray(attr_val)) {
                        pass = _.intersection(val.permitted, attr_val).length > 0;
                    } else {
                        pass = val.permitted.indexOf(attr_val) !== -1;
                    }

                    memo = memo && pass;

                    if (!pass) {
                        console.log('validate() fail permitted:', attr, typeof attr_val, attr_val, val);
                    }
                }

                return memo;

            }, true);

            if (!valid) {
                console.log('invalid model:', self._attributes);
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
        */

        parseForm: form_parser

    }, options.prototype_methods || {});

    return ModelConstructor;
}

/**
Data types used in schema and validator
@property {Object} types
@static
*/

ModelFactory.types = datatypes;
ModelFactory.Forbidden = Forbidden;

module.exports = ModelFactory;
