'use strict';
/**
 * Created by fa.kolbeshin on 21.12.2017.
 */

var
    fs = require('fs'),
    UglifyJS = require('uglify-js'),
    humanize = require('humanize'),
    path = require('path');

module.exports = function uglifyJsTask(grunt) {
    grunt.registerMultiTask('uglify', 'Задача минификации JS', function() {
        grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача uglify.`);
        var
            getAvailableFiles = function (filesArray) {
                return filesArray.filter(function (filepath) {
                    if (!grunt.file.exists(filepath)) {
                        grunt.log.warn('Source file ' + filepath + ' not found');
                        return false;
                    }
                    return true;
                });
            },
            /**
             * Опция isPresentationService описывает, Препроцессор или Сервис Представлений мы используем.
             * Она нам пригодится, чтобы на Препроцессоре не генерить SourceMaps, поскольку в целях отладки
             * там присутствует /debug
             */
            isPresentationService =  grunt.file.exists(path.join(process.env.ROOT, 'resources', 'WS.Core'));
        // Iterate over all src-dest file pairs.
        this.files.forEach(function (currentFile) {
            var availableFiles = getAvailableFiles(currentFile.src);
            if (availableFiles.length === 0) {
                grunt.log.warn('Destination ' + currentFile.dest + ' not written because src files were empty.');
                return;
            }
            availableFiles.forEach(function(file) {
                var
                    currentPath = path.normalize(file),
                    data = fs.readFileSync(currentPath, 'utf8'),
                    sourceJSPath = currentPath.replace(/\.js$/, '.source.js'),
                    sourceMapPath = `${currentPath}.map`,
                    dataObject = {},
                    minifyOptions = {
                        mangle: {
                            eval: true
                        }
                    };
                if (isPresentationService) {
                    fs.writeFileSync(sourceJSPath, data);
                    minifyOptions.sourceMap = {
                        url: path.basename(sourceMapPath)
                    };

                }
                dataObject[path.basename(sourceJSPath)] = data;

                try {
                    let minified = UglifyJS.minify(dataObject, minifyOptions);
                    if (!minified.error && minified.code) {
                        data = minified;
                    }
                } catch (minerr) {
                    grunt.log.warn(`Error while minifiing js! ${minerr.message}, in file: ${fullPath}`);
                }
                fs.writeFileSync(currentPath, data.code);
                if (isPresentationService) {
                    fs.writeFileSync(sourceMapPath, data.map);
                }
                grunt.log.ok(`File ${currentPath} successfully minified`);
            });
        });
    }, function (err) {
        if (err) {
            grunt.fail.fatal(err);
        }

        grunt.log.ok(`${humanize.date('H:i:s')} : Задача uglify выполнена.`);
        done();
    });
};
