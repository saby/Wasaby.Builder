/**
 * Плагин для создания contents.json и contents.js (информация для require, описание локализации и т.д.)
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers');

/**
 * Объявление плагина
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   if (
      taskParameters.config.joinedMeta &&
      !taskParameters.config.commonContents
   ) {
      taskParameters.config.commonContents = {};
   }
   return through.obj(
      function onTransform(file, encoding, callback) {
         callback(null, file);
      },

      /* @this Stream */
      function onFlush(callback) {
         try {
            // подготовим contents.json и contents.js
            if (taskParameters.config.version) {
               moduleInfo.contents.buildnumber = '%{BUILDER_VERSION_STUB}';
            }

            // сохраняем модульный contents в общий, если необходимо
            if (taskParameters.config.joinedMeta) {
               helpers.joinContents(taskParameters.config.commonContents, moduleInfo.contents);
            }

            const contentsJsFile = new Vinyl({
               path: 'contents.js',
               contents: Buffer.from(`contents=${JSON.stringify(helpers.sortObject(moduleInfo.contents))}`),
               moduleInfo
            });
            const contentsJsonFile = new Vinyl({
               path: 'contents.json',
               contents: Buffer.from(JSON.stringify(helpers.sortObject(moduleInfo.contents), null, 2)),
               moduleInfo
            });
            const
               currentModuleName = helpers.prettifyPath(moduleInfo.output).split('/').pop(),
               moduleMeta = JSON.stringify(moduleInfo.contents.modules[currentModuleName]),
               moduleMetaContent = `define('${currentModuleName}/.builder/module',[],function(){return ${moduleMeta};});`;

            const moduleMetaFile = new Vinyl({
               path: '.builder/module.js',
               contents: Buffer.from(moduleMetaContent),
               moduleInfo
            });
            const moduleMetaMinFile = new Vinyl({
               path: '.builder/module.min.js',
               contents: Buffer.from(moduleMetaContent),
               moduleInfo
            });
            this.push(contentsJsFile);
            this.push(contentsJsonFile);
            this.push(moduleMetaFile);
            this.push(moduleMetaMinFile);
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo
            });
         }
         callback();
      }
   );
};
