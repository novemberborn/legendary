"use strict";

module.exports = function(grunt){
  grunt.initConfig({
    lint: {
      files: ["*.js", "lib/**/*.js", "tests/**/*.js", "examples/**/*.js"]
    },

    jshint: {
      options: {
        node: true,
        globalstrict: true,
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        undef: true,
        unused: true,
        trailing: true,
        indent: 2,
        white: false
      }
    }
  });
};
