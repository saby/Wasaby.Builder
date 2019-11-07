/**
 * Plugin for new themes less compiler
 * @author Kolbeshin F.A.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../common/exec-in-pool'),
   helpers = require('../../../lib/helpers'),
   { getThemeModifier } = require('../generate-task/collect-style-themes'),
   { defaultAutoprefixerOptions } = require('../../../lib/builder-constants');

/**
 * Get interface module name from failed less path
 * @param{String} currentLessBase - path to current less interface module
 * @param{String} failedLessPath - full path to failed less
 * @returns {*}
 */
function getModuleNameForFailedImportLess(currentLessBase, failedLessPath) {
   const root = helpers.unixifyPath(path.dirname(currentLessBase));
   const prettyFailedLessPath = helpers.unixifyPath(failedLessPath);
   const prettyRelativePath = helpers.removeLeadingSlashes(
      prettyFailedLessPath.replace(root, '')
   );
   return prettyRelativePath.split('/').shift();
}

/**
 * Check current theme for new theme type
 * @param{Object} currentTheme - current theme info
 * @returns {boolean}
 */
function checkForNewThemeType(currentTheme) {
   /**
    * new themes can't be imported into any less by builder,
    * only physically import is allowed for it.
    */
   return currentTheme.type === 'new';
}

/**
 * gets new themes list
 * @param allThemes
 */
function getNewThemesList(allThemes) {
   const newThemes = {};
   Object.keys(allThemes).forEach((currentTheme) => {
      if (allThemes[currentTheme].type === 'new') {
         newThemes[currentTheme] = allThemes[currentTheme];
      }
   });
   return newThemes;
}

/**
 * Gets proper theme modificator for current building less. If modifier doesnt exists in theme
 * modifiers list, empty string will be returned.
 * Example:
 * Module has 2 themes:
 * 1)online - TestModule-online-theme/_theme.less
 * 2)online:dark-large - TestModule-online-theme/dark-large/_theme.less
 * For less TestModule-online-theme/dark-large/someDirectory/test.less
 * correct modifier must be "dark-large".
 * For less TestModule-online-theme/someDirectory/test.less
 * correct modifier must be "".
 * @param{String} themeModifier - resolved modifier for less
 * @param{String} moduleModifiers - current theme modifiers list
 * @returns {string}
 */
function getThemeModificatorForLess(themeModifier, moduleModifiers) {
   // themeModifier will be empty for root themed less
   if (!themeModifier) {
      return '';
   }
   let result = '';
   let currentThemeModifier = themeModifier;
   while (currentThemeModifier !== '.' && !result) {
      if (moduleModifiers.includes(currentThemeModifier)) {
         result = currentThemeModifier;
      }
      currentThemeModifier = path.dirname(currentThemeModifier);
   }
   return result;
}

/**
 * Объявление плагина
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {string[]} pathsForImport пути, в которыи less будет искать импорты. нужно для работы межмодульных импортов.
 * @returns {stream}
 */
function compileNewLess(taskParameters, moduleInfo, gulpModulesInfo) {
   const getOutput = function(file, replacingExt) {
      const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.less$/, replacingExt);
      return path.join(moduleInfo.output, transliterate(relativePath));
   };
   const allThemes = taskParameters.cache.currentStore.styleThemes;
   const moduleName = path.basename(moduleInfo.output);

   const newThemes = getNewThemesList(allThemes);
   const currentModuleNewTheme = taskParameters.cache.getNewStyleTheme(moduleInfo.name);
   let autoprefixerOptions = false;
   switch (typeof taskParameters.config.autoprefixer) {
      case 'boolean':
         if (taskParameters.config.autoprefixer) {
            // set default by builder autoprefixer options
            autoprefixerOptions = defaultAutoprefixerOptions;
         } else {
            autoprefixerOptions = false;
         }
         break;
      case 'object':
         if (!(taskParameters.config.autoprefixer instanceof Array)) {
            autoprefixerOptions = taskParameters.config.autoprefixer;
         }
         break;
      default:
         break;
   }

   /**
    * skip everything except new themes interface modules.
    */
   if (!newThemes[moduleName]) {
      return through.obj(
         function onTransform(file, encoding, callback) {
            callback(null, file);
         }
      );
   }

   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            if (file.extname !== '.less') {
               callback(null, file);
               return;
            }

            const isPrivateLess = file.basename.startsWith('_');

            /**
             * private less files are used only for imports into another less, so we can
             * ignore them and return as common file into gulp stream
             */
            if (isPrivateLess) {
               callback(null, file);
               return;
            }

            /**
             * store every building less from new theme's interface modules
             * into builder cache to store theme into "contents" builder meta info
             */
            const themeModifier = getThemeModificatorForLess(
               getThemeModifier(moduleInfo.path, file.path),
               currentModuleNewTheme.modifiers
            );
            const relativePathByModifier = path.relative(
               path.join(moduleInfo.path, themeModifier),
               file.path
            );
            const currentLessName = relativePathByModifier.replace('.less', '');
            taskParameters.cache.storeNewThemesModules(
               newThemes[moduleName].moduleName,
               currentLessName,
               themeModifier,
               newThemes[moduleName].themeName
            );
            const outputCssFile = getOutput(file, '.css');

            if (file.cached) {
               taskParameters.cache.addOutputFile(file.history[0], outputCssFile, moduleInfo);
               callback(null, file);
               return;
            }

            const lessInfo = {
               filePath: file.history[0],
               modulePath: moduleInfo.path,
               text: file.contents.toString(),
               newThemes,
               autoprefixerOptions
            };
            const [, result] = await execInPool(
               taskParameters.pool,
               'buildNewLess',
               [
                  lessInfo,
                  gulpModulesInfo
               ],
               file.history[0],
               moduleInfo
            );
            if (result.error) {
               let errorObject;
               if (result.failedLess) {
                  const moduleNameForFail = getModuleNameForFailedImportLess(
                     file.base,
                     result.failedLess
                  );
                  const moduleInfoForFail = taskParameters.config.modules.find(
                     currentModuleInfo => currentModuleInfo.name === moduleNameForFail
                  );
                  const errorLoadAttempts = result.error.slice(result.error.indexOf('Tried -'), result.error.length);
                  result.error = result.error.replace(errorLoadAttempts, '');

                  const message = `Bad import detected ${result.error}. Check interface module of current import ` +
                     `for existing in current project. Needed by: ${file.history[0]}. ` +
                     `For theme: ${result.theme.name}. Theme type: ${result.theme.isDefault ? 'old' : 'new'}\n${errorLoadAttempts}`;
                  errorObject = {
                     message,
                     filePath: result.failedLess,
                     moduleInfo: moduleInfoForFail
                  };
               } else {
                  errorObject = {
                     message: `Less compiling error: ${result.error}`,
                     filePath: file.history[0],
                     moduleInfo
                  };
               }
               logger.error(errorObject);
               taskParameters.cache.markFileAsFailed(file.history[0]);
            } else {
               const { compiled } = result;

               taskParameters.cache.addOutputFile(file.history[0], outputCssFile, moduleInfo);
               taskParameters.cache.addDependencies(file.history[0], compiled.imports);

               const newFile = file.clone();
               newFile.contents = Buffer.from(compiled.text);
               newFile.path = outputCssFile;
               newFile.base = moduleInfo.output;
               newFile.lessSource = file.contents;
               this.push(newFile);
            }
         } catch (error) {
            taskParameters.cache.markFileAsFailed(file.history[0]);
            logger.error({
               message: 'Builder plugin compile-new-less error',
               error,
               moduleInfo,
               filePath: file.history[0]
            });
         }
         callback(null, file);
      }
   );
}

module.exports = {
   compileNewLess,
   checkForNewThemeType
};