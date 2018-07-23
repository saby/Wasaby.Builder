/**
 * Плагин для минификации css
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../common/exec-in-pool');

const excludeRegexes = [/.*\.min\.css$/, /[/\\]node_modules[/\\].*/, /[/\\]design[/\\].*/, /[/\\]service[/\\].*/];

/**
 * Объявление плагина
 * @param {ChangesStore} changesStore кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {stream}
 */
module.exports = function declarePlugin(changesStore, moduleInfo, pool) {
   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            // Нужно вызвать changesStore.addOutputFile для less, чтобы не удалился *.min.css файл.
            // Ведь самой css не будет в потоке при повторном запуске
            if (!['.css', '.less'].includes(file.extname)) {
               callback(null, file);
               return;
            }

            for (const regex of excludeRegexes) {
               if (regex.test(file.path)) {
                  callback(null, file);
                  return;
               }
            }

            const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/(\.css|\.less)$/, '.min.css');

            const outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));
            if (file.cached) {
               changesStore.addOutputFile(file.history[0], outputMinFile, moduleInfo);
               callback(null, file);
               return;
            }

            // Минифицировать less не нужно
            if (file.extname !== '.css') {
               callback(null, file);
               return;
            }

            // если файл не возможно минифицировать, то запишем оригинал
            let newText = file.contents.toString();

            const [error, minified] = await execInPool(pool, 'minifyCss', [newText]);
            newText = minified.styles;
            if (minified.errors.length > 0) {
               changesStore.markFileAsFailed(file.history[0]);
               const errors = minified.errors.toString();
               logger.warning({
                  message: `Ошибки минификации файла: ${errors.split('; ')}`,
                  moduleInfo,
                  filePath: file.path
               });
            }
            if (error) {
               changesStore.markFileAsFailed(file.history[0]);
               logger.error({
                  message: 'Ошибка минификации файла',
                  error,
                  moduleInfo,
                  filePath: file.path
               });
            }

            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputMinFile,
                  contents: Buffer.from(newText)
               })
            );
            changesStore.addOutputFile(file.history[0], outputMinFile, moduleInfo);
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: "Ошибка builder'а при минификации",
               error,
               moduleInfo,
               filePath: file.path
            });
         }
         callback(null, file);
      }
   );
};
