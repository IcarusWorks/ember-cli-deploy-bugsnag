/* jshint node: true */
'use strict';

var BasePlugin = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-bugsnag',

  createDeployPlugin: function(options) {
    var DeployPlugin = BasePlugin.extend({
      name: options.name,

      requiredConfig: ['apiKey'],

      upload: function(/* context */) {
        this.log('Uploading sourcemaps to Bugsnag');
        //do something here to actually deploy your app somewhere
      },
    });

    return new DeployPlugin();
  }
};
