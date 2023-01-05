/*eslint-env node*/
'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var assert = chai.assert;
var RSVP = require('rsvp');

describe('bugsnag plugin', function () {
  var subject;
  var mockUi;
  var context;

  before(function () {
    subject = require('../../index');
  });

  beforeEach(function () {
    mockUi = {
      verbose: true,
      messages: [],
      write: function () {},
      writeLine: function (message) {
        this.messages.push(message);
      },
    };

    context = {
      distDir: process.cwd() + '/tests/fixtures/dist',
      distFiles: ['assets/app.js', 'assets/app.map'],
      revisionData: {},
      ui: mockUi,
      config: {
        bugsnag: {
          distDir: function (context) {
            return context.distDir;
          },
          distFiles: function (context) {
            return context.distFiles || [];
          },
          gzippedFiles: function (context) {
            return context.gzippedFiles || [];
          },
          revisionKey: function (context) {
            return context.revisionData.revisionKey || 'b43a9a';
          },
          _upload: function () {
            return function () {
              return RSVP.resolve();
            };
          },
          apiKey: 'KEY-123',
          includeAppVersion: true,
          deleteSourcemaps: true,
          publicUrl: 'https://myapp.cloudfront.net',
          overwrite: true,
          uploadMinifiedFile: false,
        },
      },
    };
  });

  it('has a name', function () {
    var plugin = subject.createDeployPlugin({
      name: 'bugsnag',
    });

    assert.equal(plugin.name, 'bugsnag');
  });

  it('implements the correct hooks', function () {
    var plugin = subject.createDeployPlugin({
      name: 'bugsnag',
    });

    assert.typeOf(plugin.configure, 'function');
    assert.typeOf(plugin.upload, 'function');
    assert.typeOf(plugin.didUpload, 'function');
  });

  describe('configure hook', function () {
    it('does not throw if config is ok', function () {
      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });
      plugin.beforeHook(context);
      plugin.configure(context);
      assert.ok(true); // it didn't throw
    });

    it('throws if config is not valid', function () {
      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });

      context.config.bugsnag = {};

      plugin.beforeHook(context);
      assert.throws(function () {
        plugin.configure(context);
      });
    });

    it('warns about missing optional config', function () {
      delete context.config.bugsnag.overwrite;
      delete context.config.bugsnag.distFiles;
      delete context.config.bugsnag.includeAppVersion;

      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });
      plugin.beforeHook(context);
      plugin.configure(context);
      var messages = mockUi.messages.reduce(function (previous, current) {
        if (/- Missing config:\s.*, using default:\s/.test(current)) {
          previous.push(current);
        }

        return previous;
      }, []);

      assert.equal(messages.length, 3);
    });

    describe('required config', function () {
      it('warns about missing apiKey', function () {
        delete context.config.bugsnag.apiKey;

        var plugin = subject.createDeployPlugin({
          name: 'bugsnag',
        });
        plugin.beforeHook(context);
        assert.throws(function (/* error */) {
          plugin.configure(context);
        });
        var messages = mockUi.messages.reduce(function (previous, current) {
          if (/- Missing required config: `apiKey`/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);

        assert.equal(messages.length, 1);
      });

      it('warns about missing publicUrl', function () {
        delete context.config.bugsnag.publicUrl;

        var plugin = subject.createDeployPlugin({
          name: 'bugsnag',
        });
        plugin.beforeHook(context);
        assert.throws(function (/* error */) {
          plugin.configure(context);
        });
        var messages = mockUi.messages.reduce(function (previous, current) {
          if (/- Missing required config: `publicUrl`/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);

        assert.equal(messages.length, 1);
      });
    });

    it('adds default config to the config object', function () {
      delete context.config.bugsnag.overwrite;
      delete context.config.bugsnag.includeAppVersion;
      delete context.config.bugsnag.deleteSourcemaps;
      delete context.config.bugsnag.uploadMinifiedFile;
      delete context.config.bugsnag.revisionKey;

      assert.isUndefined(context.config.bugsnag.overwrite);
      assert.isUndefined(context.config.bugsnag.overwrite);
      assert.isUndefined(context.config.bugsnag.includeAppVersion);
      assert.isUndefined(context.config.bugsnag.deleteSourcemaps);
      assert.isUndefined(context.config.bugsnag.uploadMinifiedFile);
      assert.isUndefined(context.config.bugsnag.revisionKey);

      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });
      plugin.beforeHook(context);
      plugin.configure(context);

      assert.equal(context.config.bugsnag.overwrite, true);
      assert.equal(context.config.bugsnag.includeAppVersion, true);
      assert.equal(context.config.bugsnag.deleteSourcemaps, true);
      assert.equal(context.config.bugsnag.uploadMinifiedFile, false);
      assert.typeOf(context.config.bugsnag.revisionKey, 'function');
    });
  });

  describe('#upload hook', function () {
    it('prints the begin message', function () {
      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });

      plugin.beforeHook(context);
      return assert.isFulfilled(plugin.upload(context)).then(function () {
        assert.equal(mockUi.messages.length, 2);
        assert.match(mockUi.messages[0], /Uploading sourcemaps to bugsnag/);
      });
    });

    it('prints success message when files successfully uploaded', function () {
      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });

      plugin.beforeHook(context);
      return assert.isFulfilled(plugin.upload(context)).then(function () {
        assert.equal(mockUi.messages.length, 2);

        var messages = mockUi.messages.reduce(function (previous, current) {
          if (/Finished uploading sourcemaps/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);

        assert.equal(messages.length, 1);
      });
    });

    it('sends the correct arguments to the upload function for each file', function () {
      context.config.bugsnag._upload = function () {
        return function (options) {
          mockUi.writeLine('Custom upload called');
          assert.equal(options.uri, 'https://upload.bugsnag.com');
          assert.equal(options.method, 'POST');
          assert.equal(options.formData.apiKey, 'KEY-123');
          assert.equal(
            options.formData.minifiedUrl,
            'https://myapp.cloudfront.net/assets/app.js'
          );
          assert.ok(options.formData.sourceMap); // it exists
          assert.equal(options.formData.overwrite, 'true');
          assert.equal(options.formData.appVersion, 'b43a9a');
          return RSVP.resolve();
        };
      };
      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });

      plugin.beforeHook(context);
      return assert.isFulfilled(plugin.upload(context)).then(function () {
        assert.equal(mockUi.messages.length, 3);

        var messages = mockUi.messages.reduce(function (previous, current) {
          if (/Custom upload called/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);

        assert.equal(messages.length, 1);
      });
    });
  });

  describe('#didUpload hook', function () {
    it('prints the begin message', function () {
      context.config.bugsnag._deleteFile = function () {
        return function (mapFilePath, callback) {
          callback();
        };
      };
      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });

      plugin.beforeHook(context);
      return assert.isFulfilled(plugin.didUpload(context)).then(function () {
        assert.equal(mockUi.messages.length, 1);
        assert.match(mockUi.messages[0], /Deleting sourcemaps/);
      });
    });

    it('sends the correct arguments to fs.unlink', function () {
      context.config.bugsnag._deleteFile = function () {
        return function (mapFilePath, callback) {
          mockUi.writeLine('Custom unlink called');
          assert.ok(mapFilePath.endsWith('assets/app.map'));
          callback();
        };
      };
      var plugin = subject.createDeployPlugin({
        name: 'bugsnag',
      });

      plugin.beforeHook(context);
      return assert.isFulfilled(plugin.didUpload(context)).then(function () {
        var messages = mockUi.messages.reduce(function (previous, current) {
          if (/Custom unlink called/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);

        assert.equal(messages.length, 1);
      });
    });
  });
});
