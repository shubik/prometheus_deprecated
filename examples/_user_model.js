var _             = require('underscore'),
    deferred      = require('deferred'),
    prometheus    = require('../lib'),
    ModelFactory  = prometheus.factory,
    MongodbStore  = prometheus.stores.mongodb,
    MD5           = prometheus.MD5,
    MixinLog      = require('./mixins/log'),
    UserModel,
    model_options,

    /**
    Removes spaces and converts to lower case

    @method normalize_email
    @param {String} str What we believe is an email address
    @return {String} Returns processed string
    */

    normalize_email = function(str) {
        str = str.replace(/^\s+|\s+$/g, '');
        str = str.toLowerCase();
        return str;
    },

    /**
    Tests if string is a valid password. Logic is very simple but you can use something more fancy, e.g. regex
    @method validate_password
    @param {String} str Password string that we want to test
    @return {Boolean} True if password is valid, false if password is invalid
    */

    validate_password = function(str) {
        return str.length > 5;
    };


/* --- User model specific options for generic model factory --- */

model_options = {

    name: 'UserModel',

    store: new MongodbStore({
        collection: 'users'
    }),

    schema: {
        name: {
            name: 'Name',
            default: '',
            type: ModelFactory.types.STRING
        },
        email: {
            name: 'Email',
            default: '',
            type: ModelFactory.types.EMAIL,
            //unique: true,
            index: ModelFactory.indexes.UNIQUE
        },
        password: {
            name: 'Password',
            default: MD5('admin'),
            type: ModelFactory.types.STRING,
            hidden: true
        },
        roles: {
            name: 'Roles',
            default: ['admin'],
            type: ModelFactory.types.ARRAY,
            permitted: ['admin', 'user'],
            hidden: true
        },
        status: {
            name: 'Status',
            default: 'active',
            type: ModelFactory.types.STRING,
            permitted: ['active', 'suspended'],
            hidden: true
        },
        avatar: {
            name: 'Avatar',
            default: '/i/default_avatar.png',
            type: ModelFactory.types.STRING,
            content_type: 'image/jpeg, image/png, image/gif',
            resize: ['c50', 's600x600', 's1200x1200']
        }

    },

    uploads: {
        path: '/home/sasha/development/uploads/',
        path_public: '/uploads/'
    },

    mixins: [MixinLog],

    prototype_methods: {

        /**
        Returns model of user's company if user is not admin
        @method get_company
        @return {Function} Returns a promise which is resolved with user's company model or JSON
        */

        get_company: function() {
            var def  = deferred();

            this._ready(function() {
                console.log('UserModel get_company()');
            });

            return def.promise;
        }
    },

    static_methods: {

        /**
        Authenticates user
        @method login
        @static
        @param {Object} req Request object
        @param {Object} options Object with user credentials
        @return {Function} Returns a promise which is resolved with user JSON or error if authentication failed
        */

        login: function(req, options) {
            var def = deferred();

            if (!req.session) {
                def.resolve(new Error('Can not log in - provided req has no session attribute'));
            } else if (!validate_email(options.email)) {
                def.resolve(new Error('User could not be authorized. Email is invalid.'));
            } else if (!validate_password(options.password)) {
                def.resolve(new Error('User could not be authorized. Password is invalid.'));
            } else {
                var options = {
                        email    : normalize_email(options.email),
                        password : MD5(options.password)
                    };

                UserModel.store.findOne(options)(function(item) {
                    if (item !== null) {
                        delete item.password;
                        req.session.auth = true;
                        req.session.user = item;
                        def.resolve(item);
                    } else {
                        def.resolve(new Error('User could not be authorized. Provided credentials are invalid.'));
                    }
                });
            }

            return def.promise;
        },

        /**
        Closes user's session
        @method logout
        @static
        @param {Object} req Request object
        */

        logout: function(req) {
            req.session.auth = undefined;
            req.session.user = undefined;
            req.session.destroy();
        }
    },

    hooks: {
        beforeSave: function() {
            var password = this.get('password');

            if (password.length !== 32) {
                this.set('password', MD5(password));
            }

            this.set('updated_at', new Date().toString());
        }
    },

    permissions: {
        'create'   : ['admin'],
        'read'     : ['admin', 'user', 'guest'],
        'update'   : ['admin', 'user'],
        'destroy'  : ['admin'],
        'transfer' : ['admin']
    },

    roles: {
        user: function (model, req) {
            var def = deferred(),
                pass = !!(req && req.session.user);

            def.resolve({ user: pass });
            return def.promise;
        },

        admin: function (model, req) {
            var def = deferred(),
                pass = !!(req && req.session.user && req.session.user.roles.indexOf('admin') !== -1);

            def.resolve({ admin: pass });
            return def.promise;
        }
    }
}

UserModel = module.exports = ModelFactory(model_options);