'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      options: grunt.file.readJSON('.jshintrc'),

      gruntfile: ['Gruntfile.js'],
      lib: ['index.js', 'lib/**/*.js'],

      tests: {
        options: {
          globals: {
            describe: true,
            it: true,
            beforeEach: true,
            afterEach: true
          }
        },

        files: {
          src: ['test/**/*.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
};
