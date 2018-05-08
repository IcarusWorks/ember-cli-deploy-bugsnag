/* eslint-env node */

'use strict';

var RSVP = require('rsvp');
var fs = require('fs');
var path = require('path');
var request = require('request-promise');
var zlib = require('zlib');

var BasePlugin = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-bugsnag',

  createDeployPlugin: function(options) {
    var DeployPlugin = BasePlugin.extend({
      name: options.name,

      defaultConfig: {
        distDir: function(context) {
          return context.distDir;
        },
        distFiles: function(context) {
          return context.distFiles;
        },
        gzippedFiles: function(context) {
          return context.gzippedFiles || [];
        },
        revisionKey: function(context) {
          if (context.revisionData) {
            return context.revisionData.revisionKey;
          } else {
            return process.env.SOURCE_VERSION || '';
          }
        },
        includeAppVersion: true,
        deleteSourcemaps: true,
        overwrite: 'true',
      },

      requiredConfig: ['apiKey', 'publicUrl'],

      upload: function() {
        var log = this.log.bind(this);
        var apiKey = this.readConfig('apiKey');
        var revisionKey = this.readConfig('revisionKey');
        var distDir = this.readConfig('distDir');
        var distFiles = this.readConfig('distFiles');
        var publicUrl = this.readConfig('publicUrl');
        var overwrite = this.readConfig('overwrite');
        var includeAppVersion = this.readConfig('includeAppVersion');
        var promises = [];
        var jsMapPairs = fetchJSMapPairs(distFiles, publicUrl, distDir);
        log('Uploading sourcemaps to bugsnag', { verbose: true });

        for (var i = 0; i < jsMapPairs.length; i++) {
          var mapFilePath = jsMapPairs[i].mapFile;
          var jsFilePath = jsMapPairs[i].jsFile;
          var formData = {
            apiKey: apiKey,
            overwrite: overwrite,
            minifiedUrl: jsFilePath,
            sourceMap: this._readSourceMap(mapFilePath)
          };
          if (revisionKey && includeAppVersion) {
            formData.appVersion = revisionKey;
          }
          var promise = request({
            uri: 'https://upload.bugsnag.com',
            method: 'POST',
            formData: formData
          });
          promises.push(promise);
        }
        return RSVP.all(promises)
          .then(function() {
            log('Finished uploading sourcemaps', { verbose: true });
          });
      },

      didUpload() {
        this.log('Deleting sourcemaps', { verbose: true });
        var deleteSourcemaps = this.readConfig('deleteSourcemaps');
        if (deleteSourcemaps) {
          var distDir = this.readConfig('distDir');
          var distFiles = this.readConfig('distFiles');
          var mapFilePaths = fetchFilePaths(distFiles, distDir, 'map');
          var promises = mapFilePaths.map(function(mapFilePath) {
            return new RSVP.Promise(function(resolve, reject) {
              fs.unlink(mapFilePath, function(err) {
                if (err) {
                  reject();
                } else {
                  resolve();
                }
              });
            });
          });

          return RSVP.all(promises);
        }
      },

      _readSourceMap(mapFilePath) {
        var relativeMapFilePath = mapFilePath.replace(this.readConfig('distDir') + '/', '');
        if (this.readConfig('gzippedFiles').indexOf(relativeMapFilePath) !== -1) {
          // When the source map is gzipped, we need to eagerly load it into a buffer
          // so that the actual content length is known.
          return {
            value: zlib.unzipSync(fs.readFileSync(mapFilePath)),
            options: {
              filename: path.basename(mapFilePath),
            }
          };
        } else {
          return fs.createReadStream(mapFilePath);
        }
      }
    });

    return new DeployPlugin();
  }
};

function fetchJSMapPairs(distFiles, publicUrl, distUrl) {
  var jsFiles = indexByBaseFilename(fetchFilePaths(distFiles, '', 'js'));
  return fetchFilePaths(distFiles, '', 'map').map(function(mapFile) {
    return {
      mapFile: distUrl + mapFile,
      jsFile: publicUrl + jsFiles[getBaseFilename(mapFile)]
    };
  });
}

function indexByBaseFilename(files) {
  return files.reduce(function(result, file) {
    result[getBaseFilename(file)] = file;
    return result;
  }, {});
}

function getBaseFilename(file) {
  return file.replace(/-[0-9a-f]+\.(js|map)$/, '');
}

function fetchFilePaths(distFiles, basePath, type) {
  return distFiles.filter(function(filePath) {
    return new RegExp('assets\/.*\\.' + type + '$').test(filePath);
  })
  .map(function(filePath) {
    return basePath + '/' + filePath;
  });
}
