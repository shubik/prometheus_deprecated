var _       = require('underscore'),
    fs      = require('fs'),
    exec    = require('child_process').exec,
    format  = require('util').format;

module.exports = function(path, basename, ext, filename, size) {
    var dim              = size.substr(1),
        dims             = (size[0] === 's') ? dim : dim + 'x' + dim,
        filename_resized = path + basename + '_' + size + ext,
        args             = [],
        command          = '';

    if (clean[0] === 'c') {
        command = format('convert %s%s -resize %s^ -crop %s+0+0 -background white -flatten -gravity center -quality 95 -strip -colorspace RGB -unsharp 0x0.5+0.5+0.05 %s', path, fname_orig, dims_str, dims_str, fname);
    } else if (clean[0] === 's') {
        command = format('convert %s%s -resize %s\> -background white -flatten -gravity center -quality 95 -strip -colorspace RGB -unsharp 0x0.5+0.5+0.05 %s', path, fname_orig, dims_str, fname);
    }

    console.log('about to exec:', command);

    exec(command, function(err, stdout, stderr) {
        if (err) {
            console.log('image could not be resized', err.stack);
        }
    });
}