module.exports = {
    lengthOf: function(options, val) {
        if (!_.isString(val)) {
            return false;
        }

        var len = val.length,
            valid = true;

        if (options.min) {
            valid = valid && len >= options.min;
        }

        if (options.max) {
            valid = valid && len <= options.max;
        }

        if (options.exact) {
            valid = valid && len == options.exact;
        }

        return valid;
    },

    numericValueOf: function(options, val) {
        if (_.isNaN(val)) {
            return false;
        }

        var valid = true;

        if (options.min) {
            valid = valid && val >= options.min;
        }

        if (options.max) {
            valid = valid && val <= options.max;
        }

        if (options.exact) {
            valid = valid && val == options.exact;
        }

        return valid;
    },

    inclusionOf: function(list, val) {
        return list.indexOf(val) !== -1;
    },

    exclusionOf: function(list, val) {
        return list.indexOf(val) === -1;
    },

    isEmail: function(val) {
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(val);
    },

    isNumeric: function(val) {
        return !isNaN(parseFloat(val)) && isFinite(val);
    }
}