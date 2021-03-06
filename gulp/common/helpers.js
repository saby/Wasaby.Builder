/**
 * Вспомогательные функциия для сборки
 * @author Kolbeshin F.A.
 */
'use strict';

const path = require('path'),
   os = require('os'),
   fs = require('fs-extra'),
   logger = require('../../lib/logger').logger(),
   getLogLevel = require('../../lib/get-log-level'),
   workerPool = require('workerpool'),
   builderConstants = require('../../lib/builder-constants');

/**
 * check source file necessity in output directory by
 * given gulp configuration
 * @param config - current gulp configuration
 * @param file - current file
 * @returns {boolean}
 */
function checkSourceNecessityByConfig(config, extension) {
   if (!config.typescript && extension === '.ts') {
      return false;
   }

   if (!config.less && extension === '.less') {
      return false;
   }

   if (!config.wml && ['.wml', '.tmpl'].includes(extension)) {
      return false;
   }

   if (!config.deprecatedXhtml && extension === '.xhtml') {
      return false;
   }
   return true;
}

/**
 * Функция, которая нужна в сборке для выбора между gulp.dest и gulp.symlink
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {Function} возвращаем функцию для gulp-if
 */
function needSymlink(config, moduleInfo, isFirstBuild) {
   const hasLocalization = config.localizations.length > 0;
   const checkForSymlink = (file) => {
      if (file.useSymlink && !file.strictCopy) {
         // if it's a file from compiled sources to be symlink to, rebase it to
         // compiled sources directory, otherwise symlink it "as is"
         if (file.origin) {
            file.history = [file.origin];
            file.base = file.compiledBase;
         }
         return true;
      }

      /**
       * After first build every next build should
       * check firstly if there is a corresponding file
       * in output directory. If it's a symlink, overwriting
       * it will overwrite origin file and save this symlink, so that
       * could cause some unwanted consequences. Thus, we should
       * remove output file before writing/(creating a symlink) for a
       * new one
       */
      if (config.compiled && !isFirstBuild) {
         const outputPath = path.join(moduleInfo.output, file.relative);
         if (fs.pathExistsSync(outputPath)) {
            fs.unlinkSync(outputPath);
         }
      }

      // don't use symlinks if it's release mode or symlinks is disabled manually or symlinks disabled
      // for certain files
      if ((config.isReleaseMode && !config.localStand) || !config.symlinks || file.strictCopy) {
         return false;
      }

      if (file.extname === '.html' && (hasLocalization || config.debugCustomPack || config.isReleaseMode)) {
         return false;
      }

      // symlinks can't be used if we have to save compiled template into source for custom packer needs.
      if ((config.debugCustomPack) && ['.tmpl', '.xhtml', '.wml'].includes(file.extname)) {
         return false;
      }

      // symlinks can't be used for files generated by ourselves during current build.
      const relativePath = path.relative(moduleInfo.path, file.history[0]);
      if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
         return false;
      }

      // also symlinks can't be used if there was path transliteration. Symlinks doesn't work in this case.
      // It's Gulp own error
      return file.history.length === 1;
   };
   return (file) => {
      const isSymlink = checkForSymlink(file);
      if (isSymlink && file.path.length >= builderConstants.MAX_PATH) {
         const message = `Current path exceeded a maximum system path length(${file.path.length} symbols). Should be less than ${builderConstants.MAX_PATH} symbols.`;
         logger.error({
            message,
            filePath: file.path,
            moduleInfo
         });
      }
      return isSymlink;
   };
}

/**
 * Генерация задачи загрузки кеша сборки
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {function(): *}
 */
function generateTaskForLoadCache(taskParameters) {
   return async function loadCache() {
      const startTime = Date.now();
      const { modulesForPatch } = taskParameters.config;
      if (taskParameters.config.compiled) {
         await taskParameters.cache.loadCompiled();
      }
      await taskParameters.cache.load(modulesForPatch);
      taskParameters.storeTaskTime('loadCache', startTime);
   };
}

/**
 * Генерация задачи инициализации пула воркеров
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {function(): *}
 */
function generateTaskForInitWorkerPool(taskParameters) {
   return async function initWorkerPool() {
      const startTime = Date.now();

      // переменная окружения ws-core-path задана в тестах
      let RequireJsLoaderPath = process.env['require-loader-path'];

      // WS.Core - название модуля в SDK
      if (!RequireJsLoaderPath) {
         const possibleRequirePath = path.join(taskParameters.config.cachePath, 'platform/RequireJsLoader');
         if (await fs.pathExists(possibleRequirePath)) {
            RequireJsLoaderPath = possibleRequirePath;
         }
      }

      let maxWorkers = taskParameters.config.rawConfig['max-workers-for-builder'];

      /**
       * throw an error, if custom worker count more than
       * system max threads - 1 (1 thread for Node.Js main process)
       */
      if (maxWorkers && maxWorkers > (os.cpus().length - 1)) {
         throw new Error(`Custom max worker's count must be less than ${os.cpus().length} for current executing machine!`);
      }
      if (!maxWorkers) {
         maxWorkers = os.cpus().length - 1;
      }
      const requiredModules = taskParameters.config.modules
         .filter(currentModule => currentModule.required)
         .map(currentModule => currentModule.name);
      process.env.logs = getLogLevel(process.argv);
      process.env.cloud = taskParameters.config.cloud;
      process.env.responsibleOfCloud = taskParameters.config.responsibleOfCloud;
      process.env['require-loader-path'] = RequireJsLoaderPath;
      process.env['resources-path'] = taskParameters.config.resourcesUrl ? '/resources/' : '/';
      process.env['main-process-cwd'] = process.cwd();
      process.env['required-modules'] = JSON.stringify(requiredModules);
      process.env.logsPath = taskParameters.config.logs;
      const workerPoolConfig = {
         maxWorkers: maxWorkers || 1,
         forkOpts: {

            // sometimes worker needs more space size, f.e. "Specs" interface module
            // contains bunch of different kinds of document forms.
            execArgv: ['--max-old-space-size=2048']
         }
      };

      // save worker's config in cache to use it as debug info
      await fs.outputJson(
         path.join(taskParameters.config.cachePath, 'workerpool-config.json'),
         { systemMaxWorkers: os.cpus().length, ...workerPoolConfig }
      );

      // Нельзя занимать больше ядер чем есть. Основной процесс тоже потребляет ресурсы
      taskParameters.setWorkerPool(
         workerPool.pool(path.join(__dirname, '../common/worker.js'), workerPoolConfig)
      );
      taskParameters.storeTaskTime('initWorkerPool', startTime);
   };
}

/**
 * Генерация задачи убийства пула воркеров
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {function(): *}
 */
function generateTaskForTerminatePool(taskParameters) {
   return function terminatePool() {
      return taskParameters.pool.terminate();
   };
}

/**
 * Оборачивает функцию в воркере, чтобы была возможность вернуть ошибки и варнинги от WS.
 * Работает в тандеме с gulp/helpers/exec-in-pool.js
 * @param {Function} func функция, которую оборачиваем
 * @returns {Function}
 */
function wrapWorkerFunction(func) {
   return async(funcArgs, filePath = null, moduleInfo = null) => {
      logger.setInfo(filePath, moduleInfo);
      let result;
      try {
         result = func(...funcArgs);
         if (result instanceof Promise) {
            result = await result;
         }
      } catch (error) {
         return [{ message: error.message, stack: error.stack }, null, logger.getMessageForReport()];
      }
      return [null, result, logger.getMessageForReport()];
   };
}


module.exports = {
   needSymlink,
   generateTaskForLoadCache,
   generateTaskForInitWorkerPool,
   generateTaskForTerminatePool,
   wrapWorkerFunction,
   checkSourceNecessityByConfig
};
