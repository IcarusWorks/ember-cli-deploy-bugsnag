/* eslint-env node */

'use strict';

var RSVP = require('rsvp');
var fs = require('fs');
var request = require('request-promise');

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
        var jsFilePaths = fetchFilePaths(distFiles, publicUrl, 'js');
        var mapFilePaths = fetchFilePaths(distFiles, distDir, 'map');
        log('Uploading sourcemaps to bugsnag', { verbose: true });

        for (var i = 0; i < mapFilePaths.length; i++) {
          var mapFilePath = mapFilePaths[i];
          var jsFilePath = jsFilePaths[i];
          var formData = {
            apiKey: apiKey,
            overwrite: overwrite,
            minifiedUrl: jsFilePath,
            sourceMap: fs.createReadStream(mapFilePath)
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
    });

    return new DeployPlugin();
  }
};

function fetchFilePaths(distFiles, basePath, type) {
  return distFiles.filter(function(filePath) {
    return new RegExp('assets\/.*\\.' + type + '$').test(filePath);
  })
  .map(function(filePath) {
    return basePath + '/' + filePath;
  });
}
