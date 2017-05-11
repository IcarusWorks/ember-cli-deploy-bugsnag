/* jshint node: true */
'use strict';

var RSVP = require('rsvp');
var fs = require('fs');
var FormData = require('form-data');

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
      },

      requiredConfig: ['apiKey', 'baseUrl'],

      upload: function() {
        var log = this.log.bind(this);
        var apiKey = this.readConfig('apiKey');
        var revisionKey = this.readConfig('revisionKey');
        var distDir = this.readConfig('distDir');
        var distFiles = this.readConfig('distFiles');
        var baseUrl = this.readConfig('baseUrl');
        var promises = [];
        var jsFiles = distFiles.filter(function(file) {
          return /assets\/.*\.js$/.test(file);
        });
        var mapFiles = distFiles.filter(function(file) {
          return /assets\/.*\.map$/.test(file);
        });
        log('Uploading sourcemaps to bugsnag');

        for (var i = 0; i < mapFiles.length; i++) {
          var mapFile = mapFiles[i];
          var jsFile = jsFiles[i];
          var mapFilePath = distDir + '/' + mapFile;
          var jsFilePath = baseUrl + '/' + jsFile;
          var formData = new FormData();
          formData.append('apiKey', apiKey);
          formData.append('version', revisionKey);
          formData.append('minifiedUrl', jsFilePath);
          formData.append('sourceMap', fs.createReadStream(mapFilePath));
          var promise = request(formData);
          promises.push(promise);
        }
        return RSVP.all(promises)
          .then(function() {
            log('Finished upload');
          });
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
