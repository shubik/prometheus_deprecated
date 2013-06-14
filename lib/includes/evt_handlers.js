var types        = ['create', 'read', 'update', 'destroy', 'transfer'],
    def_callback = function() {};


module.exports = function(options) {

    var ctx = this;

    _.each(types, function(action) {
        action = String(action);

        var evt = 'crud:' + action,
            str = 'You are not allowed to ' + action.toUpperCase() + ' this object';

        ctx.on(evt, function() {
            if (!ctx._allowed[evt]) {
                ctx.emit('forbidden', new Error(str));
            }
        });
    });

    /* --- Setup hooks --- */

    ctx.on('afterInitialize', ctx._hooks.afterInitialize || def_callback);
    ctx.on('beforeValidation', ctx._hooks.beforeValidation || def_callback);
    ctx.on('afterValidation', ctx._hooks.afterValidation || def_callback);
    ctx.on('beforeSave', ctx._hooks.beforeSave || def_callback);
    ctx.on('afterSave', ctx._hooks.afterSave || def_callback);
    ctx.on('beforeCreate', ctx._hooks.beforeCreate || def_callback);
    ctx.on('afterCreate', ctx._hooks.afterCreate || def_callback);
    ctx.on('beforeUpdate', ctx._hooks.beforeUpdate || def_callback);
    ctx.on('afterUpdate', ctx._hooks.afterUpdate || def_callback);
    ctx.on('beforeDestroy', ctx._hooks.beforeDestroy || def_callback);
    ctx.on('afterDestroy', ctx._hooks.afterDestroy || def_callback);

    /* --- Add timestamp to all model attributes with TIMESTAMP type --- */

    ctx.on('beforeSave', function() {
        _.each(ctx._schema, function(val, attr) {
            if (ctx._schema[attr].type === options.datatypes.TIMESTAMP) {
                ctx.set(attr, new Date().toString());
            }
        });
    });
}