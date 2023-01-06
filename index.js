/* eslint-disable ember/avoid-leaking-state-in-ember-objects */
'use strict';

const RSVP = require('rsvp');
const fs = require('fs');
const path = require('path');
const request = require('request-promise');
const zlib = require('zlib');

const BasePlugin = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-bugsnag',

  createDeployPlugin: function (options) {
    const DeployPlugin = BasePlugin.extend({
      name: options.name,

      defaultConfig: {
        distDir: function (context) {
          return context.distDir;
        },
        distFiles: function (context) {
          return context.distFiles;
        },
        gzippedFiles: function (context) {
          return context.gzippedFiles || [];
        },
        revisionKey: function (context) {
          if (context.revisionData) {
            return context.revisionData.revisionKey;
          } else {
            return process.env.SOURCE_VERSION || '';
          }
        },
        includeAppVersion: true,
        deleteSourcemaps: true,
        overwrite: true,
        uploadMinifiedFile: false,
      },

      requiredConfig: ['apiKey', 'publicUrl'],

      upload: function () {
        let log = this.log.bind(this);
        let apiKey = this.readConfig('apiKey');
        let revisionKey = this.readConfig('revisionKey');
        let distDir = this.readConfig('distDir');
        let distFiles = this.readConfig('distFiles');
        let publicUrl = this.readConfig('publicUrl');
        let overwrite = this.readConfig('overwrite');
        let includeAppVersion = this.readConfig('includeAppVersion');
        let uploadMinifiedFile = this.readConfig('uploadMinifiedFile');
        let upload = this.readConfig('_upload') || request;

        log('Uploading sourcemaps to bugsnag', { verbose: true });

        let jsMapPairs = fetchJSMapPairs(distFiles);

        let uploads = jsMapPairs.map((pair) => {
          let mapFilePath = pair.mapFile;
          let jsFilePath = pair.jsFile;
          let formData = {
            apiKey: apiKey,
            minifiedUrl: publicUrl + jsFilePath,
            sourceMap: this._readSourceMap(path.join(distDir, mapFilePath)),
          };

          if (uploadMinifiedFile) {
            formData.minifiedFile = this._readSourceMap(
              path.join(distDir, jsFilePath)
            );
          }

          // the presence of any value for this flag causes the API to interpret it as
          // true, so only add it to the payload if it is truthy
          if (overwrite) {
            formData.overwrite = String(overwrite);
          }

          if (revisionKey && includeAppVersion) {
            formData.appVersion = revisionKey;
          }

          return upload({
            uri: 'https://upload.bugsnag.com',
            method: 'POST',
            formData: formData,
          });
        });

        return RSVP.all(uploads).then(function () {
          log('Finished uploading sourcemaps', { verbose: true });
        });
      },

      didUpload() {
        this.log('Deleting sourcemaps', { verbose: true });
        let deleteSourcemaps = this.readConfig('deleteSourcemaps');
        let deleteFile = this.readConfig('_deleteFile') || fs.unlink;
        if (deleteSourcemaps) {
          let distDir = this.readConfig('distDir');
          let distFiles = this.readConfig('distFiles');
          let mapFilePaths = fetchFilePathsByType(distFiles, distDir, 'map');
          let promises = mapFilePaths.map(function (mapFilePath) {
            return new RSVP.Promise(function (resolve, reject) {
              deleteFile(mapFilePath, function (err) {
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

      // read the sourcefile into memory, either as a stream or file object, so we can send
      // the sourcemap contents to the bugsnag API
      _readSourceMap(mapFilePath) {
        let relativeMapFilePath = mapFilePath.replace(
          this.readConfig('distDir') + '/',
          ''
        );
        if (
          this.readConfig('gzippedFiles').indexOf(relativeMapFilePath) !== -1
        ) {
          // When the source map is gzipped, we need to eagerly load it into a buffer
          // so that the actual content length is known.
          return {
            value: zlib.unzipSync(fs.readFileSync(mapFilePath)),
            options: {
              filename: path.basename(mapFilePath),
            },
          };
        } else {
          return fs.createReadStream(mapFilePath);
        }
      },
    });

    return new DeployPlugin();
  },
};

// This function takes all of the files in a build process, find the sourcemaps and their
// corresponding javascript files, and returns each matching pair as on object containing
// both the sourcemap and javascript file paths relative to the the build directory (meaning they
// will start with `/assets/`)
function fetchJSMapPairs(distFiles) {
  let jsFiles = indexByBaseFilename(fetchFilePathsByType(distFiles, '/', 'js'));
  return fetchFilePathsByType(distFiles, '/', 'map').map((mapFile) => {
    let baseFileName = getBaseFilename(mapFile);
    return {
      mapFile: mapFile,
      jsFile: jsFiles[baseFileName],
    };
  });
}

// this function takes a list of fully qualified file paths (including directory, name,
// fingerprint hash, and extension) and returns them indexed by "base filename", which, in this case
// means the file path without the fingerprint and extension type.
// e.g. when given the following array:
// ```
// [
//   "assets/foo-383483eabdh384.js",
//   "assets/vendor-4392ehad384hd.js"
// ]
// ```
//
// `indexByBaseFilename` would return:
// ```
// {
//   "assets/foo": "assets/foo-383483eabdh384.js",
//   "assets/vendor": "assets/vendor-4392ehad384hd.js"
// }
// ```
// This is used to match sourcemap files to their corresponding js files by ignoring the differing
// fingerprint hashes and extensions
function indexByBaseFilename(files) {
  return files.reduce(function (result, file) {
    result[getBaseFilename(file)] = file;
    return result;
  }, {});
}

// this function removes fingerprint hashes from .js and .map files, but leaves the extension
// intact by using an unmarked group in a positive lookahead to check for the presence of the
// extension type without actually replacing it.
function removeFingerprint(file) {
  let re = /-[a-f0-9]+(?=\.(?:js|map)$)/;

  return file.replace(re, '');
}

// given a file path (including directory), this function will remove the extension and then
// put all the other pieces back together into a normalized path string
function removeExtension(file) {
  let parts = path.parse(file);
  delete parts.ext;
  delete parts.base;
  return path.format(parts);
}

// This function will remove the fingerprint hash (if it exists) and extension from a filename
function getBaseFilename(file) {
  let withoutFingerprint = removeFingerprint(file);
  return removeExtension(withoutFingerprint);
}

// This function finds all files of a given type inside the `assets` folder of a given build
// and returns them with a new basePath prepended
function fetchFilePathsByType(distFiles, basePath, type) {
  return distFiles
    .filter(function (filePath) {
      return new RegExp('assets/.*\\.' + type + '$').test(filePath);
    })
    .map(function (filePath) {
      return path.join(basePath, filePath);
    });
}
