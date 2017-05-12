/* jshint node: true */
'use strict';

var RSVP = require('rsvp');
var fs = require('fs');
var FormData = require('form-data');
var path = require('path');

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
          return context.revisionData && context.revisionData.revisionKey;
        },
        deleteSourcemaps: true,
      },

      requiredConfig: ['apiKey', 'publicUrl'],

      upload: function() {
        var log = this.log.bind(this);
        var apiKey = this.readConfig('apiKey');
        var revisionKey = this.readConfig('revisionKey');
        var distDir = this.readConfig('distDir');
        var distFiles = this.readConfig('distFiles');
        var publicUrl = this.readConfig('publicUrl');
        var promises = [];
        var jsFilePaths = fetchFilePaths(distFiles, publicUrl, 'js');
        var mapFilePaths = fetchFilePaths(distFiles, distDir, 'map');
        log('Uploading sourcemaps to bugsnag');

        for (var i = 0; i < mapFilePaths.length; i++) {
          var mapFilePath = mapFilePaths[i];
          var jsFilePath = jsFilePaths[i];
          var formData = new FormData();
          formData.append('apiKey', apiKey);
          formData.append('appVersion', revisionKey);
          formData.append('minifiedUrl', jsFilePath);
          formData.append('sourceMap', fs.createReadStream(mapFilePath));
          var promise = request(formData);
          promises.push(promise);
        }
        return RSVP.all(promises)
          .then(function() {
            log('Finished uploading sourcemaps');
          });
      },

      didUpload() {
        this.log('Deleting sourcemaps');
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

function request(formData) {
  return new RSVP.Promise(function(resolve, reject) {
    formData.submit('https://upload.bugsnag.com', function(error, result) {
      if(error) {
        reject(error);
      }
      result.resume();

      result.on('end', function() {
        resolve();
      });
    });
  });
}

function fetchFilePaths(distFiles, basePath, type) {
  return distFiles.filter(function(filePath) {
    return new RegExp('assets\/.*\\.' + type + '$').test(filePath);
  })
  .map(function(filePath) {
    return path.join(basePath, filePath);
  });
}
