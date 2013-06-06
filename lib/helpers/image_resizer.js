var _            = require('underscore'),
    fs           = require('fs'),
    exec         = require('child_process').exec,
    format       = require('util').format,
    default_opts = {
        background: 'white',
        gravity: 'center',
        quality: 95,
        strip: '',
        colorspace: 'RGB',
        unsharp: '0x0.5+0.5+0.05'
    },
    convert = function(src, dest, options) {
        var opts = _.extend({}, default_opts, options || {}),
            args = _.reduce(opts, function(memo, val, opt) {
                memo.push('-' + opt + ' ' + val);
                return memo;
            }, []),
            command;

        args.splice(0, 0, 'convert ' + src);
        args.push(dest);

        command = args.join(' ');

        exec(command, function(err, stdout, stderr) {
            if (err) {
                console.log('image could not be resized', err.stack);
            }
        });
    };

module.exports = function(path, basename, ext, size) {
    var dim     = size.substr(1),
        dims    = (size[0] === 's') ? dim : dim + 'x' + dim,
        src     = path + basename + ext,
        dest    = path + basename + '_' + size + ext,
        args    = {},
        command = '';

    if (clean[0] === 'c') {
        args.resize = format('%s^', dims);
        args.crop   = format('%s+0+0', dims);
        convert(src, dest, args);
    } else if (clean[0] === 's') {
        args.resize = format('%s\>', dims);
        convert(src, dest, args);
    }
}