var _     = require('underscore'),
    types = ['create', 'read', 'update', 'destroy', 'transfer'],
    hooks = ['afterInitialize', 'beforeValidation', 'afterValidation', 'beforeSave', 'afterSave', 'beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate', 'beforeDestroy', 'afterDestroy', 'beforeTransfer', 'afterTransfer'];


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

    var def_callback = function() {};

    _.each(hooks, function(hook) {
        self.on(hook, self._hooks[hook] || def_callback);
    });

    /* --- Add timestamp to all model attributes with TIMESTAMP type --- */

    this.on('beforeSave', function() {
        _.each(self._schema, function(val, attr) {
            if (self._schema[attr].type === options.datatypes.TIMESTAMP) {
                self.set(attr, new Date().toString());
            }
        });
    });
}