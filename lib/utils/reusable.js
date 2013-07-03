var _                = require('underscore'),
    interval_id      = null,
    default_interval = 15000,
    current_interval = default_interval;

/**
Cleans up unused model instances at an interval
@method cleanup
@param ModelFactory {Object} Singleton of Model Factory
@param interval {Number} Interval delay in ms
*/

module.exports.cleanup = function(ModelFactory, interval) {

    interval = interval || default_interval;

    if (interval_id && interval === current_interval) {
        return;
    } else if (interval_id && interval !== current_interval) {
        clearInterval(interval_id);
    }

    interval_id = setInterval(function() {
        _.each(ModelFactory.reusable_pool, function(models, key) {
            while (models.length && !models[0]._inuse) {
                models.splice(0,1)[0] = undefined;
            }

            ModelFactory.reusable_pool[key] = models;
        });
    }, interval);
}

/**
Stops cleanup of model instances
@method stop
*/

module.exports.stop = function() {
    if (interval_id) {
        clearInterval(interval_id);
    }
}