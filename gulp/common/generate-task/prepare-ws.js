/**
 * Генерация задачи для подготовки WS к исполнению в builder'е.
 * Из-за того, что часть кода написана на ES5 (AMD модули), а другая часть на ES6 и TypeScript,
 * нужно привести к одному знаменателю.
 * @author Kolbeshin F.A.
 */

'use strict';

const path = require('path'),
   gulp = require('gulp'),
   plumber = require('gulp-plumber'),
   gulpChmod = require('gulp-chmod'),
   pluginCompileEsAndTs = require('../../builder/plugins/compile-es-and-ts-simple'),
   gulpIf = require('gulp-if'),
   filterCached = require('../../../gulp/builder/plugins/filter-cached'),
   changedInPlace = require('../../common/plugins/changed-in-place'),
   TaskParameters = require('../../common/classes/task-parameters'),
   startTask = require('../start-task-with-timer'),
   logger = require('../../../lib/logger').logger(),
   { generateDownloadModuleCache } = require('../../builder/classes/modules-cache');

function needSymlink() {
   return (file) => {
      if (file.useSymlink) {
         // if it's a file from compiled sources to be symlink to, rebase it to
         // compiled sources directory, otherwise symlink it "as is"
         if (file.origin) {
            file.history = [file.origin];
            file.base = file.compiledBase;
         }
         return true;
      }
      return false;
   };
}

/**
 * Генерация задачи инкрементальной сборки модулей.
 * @param {TaskParameters} taskParameters параметры задачи
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForPrepareWS(taskParameters, currentModuleInfo, needToBePrepared) {
   if (!taskParameters.config.initCore || (currentModuleInfo && !needToBePrepared)) {
      return function skipPrepareWS(done) {
         done();
      };
   }

   const localTaskParameters = new TaskParameters(taskParameters.config, taskParameters.cache, false);
   localTaskParameters.tasksTimer = taskParameters.tasksTimer;
   let requiredModules = currentModuleInfo ? [currentModuleInfo] : taskParameters.config.modules;
   requiredModules = requiredModules.filter(moduleInfo => moduleInfo.required);
   const buildWSModule = startTask('buildWSModule', localTaskParameters);
   if (requiredModules.length) {
      const tasks = [];
      for (const moduleInfo of requiredModules) {
         tasks.push(
            gulp.series(
               generateTaskForPrepareWSModule(localTaskParameters, moduleInfo)
            )
         );
      }
      return gulp.series(
         buildWSModule.start,
         gulp.parallel(tasks),
         buildWSModule.finish
      );
   }
   return function skipPrepareWS(done) {
      done();
   };
}

function generateTaskForPrepareWSModule(localTaskParameters, moduleInfo) {
   function buildWSModule() {
      const moduleInput = path.join(moduleInfo.path, '/**/*.*');
      const moduleOutput = path.join(localTaskParameters.config.cachePath, 'platform', moduleInfo.name);
      logger.debug(`Задача buildWSModule. moduleInput: "${moduleInput}", moduleOutput: "${moduleOutput}"`);
      return gulp
         .src(moduleInput, { dot: false, nodir: true })
         .pipe(
            plumber({
               errorHandler(err) {
                  logger.error({
                     message: 'Задача buildWSModule завершилась с ошибкой',
                     error: err,
                     moduleInfo
                  });
                  this.emit('end');
               }
            })
         )

         // builder unit tests dont have cache
         .pipe(gulpIf(!!localTaskParameters.cache, changedInPlace(localTaskParameters, moduleInfo)))
         .pipe(pluginCompileEsAndTs(localTaskParameters, moduleInfo))
         .pipe(filterCached(localTaskParameters, moduleInfo))
         .pipe(gulpChmod({ read: true, write: true }))
         .pipe(gulpIf(needSymlink(), gulp.symlink(moduleOutput), gulp.dest(moduleOutput)));
   }

   return gulp.series(
      generateDownloadModuleCache(localTaskParameters, moduleInfo),
      buildWSModule,
      (done) => {
         delete moduleInfo.cache;
         done();
      }
   );
}

module.exports = generateTaskForPrepareWS;
