"use strict";

module.exports = function(grunt){
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),

    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        es5: true,
        esnext: true,
        globalstrict: true,
        immed: true,
        indent: 2,
        lastsemic: true,
        latedef: true,
        newcap: true,
        noarg: true,
        node: true,
        nonew: true,
        undef: true,
        unused: true,
        quotmark: true,
        strict: true,
        trailing: true,
        white: false
      },

      gruntfile: ["Gruntfile.js"],
      lib: ["index.js", "lib/**/*.js"],

      tests: {
        options: {
          globals: {
            describe: true,
            specify: true,
            setImmediate: true
          }
        },

        files: {
          src: ["tests/**/*.js"]
        }
      }
    }
  });

  grunt.loadNpmTasks("grunt-contrib-jshint");
};
