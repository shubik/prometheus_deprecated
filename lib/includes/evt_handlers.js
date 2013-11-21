var _     = require('underscore'),
    hooks = ['afterInitialize', 'beforeValidation', 'afterValidation', 'beforeSave', 'afterSave', 'beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate', 'beforeDestroy', 'afterDestroy', 'beforeTransfer', 'afterTransfer'];


module.exports = function(options) {

    var self = this;

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