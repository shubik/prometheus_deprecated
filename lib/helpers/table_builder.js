/**
Creates object from a model's data that can be used in making HTML forms
@class TableBuilder
@constructor
@param {Object} schema Model's schema
@param {Object} data Model's attributes
@param {Object} options Additional options, e.g. classnames etc
@return {Object} Returns object with field meta information
*/

var TableBuilder = function(schema, data, options) {
    var table       = {
            tbody: []
        },
        show_hidden = options.show_hidden || false;

    table.tbody = _.reduce(data, function(memo, val, attr) {
        if (schema[attr] === undefined) {
            return memo;
        } else if (!show_hidden && schema[attr].hidden) {
            return memo;
        } else {
            var row = [];
            row.push(schema[attr].name);

            switch(attr) {
                case 'email':
                    row.push('<a href="mailto:' + val + '">' + val + '</a>');
                    break;

                case 'url':
                case 'logo':
                case 'image':
                case 'avatar':
                    row.push('<a href="' + val + '" target="_blank">' + val + '</a>');
                    break

                default:
                    row.push((val.toString) ? val.toString() : val);
            }

            memo.push(row);
            return memo;
        }
    }, []);

    return table;
}

module.exports = TableBuilder;