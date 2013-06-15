var _            = require('underscore'),
    types        = ['create', 'read', 'update', 'destroy', 'transfer'],
    def_callback = function() {};


module.exports = function(options) {

    var self = this;

    _.each(types, function(action) {
        action = String(action);

        var evt = 'crud:' + action,
            str = 'You are not allowed to ' + action.toUpperCase() + ' this object';

        self.on(evt, function() {
            if (!self._allowed[action]) {
                self.emit('forbidden', new Error(str));
            }
        });
    });

    /* --- Setup hooks --- */

    this.on('afterInitialize', this._hooks.afterInitialize || def_callback);
    this.on('beforeValidation', this._hooks.beforeValidation || def_callback);
    this.on('afterValidation', this._hooks.afterValidation || def_callback);
    this.on('beforeSave', this._hooks.beforeSave || def_callback);
    this.on('afterSave', this._hooks.afterSave || def_callback);
    this.on('beforeCreate', this._hooks.beforeCreate || def_callback);
    this.on('afterCreate', this._hooks.afterCreate || def_callback);
    this.on('beforeUpdate', this._hooks.beforeUpdate || def_callback);
    this.on('afterUpdate', this._hooks.afterUpdate || def_callback);
    this.on('beforeDestroy', this._hooks.beforeDestroy || def_callback);
    this.on('afterDestroy', this._hooks.afterDestroy || def_callback);

    /* --- Add timestamp to all model attributes with TIMESTAMP type --- */

    this.on('beforeSave', function() {
        _.each(self._schema, function(val, attr) {
            if (self._schema[attr].type === options.datatypes.TIMESTAMP) {
                self.set(attr, new Date().toString());
            }
        });
    });
}