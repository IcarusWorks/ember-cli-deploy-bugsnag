# ember-cli-deploy-bugsnag

[![NPM release][npm-badge]][npm-badge-url]
[![Build][travis-badge]][travis-badge-url]
[![Ember Observer][ember-observer-badge]][ember-observer-badge-url]

[npm-badge]: https://img.shields.io/npm/v/ember-cli-deploy-bugsnag.svg
[npm-badge-url]: https://www.npmjs.com/package/ember-cli-deploy-bugsnag
[travis-badge]: https://travis-ci.org/IcarusWorks/ember-cli-deploy-bugsnag.svg?branch=master
[travis-badge-url]: https://travis-ci.org/IcarusWorks/ember-cli-deploy-bugsnag
[ember-observer-badge]: http://emberobserver.com/badges/ember-cli-deploy-bugsnag.svg
[ember-observer-badge-url]: http://emberobserver.com/addons/ember-cli-deploy-bugsnag

An [Ember CLI Deploy](http://ember-cli-deploy.com/) plugin for [uploading sourcemaps to Bugsnag](https://docs.bugsnag.com/api/js-source-map-upload/).

To send errors to Bugsnag, see [`ember-cli-bugsnag`](https://github.com/binhums/ember-cli-bugsnag).

## Installation

* `ember install ember-cli-deploy ember-cli-deploy-build ember-cli-deploy-bugsnag`

### Quick start

Enable sourcemaps for all environments in `ember-cli-build.js`:

```js
/* jshint node:true */
/* global require, module */
var EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function(defaults) {
  var app = new EmberApp(defaults, {
    // …
    sourcemaps: {
      enabled: true, // This allows sourcemaps to be generated in all environments
      extensions: ['js']
    }
  });
```

Set Bugsnag options in your [`config/deploy.js`](http://ember-cli-deploy.com/docs/v1.0.x/configuration/). The following example assumes the values for the options will be set as environment variables on your server.

```js
  /* jshint node: true */

  module.exports = function(deployTarget) {
    // …

    ENV['bugsnag'] = {
      apiKey: process.env.BUGSNAG_KEY,
      publicUrl: process.env.BUGSNAG_PUBLIC_URL,
    };

    // …

    return ENV;
  };
```

### Config Options

#### `ember-cli-deploy-bugsnag` options

Set in [`config/deploy.js`](http://ember-cli-deploy.com/docs/v1.0.x/configuration/):

| Name       | Type          | Required | Default  | Description
| ---------- | ------------- | -------- | -------- | --------- |
| `apiKey`     | string | Yes      | `<none>` | Your Bugsnag Notifier API key. |
| `distFiles`     | array of strings | No      | `context.distFiles` | The array of built project files. This option should be relative to `distDir`. By default, this option will use the `distFiles` property of the [deployment context](http://ember-cli-deploy.com/docs/v0.5.x/deployment-context/). |
| `overwrite`     | string | No      | `true` | If set to `false`, existing sourcemaps for the same version of your app will not be overwritten. Options are `true` or `false`. |
| `publicUrl`  | string | Yes      | `<none>` | The fully qualified domain name for your application e.g., `https://app.fancy-app.com` |

#### Related plugin options

Set by other Ember CLI Deploy plugins:

| Name       | Type          | Default  | Description | Plugin |
| ---------- | ------------- | -------- | ----------- | ------ |
| `distDir`     | string | `tmp/deploy-dist` | The path to your app's distribution directory. | [`ember-cli-build`](https://github.com/zapnito/ember-cli-deploy-build) |
| `revisionKey`  | string | `<none>` | The unique identifier of a build based on its git tag. | [`ember-cli-deploy-revision-data`](https://github.com/zapnito/ember-cli-deploy-revision-data) |

### Deploying to Heroku

Add Heroku's Ember buildpack:

```sh
  heroku buildpacks:set https://codon-buildpacks.s3.amazonaws.com/buildpacks/heroku/emberjs.tgz
```

Heroku strips away git information, so this addon grabs the revision info from the `SOURCE_VERSION` environment variable Heroku provides. Then you need to add the following to `config/environment.js`:

```js
  /* jshint node: true */
  module.exports = function(environment) {
    // …
    if (environment === 'production') {
      // …
      ENV.currentRevision = process.env.SOURCE_VERSION;
      // …
    }
    // …
    return ENV;
  };
```

## Developing

### Running

* `ember serve`
* Visit your app at [http://localhost:4200](http://localhost:4200).

### Running Tests

* `npm test` (Runs `ember try:each` to test your addon against multiple Ember versions)
* `ember test`
* `ember test --server`
