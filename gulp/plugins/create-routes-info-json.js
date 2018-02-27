/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../lib/logger').logger(),
   helpers = require('../../lib/helpers'),
   transliterate = require('../../lib/transliterate'),
   processingRoutes = require('../../lib/processing-routes');

module.exports = function(changesStore, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      if (!file.path.endsWith('.routes.js')) {
         callback(null, file);
         return;
      }

      let routeInfo;
      try {
         routeInfo = await pool.exec('parseRoutes', [file.contents.toString()]);
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке файла роутинга',
            filePath: file.history[0],
            error: error,
            moduleInfo: moduleInfo
         });
      }
      changesStore.storeRouteInfo(file.history[0], moduleInfo.name, routeInfo);
      callback(null, file);
   }, function(callback) {
      try {
         //Всегда сохраняем файл, чтобы не было ошибки при удалении последнего роутинга в модуле.

         //нужно преобразовать абсолютные пути в исходниках в относительные пути в стенде
         const routesInfoBySourceFiles = changesStore.getRoutesInfo(moduleInfo.name);
         const resultRoutesInfo = {};
         Object.keys(routesInfoBySourceFiles).forEach(filePath => {
            const routeInfo = routesInfoBySourceFiles[filePath];
            const relativePath = path.relative(path.dirname(moduleInfo.path), filePath);
            const relativeResultPath = path.join('resources', transliterate(relativePath));
            resultRoutesInfo[relativeResultPath] = routeInfo;
         });

         //подготовим routes-info.json
         processingRoutes.prepareToSave(resultRoutesInfo, Object.keys(moduleInfo.contents.jsModules));

         const routesInfoText = JSON.stringify(helpers.sortObject(resultRoutesInfo), null, 2);
         const routesInfoFile = new Vinyl({
            path: 'routes-info.json',
            contents: Buffer.from(routesInfoText),
            moduleInfo: moduleInfo
         });
         this.push(routesInfoFile);
      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback();
   });
};
