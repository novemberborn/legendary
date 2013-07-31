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
            specify: true,
            setImmediate: true
          }
        },

        files: {
          src: ['tests/**/*.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
};
