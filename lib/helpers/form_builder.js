/**
Creates object from a model's data that can be used in making HTML forms
@class FormBuilder
@constructor
@param {Object} schema Model's schema
@param {Object} data Model's attributes
@param {Object} options Additional options, e.g. method POST, PUT etc, action URL etc
@return {Object} Returns object with form tag and form inputs
*/

var _         = require('underscore'),
    datatypes = require('../includes/datatypes'),
    FormBuilder;

FormBuilder = function(schema, data, options) {

    var form = {
            tag: {
                name    : options.name || '',
                id      : options.name || '',
                method  : options.method || 'POST',
                action  : options.url,
                enctype : 'application/x-www-form-urlencoded'
            },
            fields: []
        },

        escape_val = function(val) {
            return (_.isString(val)) ? val.replace(/"/g, '&#34;').replace(/'/g, '&#39;') : val;
        },

        make_props = function(props) {
            return _.reduce(props, function(memo, prop) {
                _.each(prop, function(val, attr) {
                    memo += ' ' + attr + '="' + val + '"';
                });
                return memo;
            }, '');
        }

        show_hidden = options.show_hidden || false;

        make = {

            /**
            Creates <input ="text/file/email/tel/url/number/date"> field
            @method text
            @param {Object} obj Object containing data for the field
            @return {Array} Returns array with input tags
            */

            text: function(obj) {

                var props = [],
                    type,
                    tag;

                if (obj.content_type) {
                    type = 'file';
                    form.tag.enctype = 'multipart/form-data';
                } else if (obj.type === datatypes.EMAIL) {
                    type = 'email';
                } else if (obj.type === datatypes.PHONE) {
                    type = 'tel';
                } else if (obj.type === datatypes.URL) {
                    type = 'url';
                } else if (obj.type === datatypes.NUMBER || obj.type === datatypes.DECIMAL) {
                    type = 'number';
                } else if (obj.type === datatypes.DATE) {
                    type = 'date';
                } else if (obj.type === datatypes.DATETIME || obj.type === datatypes.TIMESTAMP) {
                    type = 'datetime';
                } else if (obj.type === datatypes.TIME) {
                    type = 'time';
                } else if (obj.type === datatypes.COLOR) {
                    type = 'color';
                } else if (obj.type === datatypes.PASSWORD) {
                    type = 'password';
                } else {
                    type = 'text';
                }

                /* --- Required properties --- */

                props.push({ type  : type });
                props.push({ name  : obj.attr });
                props.push({ 'data-for': obj.attr });
                props.push({ id    : obj.id });
                props.push({ value : obj.val_escaped });
                props.push({ class : 'form-control' });

                /* --- Optional properties --- */

                if (obj.maxlength) {
                    props.push({ maxlength: obj.maxlength });
                }

                if (obj.readonly) {
                    props.push({ readonly: obj.readonly });
                }

                if (obj.content_type) {
                    props.push({ accept: obj.content_type });
                }

                /* --- Build HTML tag --- */

                tag = '<input' + make_props(props) + ' />';

                if (type === 'file') {
                    tag = '<span class="inp-file" data-filename="">' + tag + '</span>';
                }

                return [tag];
            },

            /**
            Creates <input ="checkbox"> field
            @method checkbox
            @param {Object} obj Object containing data for the field
            @return {Array} Returns array with input tags
            */

            checkbox: function(obj) {
                var tags = [];

                /* --- Value is an array ---- */

                _.each(obj.permitted, function(val, index) {
                    var val_escaped = escape_val(val),
                        props       = [],
                        id          = obj.id + '_' + index,
                        tag;

                    /* --- Required properties --- */

                    props.push({ type  : 'checkbox' });
                    props.push({ id    : id });
                    props.push({ name  : obj.attr });
                    props.push({ 'data-for': obj.attr });
                    props.push({ value : index });
                    props.push({ class : 'form-control' });

                    /* --- Optional properties --- */

                    if (obj.val.indexOf(val) !== -1) {
                        props.push({ checked: 'checked' });
                    }

                    /* --- Build HTML tag --- */

                    tag = '<input' + make_props(props) + ' /><label for="' + id + '">' + val + '</label>';

                    tags.push(tag);
                });

                return tags;
            },

            /**
            Creates <input ="radio"> field
            @method radio
            @param {Object} obj Object containing data for the field
            @return {Array} Returns array with input tags
            */

            radio: function(obj) {
                var tags = [];

                _.each(obj.permitted, function(val, index) {
                    var val_escaped = escape_val(val),
                        props       = [],
                        id          = obj.id + '_' + index,
                        tag;

                    /* --- Required properties --- */

                    props.push({ type  : 'radio' });
                    props.push({ id    : id });
                    props.push({ name  : obj.attr });
                    props.push({ 'data-for': obj.attr });
                    props.push({ value : index });

                    /* --- Optional properties --- */

                    if (obj.val == val || (_.isArray(obj.val) && obj.val.indexOf(val) !== -1)) {
                        props.push({ checked: 'checked' });
                    }

                    /* --- Build HTML tag --- */

                    tag = '<input' + make_props(props) + ' /><label for="' + id + '">' + val + '</label>';

                    tags.push(tag);
                });

                return tags;
            },

            /**
            Creates <textarea> field
            @method checkbox
            @param {Object} obj Object containing data for the field
            @return {Array} Returns array with input tags
            */

            textarea: function(obj) {
                var val = String(obj.val).replace(/"/g, '&#34;').replace(/'/g, '&#39;'),
                    props = [],
                    tag;

                /* --- Required properties --- */

                props.push({ name  : obj.attr });
                props.push({ 'data-for': obj.attr });
                props.push({ id    : obj.id });
                props.push({ class : 'form-control' });

                /* --- Optional properties --- */

                if (obj.readonly) {
                    props.push({ readonly: obj.readonly });
                }

                /* --- Build HTML tag --- */

                tag = '<textarea' + make_props(props) + '>' + obj.val_escaped + '</textarea>';

                return [tag];
            },

            /**
            Creates <select> field
            @method select
            @param {Object} obj Object containing data for the field
            @return {Array} Returns array with input tags
            */

            select: function(obj) {
                var multiple = _.isArray(obj.val) ? ' multiple="multiple"' : '',
                    props    = [],
                    options  = _.reduce(obj.permitted, function(memo, val, index) {
                        var checked;

                        if (multiple) {
                            checked = (obj.val.indexOf(val) !== -1) ? true : false;
                        } else {
                            checked = (obj.val == val) ? true : false;
                        }

                        if (checked) {
                            memo += '<option value="' + index + '" checked="checked">' + val + '</option>';
                        } else {
                            memo += '<option value="' + index + '">' + val + '</option>';
                        }

                        return memo;
                    }, ''),
                    tag;

                /* --- Required properties --- */

                props.push({ name  : obj.attr });
                props.push({ 'data-for' : obj.attr });
                props.push({ id    : obj.id });
                props.push({ class : 'form-control' });

                /* --- Optional properties --- */

                if (multiple) {
                    props.push({ multiple: 'multiple' });
                }

                /* --- Build HTML tag --- */

                tag = '<select' + make_props(props) + '>' + options + '</select>';

                return [tag];
            },

            /**
            Creates a custom field
            @method custom
            @param {Object} obj Object containing data for the field
            @return {Array} Returns array with input tags
            */

            custom: function(obj) {
                return {
                    type: 'other',
                    inputs: [obj.maketag(obj.val)]
                }
            }
        };

    /* --- Iterate through provided fields --- */

    _.each(schema, function(_obj, attr) {

        var obj = _.extend({}, _obj);

        /* --- Do not generate hidden tags --- */

        if (obj.hidden && !show_hidden) {
            return;
        }

        var field = {
                label: obj.name,
                type: null,
                inputs: []
            },
            multiple = _.isArray(obj.val),
            tags;

        obj.id   = form.tag.name + '_' + attr;
        obj.attr = attr;
        obj.val  = data[attr] || obj.default;

        /* --- Convert values to strings and escape --- */

        switch (obj.type) {
            case datatypes.JSON:
            case datatypes.ARRAY:
                obj.val_escaped = JSON.stringify(obj.val);
                break;

            default:
                obj.val_escaped = (obj.val === null) ? '' : escape_val(String(obj.val));
        }

        /* --- Use appropriate tag generator --- */

        if (obj.maketag && _.isFunction(obj.maketag)) {
            var custom = make.custom(obj);
            field.type = custom.type;
            field.inputs = custom.inputs;
        } else if (obj.permitted && obj.permitted.length <= 3 && !multiple) {
            field.type = 'radio';
            field.inputs = make.radio(obj);
        } else if (obj.permitted && obj.permitted.length <= 3 &&  multiple) {
            field.type = 'checkbox';
            field.inputs = make.checkbox(obj);
        } else if (obj.permitted && obj.permitted.length > 3) {
            field.type = 'select';
            field.inputs = make.select(obj);
        } else if (obj.type === datatypes.TEXT || (obj.maxlength && obj.maxlength > 255)) {
            field.type = 'textarea';
            field.inputs = make.textarea(obj);
        } else {
            field.type = 'text';
            field.inputs = make.text(obj);
        }

        form.fields.push(field);
    });

    return form;
}

module.exports = FormBuilder;