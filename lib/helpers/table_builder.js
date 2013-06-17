/**
Creates object from a model's data that can be used in making HTML forms
@class TableBuilder
@constructor
@param {Object} schema Model's schema
@param {Object} data Model's attributes
@param {Object} options Additional options, e.g. classnames etc
@return {Object} Returns object with field meta information
*/

var _         = require('underscore'),
    datatypes = require('../includes/datatypes'),

    TableBuilder = function(schema, data, options) {

        var table       = {
                tbody: []
            },
            show_hidden = options.show_hidden || false;

        table.tbody = _.reduce(data, function(memo, val, attr) {

            if (schema[attr] === undefined) {
                console.log('attr does not exist', attr);
                return memo;
            } else if (!show_hidden && schema[attr].hidden) {
                console.log('attr hidden');
                return memo;
            } else {

                var row = [];
                row.push(schema[attr].name);

                switch(schema[attr].type) {
                    case datatypes.EMAIL:
                        row.push('<a href="mailto:' + val + '">' + val + '</a>');
                        break;

                    case datatypes.URL:
                        row.push('<a href="' + val + '" target="_blank">' + val + '</a>');
                        break;

                    case datatypes.IPV4:
                        row.push('<a href="http://' + val + '" target="_blank">' + val + '</a>');
                        break;

                    case datatypes.JSON:
                        row.push(JSON.stringify(val));
                        break;

                    case datatypes.STRING:
                        if (schema[attr].content_type) {
                            row.push('<a href="' + String(val) + '" target="_blank">' + String(val) + '</a>');
                        } else {
                            row.push(String(val));
                        }
                        break;

                    default:
                        row.push(String(val));
                }

                memo.push(row);
                return memo;
            }
        }, []);

        return table;
    };

module.exports = TableBuilder;