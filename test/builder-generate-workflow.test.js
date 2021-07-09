/**
 * Main unit-tests for builder workflow generator(main workflow for 'build' task)
 * @author Kolbeshin F.A.
 */

'use strict';

const initTest = require('./init-test');

const path = require('path'),
   fs = require('fs-extra'),
   pMap = require('p-map'),
   helpers = require('../lib/helpers'),
   { brotliDecompress } = require('zlib'),
   { promiseWithTimeout, TimeoutError } = require('../lib/promise-with-timeout');

const generateWorkflow = require('../gulp/builder/generate-workflow.js');

const {
   timeoutForMacOS, getMTime, removeRSymbol, isSymlink, isRegularFile, linkPlatform, TIMEOUT_FOR_HEAVY_TASKS
} = require('./lib');

const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   outputFolder = path.join(workspaceFolder, 'output'),
   logsFolder = path.join(workspaceFolder, 'logs'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json'),
   moduleOutputFolder = path.join(outputFolder, 'Modul'),
   module2OutputFolder = path.join(outputFolder, 'Modul2'),
   moduleSourceFolder = path.join(sourceFolder, 'Модуль'),
   themesSourceFolder = path.join(sourceFolder, 'Тема Скрепка');

const clearWorkspace = async function() {
   await fs.remove(`${workspaceFolder}-1`);
   return fs.remove(workspaceFolder);
};

const prepareTest = async function(fixtureFolder) {
   await clearWorkspace();
   await fs.ensureDir(sourceFolder);
   await fs.copy(fixtureFolder, sourceFolder);
};

const runWorkflow = function() {
   return new Promise((resolve, reject) => {
      generateWorkflow([`--config="${configPath}"`])((error) => {
         if (error) {
            reject(error);
         } else {
            resolve();
         }
      });
   });
};

const decompress = function(data) {
   return new Promise((resolve, reject) => {
      brotliDecompress(data, (err, decompressed) => {
         if (err) {
            reject(err);
         } else {
            resolve(decompressed);
         }
      });
   });
};

/**
 * properly finish test in builder main workflow was freezed by unexpected
 * critical errors from gulp plugins
 * @returns {Promise<void>}
 */
const runWorkflowWithTimeout = async function(timeout) {
   let result;
   try {
      result = await promiseWithTimeout(runWorkflow(), timeout || TIMEOUT_FOR_HEAVY_TASKS);
   } catch (err) {
      result = err;
   }
   if (result instanceof TimeoutError) {
      true.should.equal(false);
   }
};

// нужно проверить что происходит:
// 1. при переименовывании файла == добавление/удаление файла
// 2. при изменении файла
// 3. если файл не менять
describe('gulp/builder/generate-workflow.js', () => {
   before(async() => {
      await initTest();
   });
   const testEmptyLessLog = async(fileNames, extensions) => {
      const testResult = (arrayToTest, resultArray) => {
         let result = true;
         arrayToTest.forEach((currentMember) => {
            if (!resultArray.has(currentMember)) {
               result = false;
            }
         });
         return result;
      };
      const { messages } = await fs.readJson(path.join(logsFolder, 'builder_report.json'));
      const resultExtensions = new Set();
      const resultFileNames = new Set();
      messages.forEach((curMesObj) => {
         const currentPath = helpers.prettifyPath(curMesObj.file);
         const currentFileName = currentPath.split('/').pop();
         const currentExtension = currentFileName.split('.').pop();
         if (curMesObj.message.includes(`Empty ${currentExtension} file is discovered.`)) {
            resultExtensions.add(currentExtension);
            resultFileNames.add(currentFileName);
         }
      });
      testResult(fileNames, resultFileNames).should.equal(true);
      testResult(extensions, resultExtensions).should.equal(true);
   };

   it('compile less with coverage', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         lessCoverage: true,
         less: true,
         typescript: true,
         dependenciesGraph: true,
         builderTests: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'TestModule',
               path: path.join(sourceFolder, 'TestModule')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();

      const testModuleDepsPath = path.join(outputFolder, 'TestModule/module-dependencies.json');
      let lessDependenciesForTest = (await fs.readJson(testModuleDepsPath)).lessDependencies;

      lessDependenciesForTest['TestModule/stable'].should.have.members([
         'css!Controls-default-theme/_old-mixins',
         'css!SBIS3.CONTROLS/themes/_mixins',
         'css!Controls-default-theme/_mixins',
         'css!Controls-default-theme/_new-mixins',
         'css!TestModule/Stable-for-import',
         'css!TestModule/Stable-for-theme-import',
         'css!TestModule/Stable-with-import',
         'css!TestModule/test-style-assign',
         'css!TestModule/test-styles-object',
         'css!TestModule/test-theme-object',
         'css!Модуль/Stable'
      ]);

      // запустим повторно таску
      await runWorkflowWithTimeout();

      lessDependenciesForTest = (await fs.readJson(testModuleDepsPath)).lessDependencies;
      lessDependenciesForTest['TestModule/stable'].should.have.members([
         'css!Controls-default-theme/_old-mixins',
         'css!SBIS3.CONTROLS/themes/_mixins',
         'css!Controls-default-theme/_mixins',
         'css!Controls-default-theme/_new-mixins',
         'css!TestModule/Stable-for-import',
         'css!TestModule/Stable-for-theme-import',
         'css!TestModule/Stable-with-import',
         'css!TestModule/test-style-assign',
         'css!TestModule/test-styles-object',
         'css!TestModule/test-theme-object',
         'css!Модуль/Stable'
      ]);

      await clearWorkspace();
   });

   it('process svg', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/process-svg');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         modules: [
            {
               name: 'Test-icons',
               path: path.join(sourceFolder, 'Test-icons')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();
      const iconsOutputFolder = path.join(outputFolder, 'Test-icons');

      const testResults = async(filteringPackageExists) => {
         // 'filtering' folder has svg icons matching allowed name pattern, so there should be a package
         // as a result
         (await isRegularFile(iconsOutputFolder, 'filtering.svg')).should.equal(filteringPackageExists);

         // 'sorting' folder has none of any svg icon with a valid name, so builder should ignore them
         // and there should be a void as result of 'sorting' folder analyze
         (await isRegularFile(iconsOutputFolder, 'sorting.svg')).should.equal(false);

         // svg packer should do several things:
         // 1) remove all needless attributes, such as version, xmlns, style, fill
         // 2) change 'svg' tag of current svg icons to symbol
         // 3) set 'id' attribute as a name of current svg file
         // 4) write it inside common 'svg' tag of current svg package
         if (filteringPackageExists) {
            const filteringResult = await fs.readFile(path.join(iconsOutputFolder, 'filtering.svg'), 'utf8');
            filteringResult.should.equal('<svg xmlns="http://www.w3.org/2000/svg"><svg><symbol id="icon-Test1" x="0" y="0" viewBox="0 0 28 16"/></svg></svg>');
         }
      };

      await testResults(true);
      await runWorkflowWithTimeout();
      await testResults(true);

      // remove remaining allowed icon from 'filtering' namespace to check that garbage
      // collector will remove package also with removed svg.
      await fs.remove(path.join(sourceFolder, 'Test-icons/filtering/icon-Test1.svg'));

      await runWorkflowWithTimeout();
      await testResults(false);

      await clearWorkspace();
   });

   it('new type locales: must compile js-locale and write it to contents only for existing json-locales', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/locales');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);
      const correctContents = {
         availableLanguage: {
            en: 'English',
            'en-US': 'English',
            ru: 'Русский',
            'ru-RU': 'Русский'
         },
         buildMode: 'debug',
         defaultLanguage: 'ru-RU',
         htmlNames: {},
         modules: {
            Modul: {
               dict: [
                  'en',
                  'en-GB',
                  'en-US',
                  'en.css',
                  'ru-RU',
                  'ru-RU.css',
               ],
               name: 'Модуль'
            }
         }
      };
      const testResults = async() => {
         const contents = await fs.readJson(path.join(moduleOutputFolder, 'contents.json'));
         contents.should.deep.equal(correctContents);
         const listOfDictionaries = await fs.readdir(path.join(moduleOutputFolder, 'lang/en'));
         listOfDictionaries.should.have.members([
            'en-GB.json',
            'en-GB.json.js',
            'en-US.json',
            'en-US.json.js',
            'en.json',
            'en.json.js',
            'en.less',
            'en.css'
         ]);
         const currentDictDirectory = path.join(moduleOutputFolder, 'lang/en');
         (await fs.readJson(path.join(currentDictDirectory, 'en.json'))).should.deep.equal({
            '10 или 12': '10 or 12',
            'Это словарь!': 'This is dictionary!'
         });
         (await fs.readJson(path.join(currentDictDirectory, 'en-US.json'))).should.deep.equal({
            '10 или 12': '10 or 12',
            'Это словарь!': 'This is dictionary! God, bless America!',
            'Ключ для США': 'US key'
         });
         (await fs.readJson(path.join(currentDictDirectory, 'en-GB.json'))).should.deep.equal({
            '10 или 12': '10 or 12',
            'Это словарь!': 'This is dictionary! God, save the queen!',
            'Ключ для Британии': 'GB key'
         });
         (await fs.readFile(path.join(currentDictDirectory, 'en.css'), 'utf8')).should.equal(
            '.en .test {\n' +
            '  width: 686px;\n' +
            '}\n'
         );
      };
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         'default-localization': 'ru-RU',
         localization: ['en-US', 'ru-RU', 'en'],
         less: true,
         contents: true,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };

      await fs.writeJSON(configPath, config);

      await runWorkflowWithTimeout();
      await testResults();

      // incremental build must be completed properly
      await runWorkflowWithTimeout();
      await testResults();
      await clearWorkspace();
   });
   it('compile less without coverage', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         less: true,
         typescript: true,
         dependenciesGraph: true,
         builderTests: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'TestModule',
               path: path.join(sourceFolder, 'TestModule')
            }
         ]
      };

      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();

      const testModuleDepsPath = path.join(outputFolder, 'TestModule/module-dependencies.json');
      let lessDependenciesExists = (await fs.readJson(testModuleDepsPath)).hasOwnProperty('lessDependencies');

      lessDependenciesExists.should.deep.equal(false);

      // запустим повторно таску
      await runWorkflowWithTimeout();

      lessDependenciesExists = (await fs.readJson(testModuleDepsPath)).hasOwnProperty('lessDependencies');
      lessDependenciesExists.should.equal(false);

      await clearWorkspace();
   });

   it('compile less', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         lessCoverage: true,
         less: true,
         logs: logsFolder,
         builderTests: true,
         typescript: true,
         dependenciesGraph: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'TestModule',
               path: path.join(sourceFolder, 'TestModule')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();
      await testEmptyLessLog(['emptyLess.less', 'emptyCss.css'], ['less', 'css']);

      let resultsFiles;

      // проверим, что все нужные файлы появились в "стенде"
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Error.less',
         'ForChange.css',
         'ForChange.less',
         'ForRename_old.css',
         'ForRename_old.less',
         'Stable.css',
         'Stable.less',
         'module-dependencies.json'
      ]);

      const stableCss = await fs.readFile(path.join(moduleOutputFolder, 'Stable.css'), 'utf8');

      // autoprefixer enabled by default, so css result must have all needed prefixes
      stableCss.replace(/\n$/, '').should.equal('.test-selector {\n' +
         '  test-mixin: undefined;\n' +
         '  test-mixin: var(--test-mixin);\n' +
         '  test-var: undefined;\n' +
         '  test-var: var(--test-var);\n' +
         '  display: -ms-grid;\n' +
         '  display: grid;\n' +
         '  -ms-grid-columns: 1fr 1fr;\n' +
         '  grid-template-columns: 1fr 1fr;\n' +
         '  -ms-grid-rows: auto;\n' +
         '  grid-template-rows: auto;\n' +
         '}');

      // изменим "исходники"
      await timeoutForMacOS();
      await fs.rename(
         path.join(moduleSourceFolder, 'ForRename_old.less'),
         path.join(moduleSourceFolder, 'ForRename_new.less')
      );
      const filePathForChange = path.join(moduleSourceFolder, 'ForChange.less');
      const data = await fs.readFile(filePathForChange);
      await fs.writeFile(filePathForChange, `${data.toString()}\n.test-selector2 {}`);

      // запустим повторно таску
      await runWorkflowWithTimeout();
      await testEmptyLessLog(['emptyLess.less', 'emptyCss.css'], ['less', 'css']);

      // проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Error.less',
         'ForChange.css',
         'ForChange.less',
         'ForRename_new.css',
         'ForRename_new.less',
         'Stable.css',
         'module-dependencies.json',
         'Stable.less'
      ]);

      await clearWorkspace();
   });

   it('content dictionaries - AMD-formatted dictionaries meta must be saved only for modules with it', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/dictionary');
      await prepareTest(fixtureFolder);
      const testResults = async() => {
         const { messages } = await fs.readJson(path.join(workspaceFolder, 'logs/builder_report.json'));
         const errorMessage = 'Attempt to use css from root lang directory, use less instead!';
         let cssLangErrorExists = false;
         messages.forEach((currentError) => {
            if (currentError.message === errorMessage) {
               cssLangErrorExists = true;
            }
         });
         cssLangErrorExists.should.equal(true);
      };
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         logs: logsFolder,
         contents: true,
         builderTests: true,
         'default-localization': 'ru-RU',
         localization: ['ru-RU', 'en-US'],
         modules: [
            {
               name: 'Module1',
               path: path.join(sourceFolder, 'Module1')
            },
            {
               name: 'Module2',
               path: path.join(sourceFolder, 'Module2')
            }
         ]
      };
      await fs.writeJSON(configPath, config);
      await runWorkflowWithTimeout(30000);
      await testResults();
      await runWorkflowWithTimeout(30000);
      await testResults();
      await clearWorkspace();
   });
   it('compile less - should return correct meta in "contents" for new themes', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);
      const testResults = async() => {
         /**
          * In case of using new themes algorythm for less compiling we must not compile less for
          * old themes. Result will be the same, but for the same time it will downgrade the speed
          * because of compiling 2 styles for one less with the same result's content.
          */
         (await isRegularFile(path.join(outputFolder, 'TestModule-anotherTheme-theme'), 'badVariable.css')).should.equal(false);
         (await isRegularFile(path.join(outputFolder, 'TestModule-anotherTheme-theme'), 'onlineVariable.css')).should.equal(false);
      };
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         logs: logsFolder,
         less: true,
         typescript: true,
         dependenciesGraph: true,
         contents: true,
         builderTests: true,
         joinedMeta: true,
         modules: [
            {
               name: 'TestModule',
               path: path.join(sourceFolder, 'TestModule')
            },
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'TestModule-anotherTheme-theme',
               path: path.join(sourceFolder, 'TestModule-anotherTheme-theme')
            },
            {
               name: 'TestModule-online-theme',
               path: path.join(sourceFolder, 'TestModule-online-theme')
            },
            {
               name: 'NotExisting-online-theme',
               path: path.join(sourceFolder, 'NotExisting-online-theme')
            }
         ]
      };
      await fs.writeJSON(configPath, config);
      await runWorkflowWithTimeout(30000);
      await testResults();

      // css files doesn't processing in new less compiler, so these should be ignored
      await testEmptyLessLog(['emptyLessNewTheme.less'], ['less', 'css']);
      await runWorkflowWithTimeout(30000);
      await testResults();
      await testEmptyLessLog(['emptyLessNewTheme.less'], ['less', 'css']);

      // set "TestModule" as module for patch, rebuild it and check results
      config.modules[0].rebuild = true;
      await fs.writeJSON(configPath, config);
      await runWorkflowWithTimeout(30000);
      await testResults();

      await fs.remove(cacheFolder);
      await runWorkflowWithTimeout(30000);
      await testResults();
      await clearWorkspace();
   });

   it('should recompile properly after source directory renamed without cache reset', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);

      let config = {
         cache: cacheFolder,
         output: outputFolder,
         less: true,
         modules: [
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();

      // изменим "исходники"
      await timeoutForMacOS();

      await fs.rename(
         workspaceFolder,
         `${workspaceFolder}-1`
      );
      const renamedCacheFolder = path.join(`${workspaceFolder}-1`, 'cache');
      const renamedOutputFolder = path.join(`${workspaceFolder}-1`, 'output');
      const renamedSourceFolder = path.join(`${workspaceFolder}-1`, 'source');
      config = {
         cache: renamedCacheFolder,
         output: renamedOutputFolder,
         less: true,
         modules: [
            {
               name: 'Controls-default-theme',
               path: path.join(renamedSourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(renamedSourceFolder, 'Модуль')
            }
         ]
      };

      await fs.outputJSON(configPath, config);

      // запустим повторно таску
      await runWorkflowWithTimeout();
      await fs.remove(`${workspaceFolder}-1`);
      await clearWorkspace();
   });

   it('compile less with patch', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);
      const patchOutputFolder = `${outputFolder}-1`;
      const config = {
         cache: cacheFolder,
         output: patchOutputFolder,
         less: true,
         minimize: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль'),
               rebuild: true
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим повторно таску
      await runWorkflowWithTimeout();

      // result content for patch should be written only for interface module "Modul"
      const resultsFiles = await fs.readdir(path.join(patchOutputFolder, 'Modul'));
      resultsFiles.should.have.members([
         'Error.less',
         'ForChange.css',
         'ForChange.less',
         'ForRename_old.css',
         'ForRename_old.less',
         'Stable.css',
         'Stable.less',
         'ForChange.min.css',
         'ForRename_old.min.css',
         'Stable.min.css'
      ]);
      const sbis3controlsDirectoryExists = await fs.pathExists(path.join(patchOutputFolder, 'SBIS3.CONTROLS'));
      sbis3controlsDirectoryExists.should.equal(false);
      const controlsThemeDirectoryExists = await fs.pathExists(path.join(patchOutputFolder, 'Controls-default-theme'));
      controlsThemeDirectoryExists.should.equal(false);
      await clearWorkspace();
   });

   it('actual builder cache', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);

      let config = {
         cache: cacheFolder,
         output: outputFolder,
         builderTests: true,
         wml: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core'),
               required: true
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // make test folders in platform modules cache to check it was removed after rebuild with new config.
      await fs.ensureDir(path.join(cacheFolder, 'platform/PlatformModule1'));
      await fs.ensureDir(path.join(cacheFolder, 'platform/PlatformModule2'));

      // запустим таску
      await runWorkflowWithTimeout();

      config = {
         cache: cacheFolder,
         output: outputFolder,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await runWorkflowWithTimeout();

      // gulp_config was changed, so we need to ensure cache platform folder for old build was removed
      (await fs.pathExists(path.join(cacheFolder, 'platform'))).should.equal(false);

      // source symlinks must have new actual list of source modules
      const sourceSymlinksDirectoryList = await fs.readdir(path.join(cacheFolder, 'temp-modules'));
      sourceSymlinksDirectoryList.should.have.members([
         'SBIS3.CONTROLS',
         'Controls-default-theme',
         'Модуль'
      ]);
      await clearWorkspace();
   });

   it('routes-info', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/routes');
      await prepareTest(fixtureFolder);
      let resultsFiles, routesInfoResult;

      const testResults = async(currentUrl) => {
         // проверим, что все нужные файлы появились в "стенде", лишние удалились
         resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members([
            'ForChange.routes.js',
            'ForRename_old.routes.js',
            'Stable.routes.js',
            'Test1.js',
            'navigation-modules.json',
            'routes-info.json',
            'static_templates.json',
            'tsRouting.routes.js',
            'tsRouting.routes.ts'
         ]);
         routesInfoResult = await fs.readJson(path.join(moduleOutputFolder, 'routes-info.json'));
         routesInfoResult.hasOwnProperty('resources/Modul/tsRouting.routes.js').should.equal(true);
         const currentRouting = routesInfoResult['resources/Modul/tsRouting.routes.js'];
         currentRouting[currentUrl].should.deep.equal({
            controller: 'Modul/Test1',
            isMasterPage: false
         });
      };
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         typescript: true,
         presentationServiceMeta: true,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();
      await testResults('/ForChange_old.html');

      await fs.writeFile(
         path.join(sourceFolder, 'Модуль/tsRouting.routes.ts'),
         'module.exports = function() {\n' +
         '    return {\n' +
         '        \'/ForChange_new.html\': \'Modul/Test1\'\n' +
         '    };\n' +
         '};'
      );

      await timeoutForMacOS();

      // запустим повторно таску
      await runWorkflowWithTimeout();
      await testResults('/ForChange_new.html');
      await clearWorkspace();
   });

   it('map for requirejs substitutions', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);

      const testRequireJsSubstitutions = async() => {
         // проверим, что все нужные файлы появились в "стенде"
         const mDeps = await fs.readJson(path.join(outputFolder, 'WS.Core/module-dependencies.json'));
         mDeps.hasOwnProperty('requireJsSubstitutions').should.equal(true);

         // test common types of this map properties for validity.
         const substitutions = mDeps.requireJsSubstitutions;
         substitutions.hasOwnProperty('Core/core-min').should.equal(true);
         substitutions['Core/core-min'].should.equal('WS.Core/core/core-min.js');
         substitutions.hasOwnProperty('css!WS/css/core').should.equal(true);
         substitutions['css!WS/css/core'].should.equal('WS.Core/css/core.css');
      };

      const config = {
         wsCoreMap: true,
         cache: cacheFolder,
         output: outputFolder,
         dependenciesGraph: true,
         typescript: true,
         builderTests: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'WS.Core',
               path: path.join(__dirname, 'fixtureWS/platform/WS.Core')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await runWorkflowWithTimeout();
      await testRequireJsSubstitutions();
      await runWorkflowWithTimeout();
      await testRequireJsSubstitutions();
      await clearWorkspace();
   });

   it('static html', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/staticHtml');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         deprecatedWebPageTemplates: true,
         htmlWml: true,
         contents: true,
         presentationServiceMeta: true,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль'),
               depends: ['Тема Скрепка']
            },
            {
               name: 'Тема Скрепка',
               path: path.join(sourceFolder, 'Тема Скрепка')
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View')
            },
            {
               name: 'UI',
               path: path.join(sourceFolder, 'UI')
            },
            {
               name: 'Compiler',
               path: path.join(sourceFolder, 'Compiler')
            },
            {
               name: 'UICore',
               path: path.join(sourceFolder, 'UICore')
            },
            {
               name: 'UICommon',
               path: path.join(sourceFolder, 'UICommon')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();

      // проверим, что все нужные файлы появились в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.js',
         'ForChange_old.html',
         'ForRename_old.js',
         'ForRename.html',
         'Test',
         'TestASort',
         'Stable.js',
         'Stable.html',
         'contents.json',
         'contents.json.js',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);
      const contentsJsonOutputPath = path.join(moduleOutputFolder, 'contents.json');
      let contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         buildMode: 'debug',
         htmlNames: {
            'Modul/ForChange': 'ForChange_old.html',
            'Modul/ForRename_old': 'ForRename.html',
            'Modul/Stable': 'Stable.html'
         },
         modules: {
            Modul: {
               name: 'Модуль'
            }
         }
      });

      // запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableJsOutputPath = path.join(moduleOutputFolder, 'Stable.js');
      const stableHtmlOutputPath = path.join(moduleOutputFolder, 'Stable.html');
      const forChangeJsOutputPath = path.join(moduleOutputFolder, 'ForChange.js');
      let forChangeHtmlOutputPath = path.join(moduleOutputFolder, 'ForChange_old.html');
      const mTimeStableJs = await getMTime(stableJsOutputPath);
      const mTimeStableHtml = await getMTime(stableHtmlOutputPath);
      const mTimeForChangeJs = await getMTime(forChangeJsOutputPath);
      const mTimeForChangeHtml = await getMTime(forChangeHtmlOutputPath);

      // проверим сами html
      let stableHtml = await fs.readFile(stableHtmlOutputPath);
      let forChangeHtml = await fs.readFile(forChangeHtmlOutputPath);
      const forRenameHtmlOutputPath = path.join(moduleOutputFolder, 'ForRename.html');
      let forRenameHtml = await fs.readFile(forRenameHtmlOutputPath);
      const staticTemplatesJsonOutputPath = path.join(moduleOutputFolder, 'static_templates.json');
      let staticTemplatesJson = await fs.readFile(staticTemplatesJsonOutputPath);
      removeRSymbol(stableHtml.toString()).should.equal(
         '<STABLE></STABLE>\n' +
            '<TITLE>Stable</TITLE>\n' +
            '<START_DIALOG>Modul/Stable</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>/resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>/resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT>/</APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>/service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(forChangeHtml.toString()).should.equal(
         '<FOR_CHANGE_OLD></FOR_CHANGE_OLD>\n' +
            '<TITLE>ForChange_old</TITLE>\n' +
            '<START_DIALOG>Modul/ForChange</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>/resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>/resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT>/</APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>/service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(forRenameHtml.toString()).should.equal(
         '<FOR_RENAME></FOR_RENAME>\n' +
            '<TITLE>ForRename</TITLE>\n' +
            '<START_DIALOG>Modul/ForRename_old</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>/resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>/resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT>/</APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>/service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(staticTemplatesJson.toString()).should.equal(
         '{\n' +
            '  "/ForChange_old.html": "Modul/ForChange_old.html",\n' +
            '  "/ForRename.html": "Modul/ForRename.html",\n' +
            '  "/Stable.html": "Modul/Stable.html",\n' +
            '  "/Stable/One": "Modul/Stable.html",\n' +
            '  "/Stable/Two": "Modul/Stable.html",\n' +
            '  "/Stable_Three": "Modul/Stable.html",\n' +
            '  "/TestHtmlTmpl.html": "Модуль/TestASort/TestHtmlTmpl.html"\n' +
            '}'
      );

      // изменим "исходники"
      await timeoutForMacOS();
      await fs.rename(
         path.join(moduleSourceFolder, 'ForRename_old.js'),
         path.join(moduleSourceFolder, 'ForRename_new.js')
      );
      await fs.rename(
         path.join(themesSourceFolder, 'ForRename_old.html'),
         path.join(themesSourceFolder, 'ForRename_new.html')
      );

      const filePathForChangeJs = path.join(moduleSourceFolder, 'ForChange.js');
      const dataJs = await fs.readFile(filePathForChangeJs);
      await fs.writeFile(filePathForChangeJs, dataJs.toString().replace(/ForChange_old/g, 'ForChange_new'));

      const filePathForChangeHtml = path.join(themesSourceFolder, 'ForChange.html');
      const dataHtml = await fs.readFile(filePathForChangeHtml);
      await fs.writeFile(filePathForChangeHtml, dataHtml.toString().replace(/FOR_CHANGE_OLD/g, 'FOR_CHANGE_NEW'));

      // запустим повторно таску
      await runWorkflowWithTimeout();

      // проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.js',
         'ForChange_new.html',
         'ForRename_new.js',
         'ForRename.html',
         'Test',
         'TestASort',
         'Stable.js',
         'Stable.html',
         'contents.json',
         'contents.json.js',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      // проверим время модификации незменяемого файла и изменяемого в "стенде"
      // !!! В отличии от остальных файлов, статические HTML всегда пересоздаются заново, т.к. кешировать их сложно,
      // а весь процесс длится меньше 2 секунд.
      forChangeHtmlOutputPath = path.join(moduleOutputFolder, 'ForChange_new.html');
      (await getMTime(stableJsOutputPath)).should.equal(mTimeStableJs);

      // следующая проверка отличается от остальных и это норма
      (await getMTime(stableHtmlOutputPath)).should.not.equal(mTimeStableHtml);
      (await getMTime(forChangeJsOutputPath)).should.not.equal(mTimeForChangeJs);
      (await getMTime(forChangeHtmlOutputPath)).should.not.equal(mTimeForChangeHtml);

      contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         buildMode: 'debug',
         htmlNames: {
            'Modul/ForChange': 'ForChange_new.html',
            'Modul/ForRename_old': 'ForRename.html',
            'Modul/Stable': 'Stable.html'
         },
         modules: {
            Modul: {
               name: 'Модуль'
            }
         }
      });

      // проверим сами html
      stableHtml = await fs.readFile(stableHtmlOutputPath);
      forChangeHtml = await fs.readFile(forChangeHtmlOutputPath);
      forRenameHtml = await fs.readFile(forRenameHtmlOutputPath);
      staticTemplatesJson = await fs.readFile(staticTemplatesJsonOutputPath);
      removeRSymbol(stableHtml.toString()).should.equal(
         '<STABLE></STABLE>\n' +
            '<TITLE>Stable</TITLE>\n' +
            '<START_DIALOG>Modul/Stable</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>/resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>/resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT>/</APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>/service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );

      // TODO: в следующей строке ошибка из-за кеширования результата в lib/generate-static-html-for-js.js.
      // должно быть FOR_CHANGE_NEW. пока этим можно пренебречь
      removeRSymbol(forChangeHtml.toString()).should.equal(
         '<FOR_CHANGE_OLD></FOR_CHANGE_OLD>\n' +
            '<TITLE>ForChange_new</TITLE>\n' +
            '<START_DIALOG>Modul/ForChange</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>/resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>/resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT>/</APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>/service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );

      removeRSymbol(forRenameHtml.toString()).should.equal(
         '<FOR_RENAME></FOR_RENAME>\n' +
            '<TITLE>ForRename</TITLE>\n' +
            '<START_DIALOG>Modul/ForRename_old</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>/resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>/resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT>/</APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>/service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(staticTemplatesJson.toString()).should.equal(
         '{\n' +
            '  "/ForChange_new.html": "Modul/ForChange_new.html",\n' +
            '  "/ForRename.html": "Modul/ForRename.html",\n' +
            '  "/Stable.html": "Modul/Stable.html",\n' +
            '  "/Stable/One": "Modul/Stable.html",\n' +
            '  "/Stable/Two": "Modul/Stable.html",\n' +
            '  "/Stable_Three": "Modul/Stable.html",\n' +
            '  "/TestHtmlTmpl.html": "Модуль/TestASort/TestHtmlTmpl.html"\n' +
            '}'
      );

      await clearWorkspace();
   });

   it('create symlink or copy', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/symlink');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);

      let config = {
         cache: cacheFolder,
         output: outputFolder,
         presentationServiceMeta: true,
         deprecatedWebPageTemplates: true,
         htmlWml: true,
         contents: true,
         less: true,
         builderTests: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View')
            },
            {
               name: 'UI',
               path: path.join(sourceFolder, 'UI')
            },
            {
               name: 'Compiler',
               path: path.join(sourceFolder, 'Compiler')
            },
            {
               name: 'UICore',
               path: path.join(sourceFolder, 'UICore')
            },
            {
               name: 'UICommon',
               path: path.join(sourceFolder, 'UICommon')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      const check = async() => {
         // запустим таску
         await runWorkflowWithTimeout();

         // файлы из исходников
         (await isSymlink(moduleOutputFolder, 'template.html')).should.equal(true);
         (await isSymlink(moduleOutputFolder, 'TestHtmlTmpl.html.tmpl')).should.equal(true);
         (await isSymlink(moduleOutputFolder, 'TestStaticHtml.js')).should.equal(true);

         // генерируемые файлы из исходников
         (await isRegularFile(moduleOutputFolder, 'StaticHtml.html')).should.equal(true);

         // генерируемые файлы на модуль
         (await isRegularFile(moduleOutputFolder, 'contents.json')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'navigation-modules.json')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'static_templates.json')).should.equal(true);
      };

      await check();
      (await isRegularFile(moduleOutputFolder, 'TestHtmlTmpl.html')).should.equal(true);

      config = {
         cache: cacheFolder,
         output: outputFolder,
         presentationServiceMeta: true,
         deprecatedWebPageTemplates: true,
         htmlWml: true,
         contents: true,
         less: true,
         builderTests: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // recheck build result again to check proper work of incremental build
      await check();

      /**
       * after rebuild without "View" and "UI" module:
       * 1)html.tmpl must not be builded.
       * 2)project build must be completed successfully
       */
      (await isRegularFile(moduleOutputFolder, 'TestHtmlTmpl.html')).should.equal(false);

      await clearWorkspace();
   });

   it('dont clear output if configured', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/symlink');
      await prepareTest(fixtureFolder);

      let config = {
         cache: cacheFolder,
         output: outputFolder,
         builderTests: true,
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();

      (await fs.pathExists(path.join(outputFolder, 'SBIS3.CONTROLS'))).should.equal(true);

      config = {
         cache: cacheFolder,
         output: outputFolder,
         clearOutput: false,
         builderTests: true,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await runWorkflowWithTimeout();

      // check for the first run results saved in the output directory
      (await fs.pathExists(moduleOutputFolder)).should.equal(true);
      (await fs.pathExists(path.join(outputFolder, 'SBIS3.CONTROLS'))).should.equal(true);
      await clearWorkspace();
   });

   // проверим, что js локализации корректно создаются. и что en-US.less попадает в lang/en-US/en-US.css
   it('localization dictionary and style', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/localization');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         less: true,
         localization: ['en-US', 'ru-RU'],
         'default-localization': 'ru-RU',
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Controls-default-theme',
               path: path.join(sourceFolder, 'Controls-default-theme')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      const check = async() => {
         // запустим таску
         await runWorkflowWithTimeout();
         (await isRegularFile(moduleOutputFolder, 'lang/en-US/en-US.css')).should.equal(true);
         (await isSymlink(moduleOutputFolder, 'lang/ru-RU/ru-RU.json')).should.equal(true);
      };

      await check();

      // второй раз, чтобы проверить не ломает ли чего инкрементальная сборка
      await check();

      await clearWorkspace();
   });

   it('versionize-meta', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/versionize-meta');
      const builderMetaOutput = path.join(outputFolder, 'Module/.builder');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         typescript: true,
         less: true,
         minimize: true,
         wml: true,
         builderTests: true,
         version: 'builder-test',
         localization: false,
         'default-localization': false,
         modules: [
            {
               name: 'Module',
               path: path.join(sourceFolder, 'Module')
            },
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View')
            },
            {
               name: 'UI',
               path: path.join(sourceFolder, 'UI')
            },
            {
               name: 'Compiler',
               path: path.join(sourceFolder, 'Compiler')
            },
            {
               name: 'UICore',
               path: path.join(sourceFolder, 'UICore')
            },
            {
               name: 'UICommon',
               path: path.join(sourceFolder, 'UICommon')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await runWorkflowWithTimeout();
      (await isRegularFile(builderMetaOutput, 'versioned_modules.json')).should.equal(true);
      (await isRegularFile(builderMetaOutput, 'cdn_modules.json')).should.equal(true);
      let versionedModules = await fs.readJson(path.join(builderMetaOutput, 'versioned_modules.json'));
      let cdnModules = await fs.readJson(path.join(builderMetaOutput, 'cdn_modules.json'));
      versionedModules.should.have.members([
         'Module/_private/TimeTester.min.tmpl',
         'Module/browser.min.css',
         'Module/browser-with-real-cdn.min.css',
         'Module/demo.html',
         'Module/someLibrary.min.js'
      ]);
      cdnModules.should.have.members([
         'Module/_private/TimeTester.min.tmpl',
         'Module/_private/TimeTester.tmpl',
         'Module/browser.min.css',
         'Module/browser.css',
         'Module/someLibrary.js',
         'Module/someLibrary.min.js'
      ]);

      // прогоним ещё раз, создание мета-файла версионирования должно нормально работать в инкрементальной сборке
      await runWorkflowWithTimeout();
      (await isRegularFile(builderMetaOutput, 'versioned_modules.json')).should.equal(true);
      versionedModules = await fs.readJson(path.join(builderMetaOutput, 'versioned_modules.json'));
      cdnModules = await fs.readJson(path.join(builderMetaOutput, 'cdn_modules.json'));
      versionedModules.should.have.members([
         'Module/_private/TimeTester.min.tmpl',
         'Module/browser.min.css',
         'Module/browser-with-real-cdn.min.css',
         'Module/demo.html',
         'Module/someLibrary.min.js'
      ]);
      cdnModules.should.have.members([
         'Module/_private/TimeTester.min.tmpl',
         'Module/_private/TimeTester.tmpl',
         'Module/browser.min.css',
         'Module/browser.css',
         'Module/someLibrary.js',
         'Module/someLibrary.min.js'
      ]);
      await clearWorkspace();
   });

   it('minimize third-party libraries', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/minimize');
      const testResults = async() => {
         const firstMinifiedContent = await fs.readFile(path.join(outputFolder, 'ThirdPartyModule/third-party/test.min.js'), 'utf8');
         const secondMinifiedContent = await fs.readFile(path.join(outputFolder, 'ThirdPartyModule/third-party/test2.min.js'), 'utf8');

         // source library with minified version must be written into output as is
         removeRSymbol(firstMinifiedContent).should.equal('define(\'ThirdPartyModule/test\', [\'someDependency\'], function (dep1) {\n' +
            '   /* minified content from sources */\n' +
            '   return {\n' +
            '      dep1: dep1,\n' +
            '      _moduleName: \'ThirdPartyModule/test\'\n' +
            '   }\n' +
            '});');

         // source library without minified version must be minified by builder
         removeRSymbol(secondMinifiedContent).should.equal(
            'define("ThirdPartyModule/test2",["someDependency","someAnotherDependency"],function(e,d){return{dep1:e,dep2:d,_moduleName:"ThirdPartyModule/test2"}});'
         );
      };
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         minimize: true,
         modules: [
            {
               name: 'ThirdPartyModule',
               path: path.join(sourceFolder, 'ThirdPartyModule')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await runWorkflowWithTimeout();
      await testResults();
      await runWorkflowWithTimeout();
      await testResults();
      await clearWorkspace();
   });

   it('filter sources', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/esAndTs');
      await prepareTest(fixtureFolder);
      const config = {
         cache: cacheFolder,
         output: sourceFolder,
         typescript: true,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      const sourceTsMTime = await getMTime(path.join(sourceFolder, 'Модуль/StableTS.ts'));

      await runWorkflowWithTimeout(30000);

      (await getMTime(path.join(sourceFolder, 'Модуль/StableTS.ts'))).should.equal(sourceTsMTime);
      await clearWorkspace();
   });
   describe('custom pack', () => {
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         typescript: true,
         less: true,
         minimize: true,
         wml: true,
         version: 'builder.unit.tests',
         localization: ['en', 'ru', 'ru-RU'],
         'default-localization': 'ru-RU',
         deprecatedXhtml: true,
         builderTests: true,
         customPack: true,
         contents: true,
         compress: true,
         joinedMeta: true,
         dependenciesGraph: true,
         sourceMaps: true,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль'),
               depends: ['WS.Core', 'Types', 'SBIS3.CONTROLS']
            },
            {
               name: 'ExternalInterfaceModule',
               path: path.join(sourceFolder, 'ExternalInterfaceModule')
            },
            {
               name: 'InterfaceModule1',
               path: path.join(sourceFolder, 'InterfaceModule1')
            },
            {
               name: 'InterfaceModule1-default-theme',
               path: path.join(sourceFolder, 'InterfaceModule1-default-theme')
            },
            {
               name: 'InterfaceModule2',
               path: path.join(sourceFolder, 'InterfaceModule2')
            },
            {
               name: 'InterfaceModule3',
               path: path.join(sourceFolder, 'InterfaceModule3')
            },
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View')
            },
            {
               name: 'UI',
               path: path.join(sourceFolder, 'UI')
            },
            {
               name: 'Compiler',
               path: path.join(sourceFolder, 'Compiler')
            },
            {
               name: 'UICore',
               path: path.join(sourceFolder, 'UICore')
            },
            {
               name: 'UICommon',
               path: path.join(sourceFolder, 'UICommon')
            },
            {
               name: 'Vdom',
               path: path.join(sourceFolder, 'Vdom')
            },
            {
               name: 'Router',
               path: path.join(sourceFolder, 'Router')
            },
            {
               name: 'Inferno',
               path: path.join(sourceFolder, 'Inferno')
            },
            {
               name: 'Types',
               path: path.join(sourceFolder, 'Types')
            },
            {
               name: 'Module_with_library',
               path: path.join(sourceFolder, 'Module_with_library')
            }
         ]
      };
      before(async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/custompack');
         await prepareTest(fixtureFolder);
         await linkPlatform(sourceFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflowWithTimeout();
      });

      it('joined meta must have all common builder meta files', async() => {
         (await isRegularFile(outputFolder, 'module-dependencies.json')).should.equal(true);
         (await isRegularFile(outputFolder, 'module-dependencies.min.json')).should.equal(true);
         (await isRegularFile(outputFolder, 'bundles.js')).should.equal(true);
         (await isRegularFile(outputFolder, 'bundles.min.js')).should.equal(true);
         (await isRegularFile(outputFolder, 'router.js')).should.equal(true);
         (await isRegularFile(outputFolder, 'router.min.js')).should.equal(true);
         (await isRegularFile(outputFolder, 'contents.json')).should.equal(true);
      });
      it('joined meta must have correct data', async() => {
         const routerMeta = await fs.readFile(path.join(outputFolder, 'router.js'), 'utf8');
         const minRouterMeta = await fs.readFile(path.join(outputFolder, 'router.min.js'), 'utf8');
         const correctRouterMeta = 'define(\'router\', [], function(){ return {"/":"Modul/Index"}; })';
         routerMeta.should.equal(correctRouterMeta);
         minRouterMeta.should.equal(correctRouterMeta);
      });
      it('packed as javascript content styles in usual package should have correct related urls', async() => {
         const resultExtendBundlesMeta = await fs.readFile(
            path.join(outputFolder, 'InterfaceModule1/interfacemodule1-styles-in-js.package.min.js'),
            'utf8'
         );
         const result = resultExtendBundlesMeta.includes('url("+(global.wsConfig && global.wsConfig.resourceRoot ? global.wsConfig.resourceRoot : "resources/")+"InterfaceModule1/images/logo-en.svg?x_module=%{MODULE_VERSION_STUB=InterfaceModule1})');
         result.should.equal(true);
      });
      it('private packages should be generated despite of theirs not existing in bundles approved list', async() => {
         (await isRegularFile(moduleOutputFolder, 'private.min.original.js')).should.equal(true);
         const resultPackage = await fs.readFile(path.join(moduleOutputFolder, 'private.min.js'), 'utf8');
         const correctResultPackage = await fs.readFile(
            path.join(sourceFolder, 'correctResult/privatePackage.js'),
            'utf8'
         );
         resultPackage.should.equal(correctResultPackage);
      });
      it('custom package with lazy modules initialization should be generated correctly', async() => {
         const privateLazyPackage = await fs.readFile(
            path.join(outputFolder, 'Modul/lazy-private.package.min.js'),
            'utf8'
         );
         const correctPrivateLazyPackage = await fs.readFile(
            path.join(sourceFolder, 'correctResult/lazyPrivatePackage.js'),
            'utf8'
         );
         removeRSymbol(privateLazyPackage).should.equal(removeRSymbol(correctPrivateLazyPackage));
      });
      it('exclude new unknown for builder packages', async() => {
         (await isRegularFile(moduleOutputFolder, 'test.package.min.js')).should.equal(false);
         (await isRegularFile(moduleOutputFolder, 'test.package.min.css')).should.equal(false);
      });
      it('generate extendable bundles', async() => {
         const correctSuperbundleConfig = await fs.readJson(
            path.join(
               sourceFolder,
               'extendableBundlesResults',
               'superbundle-result-config.json'
            )
         );
         const correctExtendBundlesConfig = await fs.readJson(
            path.join(
               sourceFolder,
               'extendableBundlesResults',
               'extend-bundles.json'
            )
         );
         const extendBundlesConfig = await fs.readJson(
            path.join(outputFolder, 'InterfaceModule1', 'extend-bundles.json')
         );

         extendBundlesConfig.should.deep.equal(correctExtendBundlesConfig);
         const currentCssPackage = await fs.readFile(path.join(
            outputFolder,
            'InterfaceModule1/packages',
            'superbundle-for-builder-tests.package.min.css'
         ));
         const sourceCssPackage = await fs.readFile(path.join(
            sourceFolder,
            'extendableBundlesResults',
            'cssPackage.css'
         ));
         const currentJsPackage = await fs.readFile(path.join(
            outputFolder,
            'InterfaceModule1/packages',
            'superbundle-for-builder-tests.package.min.js'
         ));
         const sourceJsPackage = await fs.readFile(path.join(
            sourceFolder,
            'extendableBundlesResults',
            'jsPackage.js'
         ));

         currentJsPackage.toString().should.equal(sourceJsPackage.toString());
         currentCssPackage.toString().should.equal(sourceCssPackage.toString());

         /**
          * In ExternalInterfaceModule we have packed into moduled superbundle library "library". bundlesRoute meta must
          * not have information about this library. "libraries" meta must have it.
          */
         const resultModuleLibraries = await fs.readJson(path.join(outputFolder, 'ExternalInterfaceModule/.builder/libraries.json'));
         const resultModuleBundlesRoute = await fs.readJson(path.join(outputFolder, 'ExternalInterfaceModule/bundlesRoute.json'));
         resultModuleLibraries.should.have.members([
            'ExternalInterfaceModule/library'
         ]);
         resultModuleBundlesRoute.should.deep.equal({
            'ExternalInterfaceModule/_private/module1': 'resources/Modul/TestBSort/test-projectMDeps.package.min.js',
            'ExternalInterfaceModule/_private/module2': 'resources/Modul/TestBSort/test-projectMDeps.package.min.js',
            'ExternalInterfaceModule/amdModule': 'resources/Modul/TestBSort/test-projectMDeps.package.min.js',
            'ExternalInterfaceModule/library': 'resources/Modul/TestBSort/test-projectMDeps.package.min.js',
            'css!ExternalInterfaceModule/moduleStyle': 'resources/Modul/TestBSort/test-projectMDeps.package.min.css'
         });

         // build result must have correct meta about extendable bundles
         const resultExtendBundlesMeta = await fs.readJson(path.join(outputFolder, 'InterfaceModule1/extend-bundles.json'));
         resultExtendBundlesMeta.should.deep.equal({
            'InterfaceModule1/packages/superbundle-for-builder-tests.package.min.css': {
               extendsTo: 'superbundle-for-builder-tests.package.min.css',
               config: '/InterfaceModule1/packages/extendable-bundle.package.json:superbundle-for-builder-tests.package.js'
            },
            'InterfaceModule1/packages/superbundle-for-builder-tests.package.min.js': {
               extendsTo: 'superbundle-for-builder-tests.package.min.js',
               modules: [
                  'InterfaceModule1/amdModule',
                  'InterfaceModule1/library',
                  'css!InterfaceModule1-default-theme/themedStyle',
                  'css!InterfaceModule1/amdModule',
                  'css!InterfaceModule1/moduleStyle'
               ],
               config: '/InterfaceModule1/packages/extendable-bundle.package.json:superbundle-for-builder-tests.package.js'
            }
         });

         /**
          * check generated superbundle config meta to be strictly equal to
          * correct meta.
          */
         const superbundleConfig = await fs.readJson(
            path.join(
               outputFolder,
               'InterfaceModule1/.builder/superbundle-for-builder-tests.package.js.package.json'
            )
         );
         superbundleConfig.should.deep.equal(correctSuperbundleConfig);
      });
      it('gzip and brotli - check for brotli correct encoding and decoding. Should compressed only minified and packed', async() => {
         const resultFiles = await fs.readdir(moduleOutputFolder);
         const correctMembers = [
            '.builder',
            'Test',
            'lang',
            'TestASort',
            'TestBSort',
            'Page.min.wml',
            'Page.wml.map',
            'Page.min.wml.gz',
            'Page.min.wml.br',
            'Page.wml',
            'Page.min.xhtml',
            'Page.xhtml',
            'contents.json',
            'contents.json.js',
            'contents.json.min.js',
            'contents.json.min.js.br',
            'contents.json.min.js.gz',
            'contents.min.json',
            'contents.min.json.br',
            'contents.min.json.gz',
            'Stable.css',
            'Stable.less',
            'Stable.min.css',
            'Stable.min.css.gz',
            'Stable.min.css.br',
            'cbuc-icons.eot',
            'bundles.json',
            'bundlesRoute.json',
            'module-dependencies.json',
            'pack.package.json',
            'test-brotli.package.min.css',
            'test-brotli.package.min.css.gz',
            'test-brotli.package.min.css.br',
            'test-brotli.package.min.js',
            'test-brotli.package.min.js.gz',
            'test-brotli.package.min.js.br',
            'private.js',
            'private.min.css',
            'private.min.css.gz',
            'private.min.css.br',
            'private.min.js',
            'private.js.map',
            'private.min.js.gz',
            'private.min.js.br',
            'private.min.original.js',
            'private.package.json',
            'router.json',
            'router.json.js',
            'router.json.min.js',
            'router.json.min.js.br',
            'router.json.min.js.gz',
            'router.min.json',
            'router.min.json.br',
            'router.min.json.gz',
            'lazy-private.package.min.css',
            'lazy-private.package.min.css.br',
            'lazy-private.package.min.css.gz',
            'lazy-private.package.min.js',
            'lazy-private.package.min.js.br',
            'lazy-private.package.min.js.gz',
            'packageMap.json.js',
            'packageMap.json.min.js',
            'packageMap.json.min.js.br',
            'packageMap.json.min.js.gz'
         ];

         // output directory must have brotli(except windows os) and gzip files, only for minified files and packages.
         resultFiles.should.have.members(correctMembers);
         const cssContent = await fs.readFile(path.join(moduleOutputFolder, 'test-brotli.package.min.css'));
         const cssBrotliContent = await fs.readFile(path.join(moduleOutputFolder, 'test-brotli.package.min.css.br'));
         const cssDecompressed = await decompress(cssBrotliContent);

         // decompressed brotli must be equal source css content
         cssDecompressed.toString().should.equal(cssContent.toString());
      });
      it('versioned modules meta should have correct members', async() => {
         const versionedModules = await fs.readJson(path.join(moduleOutputFolder, '.builder/versioned_modules.json'));
         versionedModules.should.have.members([
            'Modul/Page.min.wml',
            'Modul/Test/test.package.min.css',
            'Modul/Test/test.package.min.js',
            'Modul/TestASort/test.package.min.css',
            'Modul/TestASort/test.package.min.js',
            'Modul/TestBSort/test-projectExtDeps.package.min.css',
            'Modul/TestBSort/test-projectExtDeps.package.min.js',
            'Modul/TestBSort/test-projectMDeps.package.min.css',
            'Modul/TestBSort/test-projectMDeps.package.min.js',
            'Modul/TestBSort/test-superbundle.package.min.css',
            'Modul/TestBSort/test-superbundle.package.min.js',
            'Modul/contents.json',
            'Modul/contents.min.json',
            'Modul/contents.json.js',
            'Modul/contents.json.min.js',
            'Modul/private.min.css',
            'Modul/private.min.js',
            'Modul/lazy-private.package.min.css',
            'Modul/lazy-private.package.min.js',
            'Modul/test-brotli.package.min.css',
            'Modul/test-brotli.package.min.js'
         ]);
         const cdnModules = await fs.readJson(path.join(moduleOutputFolder, '.builder/cdn_modules.json'));
         cdnModules.should.have.members([
            'Modul/Test/test.package.min.css',
            'Modul/Test/test.package.min.js',
            'Modul/TestASort/test.package.min.css',
            'Modul/TestASort/test.package.min.js',
            'Modul/TestBSort/test-projectExtDeps.package.min.css',
            'Modul/TestBSort/test-projectExtDeps.package.min.js',
            'Modul/TestBSort/test-projectMDeps.package.min.css',
            'Modul/TestBSort/test-projectMDeps.package.min.js',
            'Modul/TestBSort/test-superbundle.package.min.css',
            'Modul/TestBSort/test-superbundle.package.min.js',
            'Modul/private.min.css',
            'Modul/private.min.js',
            'Modul/lazy-private.package.min.css',
            'Modul/lazy-private.package.min.js',
            'Modul/test-brotli.package.min.css',
            'Modul/test-brotli.package.min.js'
         ]);
      });
      it('patch module to another output', async() => {
         config.modules[1].rebuild = true;
         config.output = `${config.output}-patch`;
         await fs.writeJSON(configPath, config);
         await runWorkflowWithTimeout();

         config.modules[0].rebuild = true;
         await fs.writeJSON(configPath, config);

         // rebuild again to make sure incremental rebuild of patch doesn't break anything
         await runWorkflowWithTimeout();
         await runWorkflowWithTimeout();
      });
      it('versioned modules meta should have correct members for patch build', async() => {
         const versionedModules = await fs.readJson(path.join(moduleOutputFolder, '.builder/versioned_modules.json'));
         versionedModules.should.have.members([
            'Modul/Page.min.wml',
            'Modul/Test/test.package.min.css',
            'Modul/Test/test.package.min.js',
            'Modul/TestASort/test.package.min.css',
            'Modul/TestASort/test.package.min.js',
            'Modul/TestBSort/test-projectExtDeps.package.min.css',
            'Modul/TestBSort/test-projectExtDeps.package.min.js',
            'Modul/TestBSort/test-projectMDeps.package.min.css',
            'Modul/TestBSort/test-projectMDeps.package.min.js',
            'Modul/TestBSort/test-superbundle.package.min.css',
            'Modul/TestBSort/test-superbundle.package.min.js',
            'Modul/contents.json',
            'Modul/contents.min.json',
            'Modul/contents.json.js',
            'Modul/contents.json.min.js',
            'Modul/private.min.css',
            'Modul/private.min.js',
            'Modul/lazy-private.package.min.css',
            'Modul/lazy-private.package.min.js',
            'Modul/test-brotli.package.min.css',
            'Modul/test-brotli.package.min.js'
         ]);
         const cdnModules = await fs.readJson(path.join(moduleOutputFolder, '.builder/cdn_modules.json'));
         cdnModules.should.have.members([
            'Modul/Test/test.package.min.css',
            'Modul/Test/test.package.min.js',
            'Modul/TestASort/test.package.min.css',
            'Modul/TestASort/test.package.min.js',
            'Modul/TestBSort/test-projectExtDeps.package.min.css',
            'Modul/TestBSort/test-projectExtDeps.package.min.js',
            'Modul/TestBSort/test-projectMDeps.package.min.css',
            'Modul/TestBSort/test-projectMDeps.package.min.js',
            'Modul/TestBSort/test-superbundle.package.min.css',
            'Modul/TestBSort/test-superbundle.package.min.js',
            'Modul/private.min.css',
            'Modul/private.min.js',
            'Modul/lazy-private.package.min.css',
            'Modul/lazy-private.package.min.js',
            'Modul/test-brotli.package.min.css',
            'Modul/test-brotli.package.min.js'
         ]);
      });
      it('check base output - custompack and regular compressed artifacts should be on its places', async() => {
         // check current list of files to be existing in checking folder
         const checkResults = async(filesToCheck, folderToCheck) => {
            const promises = filesToCheck.map(
               currentFile => (async() => {
                  (await isRegularFile(folderToCheck, currentFile)).should.equal(true);
               })()
            );
            await Promise.all(promises);
         };
         await checkResults(
            [
               'test-brotli.package.min.js',
               'test-brotli.package.min.css',
               'test-brotli.package.min.js.br',
               'test-brotli.package.min.js.gz',
               'bundlesRoute.json',
               'bundles.json'
            ],
            moduleOutputFolder
         );
         await runWorkflowWithTimeout();
         await checkResults(
            [
               'private.min.css.br',
               'private.min.css.gz',
               'private.min.js.br',
               'private.min.js.gz',
            ],
            path.join(`${outputFolder}-patch`, 'Modul')
         );

         delete config.modules[0].rebuild;
         delete config.modules[1].rebuild;
         config.output = config.output.replace(/-patch$/, '');
         await fs.writeJSON(configPath, config);
      });
      it('module-dependencies must have actual info after source component remove', async() => {
         await fs.remove(path.join(sourceFolder, 'Модуль/Page.wml'));

         // clear output to ensure correct work of incremental rebuild
         await fs.remove(outputFolder);
         await runWorkflowWithTimeout();
         const { nodes } = await fs.readJson(path.join(outputFolder, 'module-dependencies.json'));

         // after source remove and project rebuild module-dependencies must not have node for current source file
         nodes.hasOwnProperty('wml!Modul/Page').should.equal(false);
      });
      it('bundlesRoute meta must have all of libraries after incremental rebuild', async() => {
         const bundlesRoutePath = path.join(outputFolder, 'Module_with_library', 'bundlesRoute.json');
         (await isRegularFile(path.join(outputFolder, 'Module_with_library'), 'bundlesRoute.json')).should.equal(true);
         const bundlesRouteResult = await fs.readJson(bundlesRoutePath);
         bundlesRouteResult.should.deep.equal({
            'Module_with_library/library': 'resources/Module_with_library/library.min.js'
         });
      });
      it('bundlesRoute meta for intersecting packages must have meta for the latest sorted package', async() => {
         const bundlesRouteResult = await fs.readJson(path.join(moduleOutputFolder, 'bundlesRoute.json'));

         /**
          * bundlesRoute meta in 'Modul" interface module must not contain information about packed external modules,
          * it should be stored in proper interface module
          */
         bundlesRouteResult.hasOwnProperty('ExternalInterfaceModule/amdModule').should.equal(false);
         bundlesRouteResult.hasOwnProperty('css!ExternalInterfaceModule/moduleStyle').should.equal(false);

         const externalBundlesRouteResult = await fs.readJson(path.join(outputFolder, 'ExternalInterfaceModule/bundlesRoute.json'));
         externalBundlesRouteResult['ExternalInterfaceModule/amdModule'].should.equal('resources/Modul/TestBSort/test-projectMDeps.package.min.js');
         externalBundlesRouteResult['css!ExternalInterfaceModule/moduleStyle'].should.equal('resources/Modul/TestBSort/test-projectMDeps.package.min.css');
      });
      it('root bundles meta must have correct values', async() => {
         const rootBundlesMeta = await fs.readJson(path.join(outputFolder, 'bundles.json'));
         rootBundlesMeta.hasOwnProperty('resources/Modul/TestBSort/test-projectMDeps.package.min').should.equal(true);
         rootBundlesMeta['resources/Modul/TestBSort/test-projectMDeps.package.min'].should.deep.equal([
            'ExternalInterfaceModule/_private/module1',
            'ExternalInterfaceModule/_private/module2',
            'ExternalInterfaceModule/amdModule',
            'ExternalInterfaceModule/library',
            'Modul/private',
            'css!ExternalInterfaceModule/moduleStyle',
            'css!Modul/Stable',
            'html!Modul/Page'
         ]);
         const rootBundlesRouteMeta = await fs.readJson(path.join(outputFolder, 'bundlesRoute.json'));
         rootBundlesRouteMeta.hasOwnProperty('ExternalInterfaceModule/amdModule').should.equal(true);
         rootBundlesRouteMeta['ExternalInterfaceModule/amdModule'].should.equal('resources/Modul/TestBSort/test-projectMDeps.package.min.js');
      });
      it('superbundle\'s bundlesRoute meta must be saved in the same interface module', async() => {
         const bundlesRoute = await fs.readJson(path.join(moduleOutputFolder, 'bundlesRoute.json'));
         bundlesRoute.should.deep.equal({
            'InterfaceModule1/_private/module1': 'resources/Modul/TestBSort/test-superbundle.package.min.js',
            'InterfaceModule1/_private/module2': 'resources/Modul/TestBSort/test-superbundle.package.min.js',
            'InterfaceModule1/amdModule': 'resources/Modul/TestBSort/test-superbundle.package.min.js',
            'InterfaceModule1/library': 'resources/Modul/TestBSort/test-superbundle.package.min.js',
            'css!InterfaceModule1/moduleStyle': 'resources/Modul/TestBSort/test-superbundle.package.min.css',
            'css!InterfaceModule1/amdModule': 'resources/Modul/TestBSort/test-superbundle.package.min.css',
            'Modul/private': 'resources/Modul/test-brotli.package.min.js',
            'css!Modul/Stable': 'resources/Modul/test-brotli.package.min.css',
            'html!Modul/Page': 'resources/Modul/test-brotli.package.min.js'
         });
      });
      it('patch module', async() => {
         config.modules[0].rebuild = true;
         config.modules[1].rebuild = true;
         await fs.writeJSON(configPath, config);
         await runWorkflowWithTimeout();
      });
      it('patch-module without extendable-bundles: after rebuild must not be saved extendBundles meta into WS.Core and root', async() => {
         (await isRegularFile(outputFolder, 'common-extend-bundles.json')).should.equal(false);
         (await isRegularFile(outputFolder, 'WS.Core/bundles.json')).should.equal(false);
         (await isRegularFile(outputFolder, 'WS.Core/bundlesRoute.json')).should.equal(false);
      });
      it('patch-bundlesRoute meta after patch rebuild for intersecting packages must have meta for the latest sorted package', async() => {
         const bundlesRouteResult = await fs.readJson(path.join(moduleOutputFolder, 'bundlesRoute.json'));

         /**
          * bundlesRoute meta in "Modul" interface module must not contain information about packed external modules,
          * it should be stored in proper interface module
          */
         bundlesRouteResult.hasOwnProperty('ExternalInterfaceModule/amdModule').should.equal(false);
         bundlesRouteResult.hasOwnProperty('css!ExternalInterfaceModule/moduleStyle').should.equal(false);

         const externalBundlesRouteResult = await fs.readJson(path.join(outputFolder, 'ExternalInterfaceModule/bundlesRoute.json'));
         externalBundlesRouteResult['ExternalInterfaceModule/amdModule'].should.equal('resources/Modul/TestBSort/test-projectMDeps.package.min.js');
         externalBundlesRouteResult['css!ExternalInterfaceModule/moduleStyle'].should.equal('resources/Modul/TestBSort/test-projectMDeps.package.min.css');
      });
      it('patch-build must have module-dependencies for all modules(not only for the patching modules)', async() => {
         /**
          * reads package from "Modul" Interface module,
          * that contains content from another interface module "InterfaceModule1".
          * Patching of interface module "Modul" must not affect build of current package -
          * that's the main argument of module-dependencies meta validity.
          */
         const resultPackage = await fs.readFile(path.join(moduleOutputFolder, 'TestBSort/test-projectMDeps.package.min.js'), 'utf8');
         const correctResultPackage = await fs.readFile(
            path.join(sourceFolder, 'correctResult/test-projectMDeps.package.min.js'),
            'utf8'
         );
         resultPackage.should.equal(correctResultPackage);
      });
      it('patch - after patch for module "Modul" other interface modules cache must not be affected(files removal)', async() => {
         const modulesCacheFolder = path.join(cacheFolder, 'incremental_build');

         // check root interface module directory
         let testDirectory = await fs.readdir(path.join(modulesCacheFolder, 'InterfaceModule1'));
         testDirectory.should.have.members([
            '.builder',
            '_private',
            'amdModule.js',
            'amdModule.js.map',
            'amdModule.min.js',
            'amdModule.css',
            'amdModule.min.css',
            'extend.package.json',
            'library.modulepack.js',
            'library.modulepack.js.map',
            'library.ts',
            'library.js',
            'library.min.js',
            'module-dependencies.json',
            'moduleStyle.css',
            'moduleStyle.min.css',
            'contents.json',
            'contents.json.js',
            'contents.json.min.js',
            'contents.min.json',
            'packages'
         ]);

         // check builder meta
         testDirectory = await fs.readdir(path.join(modulesCacheFolder, 'InterfaceModule1/.builder'));
         testDirectory.should.have.members([
            'cdn_modules.json',
            'libraries.json',
            'versioned_modules.json'
         ]);

         // check subdirectory of module
         testDirectory = await fs.readdir(path.join(modulesCacheFolder, 'InterfaceModule1/_private'));
         testDirectory.should.have.members([
            'module1.ts',
            'module1.js',
            'module1.js.map',
            'module1.min.js',
            'module2.ts',
            'module2.js',
            'module2.js.map',
            'module2.min.js',
         ]);
      });
      it('patch - superbundle\'s bundlesRoute meta must be saved in the same interface module', async() => {
         const bundlesRoute = await fs.readJson(path.join(moduleOutputFolder, 'bundlesRoute.json'));
         bundlesRoute.should.deep.equal({
            'InterfaceModule1/_private/module1': 'resources/Modul/TestBSort/test-superbundle.package.min.js',
            'InterfaceModule1/_private/module2': 'resources/Modul/TestBSort/test-superbundle.package.min.js',
            'InterfaceModule1/amdModule': 'resources/Modul/TestBSort/test-superbundle.package.min.js',
            'InterfaceModule1/library': 'resources/Modul/TestBSort/test-superbundle.package.min.js',
            'Modul/private': 'resources/Modul/test-brotli.package.min.js',
            'css!InterfaceModule1/moduleStyle': 'resources/Modul/TestBSort/test-superbundle.package.min.css',
            'css!InterfaceModule1/amdModule': 'resources/Modul/TestBSort/test-superbundle.package.min.css',
            'css!Modul/Stable': 'resources/Modul/test-brotli.package.min.css',
            'html!Modul/Page': 'resources/Modul/test-brotli.package.min.js'
         });
      });
      it('patch - after patch build output result must contain only results of patched module and joined builder meta', async() => {
         const outputFolderResults = await fs.readdir(outputFolder);
         outputFolderResults.should.have.members([
            'ExternalInterfaceModule',
            'Modul',
            'bundles.js',
            'bundles.min.js',
            'bundles.json',
            'bundlesRoute.json',
            'contents.js',
            'contents.min.js',
            'contents.json',
            'module-dependencies.json',
            'module-dependencies.min.json',
            'router.js',
            'router.min.js',
            'themes'
         ]);
      });
      it('patch - meta should be updated after sources removal', async() => {
         const currentMetaOutput = path.join(outputFolder, 'ExternalInterfaceModule', '.builder');
         let librariesMeta = await fs.readJson(path.join(currentMetaOutput, 'libraries.json'));
         librariesMeta.should.have.members([
            'ExternalInterfaceModule/library'
         ]);

         /**
          * rename ts-file(to check libraries.json for an update)
          */
         await fs.rename(
            path.join(sourceFolder, 'ExternalInterfaceModule', 'library.ts'),
            path.join(sourceFolder, 'ExternalInterfaceModule', 'library_new.ts')
         );

         // run build
         await runWorkflowWithTimeout();

         // read meta and check it for updated data
         librariesMeta = await fs.readJson(path.join(currentMetaOutput, 'libraries.json'));
         librariesMeta.should.have.members([
            'ExternalInterfaceModule/library_new'
         ]);

         // rollback for further unit tests
         await fs.rename(
            path.join(sourceFolder, 'ExternalInterfaceModule', 'library_new.ts'),
            path.join(sourceFolder, 'ExternalInterfaceModule', 'library.ts')
         );
         await clearWorkspace();
      });
      it('patch module with cleared cache', async() => {
         await clearWorkspace();
         const fixtureFolder = path.join(__dirname, 'fixture/custompack');
         await prepareTest(fixtureFolder);
         await linkPlatform(sourceFolder);
         config.modules[0].rebuild = true;
         config.modules[1].rebuild = true;
         await fs.writeJSON(configPath, config);
         await runWorkflowWithTimeout();
      });
      it('finish patch tests pack', async() => {
         await clearWorkspace();
      });
      it('for desktop application dont save bundlesRoute meta', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/custompack');
         await prepareTest(fixtureFolder);
         await linkPlatform(sourceFolder);
         const desktopConfig = {
            cache: cacheFolder,
            output: outputFolder,
            typescript: true,
            less: true,
            minimize: true,
            wml: true,
            builderTests: true,
            customPack: true,
            sources: false,
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'ExternalInterfaceModule',
                  path: path.join(sourceFolder, 'ExternalInterfaceModule')
               },
               {
                  name: 'InterfaceModule1',
                  path: path.join(sourceFolder, 'InterfaceModule1')
               }
            ]
         };
         await fs.writeJSON(configPath, desktopConfig);

         await runWorkflowWithTimeout();

         /**
          * bundlesRoute must not be saved in results. bundles meta must be saved.
          * Only bundles.json meta from packer meta results uses in all desktop applications.
          */
         (await isRegularFile(moduleOutputFolder, 'bundlesRoute.json')).should.equal(false);
         (await isRegularFile(moduleOutputFolder, 'bundles.json')).should.equal(true);
         await runWorkflowWithTimeout();

         /**
          * bundlesRoute must not be saved in results. bundles meta must be saved.
          * Only bundles.json meta from packer meta results uses in all desktop applications.
          */
         (await isRegularFile(moduleOutputFolder, 'bundlesRoute.json')).should.equal(false);
         (await isRegularFile(moduleOutputFolder, 'bundles.json')).should.equal(true);
         await clearWorkspace();
      });
      it('custom pack must have an ability to work with debug files', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/custompack');
         await prepareTest(fixtureFolder);
         await linkPlatform(sourceFolder);

         const testResults = async() => {
            const correctPackagePath = path.join(fixtureFolder, 'correctResult/superbundle-part-with-debug');
            const packagePath = path.join(outputFolder, 'InterfaceModule1/packages/superbundle-for-builder-tests.package.min');
            const compiledCssPackage = await fs.readFile(`${packagePath}.css`, 'utf8');
            const compiledJsPackage = await fs.readFile(`${packagePath}.js`, 'utf8');
            const correctCssPackage = await fs.readFile(`${correctPackagePath}.css`, 'utf8');
            const correctJsPackage = await fs.readFile(`${correctPackagePath}.js`, 'utf8');
            compiledCssPackage.should.equal(correctCssPackage);
            removeRSymbol(compiledJsPackage).should.equal(removeRSymbol(correctJsPackage));
         };

         const desktopConfig = {
            cache: cacheFolder,
            output: outputFolder,
            typescript: true,
            less: true,
            wml: true,
            builderTests: true,
            minimize: true,
            debugCustomPack: true,
            dependenciesGraph: true,
            distributive: false,
            joinedMeta: true,
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'ExternalInterfaceModule',
                  path: path.join(sourceFolder, 'ExternalInterfaceModule')
               },
               {
                  name: 'InterfaceModule1',
                  path: path.join(sourceFolder, 'InterfaceModule1')
               }
            ]
         };
         await fs.writeJSON(configPath, desktopConfig);

         await runWorkflowWithTimeout();
         await testResults();

         await runWorkflowWithTimeout();
         await testResults();

         await clearWorkspace();
      });
      it('custom flags for each module should work properly', async() => {
         const intModule1Output = path.join(outputFolder, 'InterfaceModule1');
         const fixtureFolder = path.join(__dirname, 'fixture/custompack');
         await prepareTest(fixtureFolder);
         await linkPlatform(sourceFolder);

         const testResults = async() => {
            // there shouldn't be any artifacts of minimize
            (await isRegularFile(intModule1Output, 'amdModule.min.css')).should.equal(false);
            (await isRegularFile(intModule1Output, 'amdModule.min.js')).should.equal(false);

            // there shouldn't be any artifacts of typescript compile and libraries pack
            (await isRegularFile(intModule1Output, 'library.js')).should.equal(false);
            (await isRegularFile(intModule1Output, 'library.min.js')).should.equal(false);
            (await isRegularFile(`${intModule1Output}/_private`, 'module1.js')).should.equal(false);
            (await isRegularFile(`${intModule1Output}/_private`, 'module1.min.js')).should.equal(false);
            (await isRegularFile(`${intModule1Output}/_private`, 'module2.js')).should.equal(false);
            (await isRegularFile(`${intModule1Output}/_private`, 'module2.min.js')).should.equal(false);

            // there shouldn't be any artifacts of custom pack
            (await isRegularFile('InterfaceModule1/.builder', 'superbundle-for-builder-tests.package.js.package.json')).should.equal(false);
            (await isRegularFile('InterfaceModule1/packages', 'superbundle-for-builder-tests.package.min.css')).should.equal(false);
            (await isRegularFile('InterfaceModule1/packages', 'superbundle-for-builder-tests.package.min.js')).should.equal(false);
         };

         const desktopConfig = {
            cache: cacheFolder,
            output: outputFolder,
            typescript: true,
            less: true,
            wml: true,
            builderTests: true,
            minimize: true,
            debugCustomPack: true,
            dependenciesGraph: true,
            distributive: false,
            joinedMeta: true,
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'ExternalInterfaceModule',
                  path: path.join(sourceFolder, 'ExternalInterfaceModule')
               },
               {
                  name: 'InterfaceModule1',
                  path: path.join(sourceFolder, 'InterfaceModule1'),
                  minimize: false,
                  typescript: false,
                  less: false,
                  wml: false,
                  debugCustomPack: false,
                  dependenciesGraph: false
               }
            ]
         };
         await fs.writeJSON(configPath, desktopConfig);

         await runWorkflowWithTimeout();
         await testResults();

         await runWorkflowWithTimeout();
         await testResults();

         await clearWorkspace();
      });

      it('builder must build only changed files', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/custompack');
         await prepareTest(fixtureFolder);
         const onlyChangedOutput = `${outputFolder}-only-changed`;
         const intModule1Output = path.join(onlyChangedOutput, 'InterfaceModule1');
         await linkPlatform(sourceFolder);

         const testResults = async(mustExist) => {
            // there should be sources and compiled files in new output only for changed files
            (await fs.pathExists(path.join(intModule1Output, 'library.ts'))).should.equal(mustExist);
            (await fs.pathExists(path.join(intModule1Output, 'library.js'))).should.equal(mustExist);
            (await fs.pathExists(path.join(intModule1Output, 'library.modulepack.js'))).should.equal(mustExist);
            (await fs.pathExists(path.join(intModule1Output, 'library.min.js'))).should.equal(mustExist);
            (await fs.pathExists(path.join(intModule1Output, 'amdModule.css'))).should.equal(mustExist);
            (await fs.pathExists(path.join(intModule1Output, 'amdModule.min.css'))).should.equal(mustExist);
            if (mustExist) {
               const correctLibraryResult = await fs.readFile(path.join(outputFolder, 'InterfaceModule1', 'library.min.js'), 'utf8');
               const currentLibraryResult = await fs.readFile(path.join(intModule1Output, 'library.min.js'), 'utf8');
               currentLibraryResult.should.equal(correctLibraryResult);
               const currentCssResult = await fs.readFile(path.join(intModule1Output, 'amdModule.min.css'), 'utf8');
               currentCssResult.should.equal('.interfaceModule1_amdModule{background-image:url(images/logo-ru.svg)}');
            }

            // all other sources shouldn't be found in new output directory
            (await fs.pathExists(path.join(intModule1Output, 'amdModule.js'))).should.equal(false);
            (await fs.pathExists(path.join(intModule1Output, 'amdModule.min.js'))).should.equal(false);
            (await fs.pathExists(path.join(intModule1Output, 'extend.package.json'))).should.equal(false);
            (await fs.pathExists(path.join(`${intModule1Output}/packages`, 'extendable-bundle.package.json'))).should.equal(false);
            (await fs.pathExists(path.join(`${intModule1Output}/_private`, 'module1.ts'))).should.equal(false);
            (await fs.pathExists(path.join(`${intModule1Output}/_private`, 'module1.js'))).should.equal(false);
            (await fs.pathExists(path.join(`${intModule1Output}/_private`, 'module1.min.js'))).should.equal(false);
            (await fs.pathExists(path.join(`${intModule1Output}/_private`, 'module2.ts'))).should.equal(false);
            (await fs.pathExists(path.join(`${intModule1Output}/_private`, 'module2.js'))).should.equal(false);
            (await fs.pathExists(path.join(`${intModule1Output}/_private`, 'module2.min.js'))).should.equal(false);
         };

         const currentConfig = {
            cache: cacheFolder,
            output: outputFolder,
            typescript: true,
            less: true,
            wml: true,
            builderTests: true,
            minimize: true,
            dependenciesGraph: true,
            distributive: false,
            joinedMeta: true,
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'ExternalInterfaceModule',
                  path: path.join(sourceFolder, 'ExternalInterfaceModule')
               },
               {
                  name: 'InterfaceModule1',
                  path: path.join(sourceFolder, 'InterfaceModule1'),
               }
            ]
         };
         await fs.writeJSON(configPath, currentConfig);

         await runWorkflowWithTimeout();
         const currentCssContent = await fs.readFile(
            path.join(sourceFolder, 'InterfaceModule1', 'amdModule.css'),
            'utf8'
         );
         await fs.outputFile(
            path.join(sourceFolder, 'InterfaceModule1', 'amdModule.css'),
            currentCssContent.replace('logo-en', 'logo-ru')
         );

         const currentTsContent = await fs.readFile(
            path.join(sourceFolder, 'InterfaceModule1', 'library.ts'),
            'utf8'
         );
         await fs.outputFile(
            path.join(sourceFolder, 'InterfaceModule1', 'library.ts'),
            `/* some comment */ \n ${currentTsContent}`
         );

         // add list of changed files for module InterfaceModule1
         currentConfig.modules[2].changedFiles = ['amdModule.css', 'library.ts'];

         // we need to check that only selected files will be built, so we need
         // change output directory and disable gulp_config check so cache
         // won't be removed.
         currentConfig.checkConfig = false;
         currentConfig.output = onlyChangedOutput;
         await fs.writeJSON(configPath, currentConfig);

         await runWorkflowWithTimeout();
         await testResults(true);

         // remove output to rebuild it once again to make sure
         // changed in config but not in sources files won't be rebuild
         // once again
         await fs.remove(onlyChangedOutput);
         await runWorkflowWithTimeout();
         await testResults(false);

         await clearWorkspace();
      });

      it('packed modules must be removed when "sources" flag has "false" value', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/custompack');
         await prepareTest(fixtureFolder);
         await linkPlatform(sourceFolder);
         const testResults = async() => {
            (await isRegularFile(moduleOutputFolder, 'Page.min.wml')).should.equal(false);
            (await isRegularFile(moduleOutputFolder, 'private.min.js')).should.equal(false);
            (await isRegularFile(moduleOutputFolder, 'private.min.original.js')).should.equal(false);
            (await isRegularFile(moduleOutputFolder, 'Stable.min.css')).should.equal(false);
         };

         const desktopConfig = {
            cache: cacheFolder,
            output: outputFolder,
            typescript: true,
            less: true,
            wml: true,
            builderTests: true,
            customPack: true,
            minimize: true,
            sources: false,
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'ExternalInterfaceModule',
                  path: path.join(sourceFolder, 'ExternalInterfaceModule')
               },
               {
                  name: 'InterfaceModule1',
                  path: path.join(sourceFolder, 'InterfaceModule1')
               },
               {
                  name: 'WS.Core',
                  path: path.join(sourceFolder, 'WS.Core')
               },
               {
                  name: 'View',
                  path: path.join(sourceFolder, 'View')
               },
               {
                  name: 'UI',
                  path: path.join(sourceFolder, 'UI')
               },
               {
                  name: 'Compiler',
                  path: path.join(sourceFolder, 'Compiler')
               },
               {
                  name: 'UICore',
                  path: path.join(sourceFolder, 'UICore')
               },
               {
                  name: 'UICommon',
                  path: path.join(sourceFolder, 'UICommon')
               },
               {
                  name: 'Vdom',
                  path: path.join(sourceFolder, 'Vdom')
               },
               {
                  name: 'Router',
                  path: path.join(sourceFolder, 'Router')
               },
               {
                  name: 'Inferno',
                  path: path.join(sourceFolder, 'Inferno')
               },
               {
                  name: 'Types',
                  path: path.join(sourceFolder, 'Types')
               }
            ]
         };
         await fs.writeJSON(configPath, desktopConfig);

         await runWorkflowWithTimeout();
         await testResults();

         await runWorkflowWithTimeout();
         await testResults();

         await clearWorkspace();
      });
   });

   it('pack static html - check paths validity to static packages', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/packHTML');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);

      const testSingleServiceResults = async() => {
         /**
          * dependencies in current test are static, so we can also add check for package hash.
          */
         const packedHtml = await fs.readFile(path.join(outputFolder, 'TestModule/testPage.html'), 'utf8');
         const correctHtmlResult = await fs.readFile(path.join(fixtureFolder, 'correctSingleHtmlResult.html'), 'utf8');
         packedHtml.should.equal(correctHtmlResult);
         const staticCssPackage = await fs.readFile(path.join(outputFolder, 'TestModule/static_packages/640357cdcd290233e6f57f9cbc903632.min.css'), 'utf8');
         staticCssPackage.should.equal('.test-selector{test-var:undefined;test-var:var(--test-var);background:url(../Test/image/test.png)}');

         // in single service there should be static url for cdn
         packedHtml.includes('href="/cdn/EmojiFont/1.0.1/TFEmojiFont.woff2"').should.equal(true);
      };

      const testMultiServiceResults = async() => {
         /**
          * dependencies in current test are static, so we can also add check for package hash.
          */
         const packedHtml = await fs.readFile(path.join(outputFolder, 'TestModule/testPage.html'), 'utf8');
         const correctHtmlResult = await fs.readFile(path.join(fixtureFolder, 'correctMultiHtmlResult.html'), 'utf8');
         packedHtml.should.equal(correctHtmlResult);
         const staticCssPackage = await fs.readFile(path.join(outputFolder, 'TestModule/static_packages/d408360c83221ea67a00d8b16bd8cd4d.min.css'), 'utf8');
         staticCssPackage.should.equal('.test-selector{test-var:undefined;test-var:var(--test-var);background:url(../Test/image/test.png?x_module=%{MODULE_VERSION_STUB=TestModule})}');

         // in multi service there should be placeholder for cdn in url
         packedHtml.includes('href="%{CDN_ROOT}EmojiFont/1.0.1/TFEmojiFont.woff2"').should.equal(true);
      };

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         deprecatedWebPageTemplates: true,
         localization: [
            'ru-RU', 'en-US'
         ],
         'default-localization': 'ru-RU',
         minimize: true,
         less: true,
         deprecatedStaticHtml: true,
         dependenciesGraph: true,
         'url-service-path': '/testService/',
         modules: [
            {
               name: 'TestModule',
               path: path.join(sourceFolder, 'TestModule')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // run task
      await runWorkflowWithTimeout();
      await testSingleServiceResults();

      // check incremental build
      await runWorkflowWithTimeout();
      await testSingleServiceResults();

      // test static packer with multi-service and version-conjunction
      config['multi-service'] = true;
      config.version = 'test-version';

      await fs.writeJSON(configPath, config);

      // run task
      await runWorkflowWithTimeout();
      await testMultiServiceResults();

      // check incremental build
      await runWorkflowWithTimeout();
      await testMultiServiceResults();
      await clearWorkspace();
   });

   it('pack inline scripts - check for current packing of inline scripts into separated javascript files', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/packHTML');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);

      const testResults = async(resourceRoot) => {
         /**
          * dependencies in current test are static, so we can also add check for package hash.
          */
         const packedHtml = await fs.readFile(path.join(outputFolder, 'TestModule/testPage.html'), 'utf8');
         let containsNeededPackage = packedHtml.includes(`<script id="testPage-inlineScript-0" src="${resourceRoot}TestModule/inlineScripts/testPage-0.js"> </script>`);
         containsNeededPackage.should.equal(true);

         /**
          * there is another inline script with empty content, so it should be skipped by packer
          * Example from current test - <script type="text/javascript" id="ws-include-components"></script>
          */
         containsNeededPackage = packedHtml.includes(`<script id="testPage-inlineScript-1" src="${resourceRoot}TestModule/inlineScripts/testPage-1.js"> </script>`);
         containsNeededPackage.should.equal(false);

         // packed javascript content of inline script should be correctly saved to correct file path
         const inlinePackageContent = await fs.readFile(path.join(outputFolder, 'TestModule/inlineScripts/testPage-0.js'), 'utf8');
         const correctInlinePackageContent = await fs.readFile(path.join(fixtureFolder, 'correctInlineScript.js'), 'utf8');
         removeRSymbol(inlinePackageContent).should.equal(removeRSymbol(correctInlinePackageContent));
      };

      const runTestIteration = async(resourceUrl) => {
         // run first iteration of project building with new configuration
         await runWorkflowWithTimeout();
         await testResults(resourceUrl);

         // run second iteration of the building for incremental build checking
         await runWorkflowWithTimeout();
         await testResults(resourceUrl);
      };

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         deprecatedWebPageTemplates: true,
         minimize: true,
         less: true,
         inlineScripts: false,
         'ui-service-path': '/testService/',
         modules: [
            {
               name: 'TestModule',
               path: path.join(sourceFolder, 'TestModule')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await runTestIteration('/testService/resources/');

      config.resourcesUrl = false;
      await fs.writeJSON(configPath, config);

      await runTestIteration('/testService/');

      config.multiService = true;
      await fs.writeJSON(configPath, config);

      await runTestIteration('%{RESOURCE_ROOT}');

      config.resourcesUrl = true;
      await fs.writeJSON(configPath, config);

      await runTestIteration('%{RESOURCE_ROOT}');
      await clearWorkspace();
   });

   // проверим, что паковка собственных зависимостей корректно работает при пересборке
   it('packOwnDeps', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/packOwnDeps');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         typescript: true,
         wml: true,
         minimize: true,
         deprecatedOwnDependencies: true,
         builderTests: true,
         localization: false,
         'default-localization': false,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View')
            },
            {
               name: 'UI',
               path: path.join(sourceFolder, 'UI')
            },
            {
               name: 'Compiler',
               path: path.join(sourceFolder, 'Compiler')
            },
            {
               name: 'UICore',
               path: path.join(sourceFolder, 'UICore')
            },
            {
               name: 'UICommon',
               path: path.join(sourceFolder, 'UICommon')
            },
            {
               name: 'Vdom',
               path: path.join(sourceFolder, 'Vdom')
            },
            {
               name: 'Router',
               path: path.join(sourceFolder, 'Router')
            },
            {
               name: 'Inferno',
               path: path.join(sourceFolder, 'Inferno')
            },
            {
               name: 'Types',
               path: path.join(sourceFolder, 'Types')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await runWorkflowWithTimeout();

      const testJsOutputPath = path.join(moduleOutputFolder, 'Test.min.js');
      let testJsOutputContent = (await fs.readFile(testJsOutputPath)).toString();

      // проверим, что js файл содержит актуальные данные из js, tmpl и wml
      testJsOutputContent.includes('TestClassTmplOld').should.equal(true);
      testJsOutputContent.includes('testFunctionTmplOld').should.equal(true);
      testJsOutputContent.includes('TestClassWmlOld').should.equal(true);
      testJsOutputContent.includes('testFunctionWmlOld').should.equal(true);

      // поменяем js
      const testJsInputPath = path.join(moduleSourceFolder, 'Test.ts');
      const testJsInputContent = await fs.readFile(testJsInputPath);
      const newTestJsInputContent = testJsInputContent.toString()
         .replace(/testFunctionTmplOld/g, 'testFunctionTmplNew')
         .replace(/testFunctionWmlOld/g, 'testFunctionWmlNew');
      await fs.writeFile(testJsInputPath, newTestJsInputContent);

      await runWorkflowWithTimeout();

      // проверим, что js файл содержит актуальные данные из js, tmpl и wml
      testJsOutputContent = (await fs.readFile(testJsOutputPath)).toString();
      testJsOutputContent.includes('TestClassTmplOld').should.equal(true);
      testJsOutputContent.includes('TestClassWmlOld').should.equal(true);
      testJsOutputContent.includes('testFunctionTmplNew').should.equal(true);
      testJsOutputContent.includes('testFunctionWmlNew').should.equal(true);

      // поменяем tmpl
      const testTmplInputPath = path.join(moduleSourceFolder, 'Test.tmpl');
      const testTmplInputContent = await fs.readFile(testTmplInputPath);
      await fs.writeFile(testTmplInputPath, testTmplInputContent.toString().replace(/TestClassTmplOld/g, 'TestClassTmplNew'));

      await runWorkflowWithTimeout();

      // проверим, что js файл содержит актуальные данные из js, tmpl и wml
      testJsOutputContent = (await fs.readFile(testJsOutputPath)).toString();
      testJsOutputContent.includes('TestClassTmplNew').should.equal(true);
      testJsOutputContent.includes('TestClassWmlOld').should.equal(true);
      testJsOutputContent.includes('testFunctionTmplNew').should.equal(true);
      testJsOutputContent.includes('testFunctionWmlNew').should.equal(true);

      // поменяем wml
      const testWmlInputPath = path.join(moduleSourceFolder, 'Test.wml');
      const testWmlInputContent = await fs.readFile(testWmlInputPath);
      await fs.writeFile(testWmlInputPath, testWmlInputContent.toString().replace(/TestClassWmlOld/g, 'TestClassWmlNew'));

      await runWorkflowWithTimeout();

      // проверим, что js файл содержит актуальные данные из js, tmpl и wml
      testJsOutputContent = (await fs.readFile(testJsOutputPath)).toString();
      testJsOutputContent.includes('TestClassTmplNew').should.equal(true);
      testJsOutputContent.includes('TestClassWmlNew').should.equal(true);
      testJsOutputContent.includes('testFunctionTmplNew').should.equal(true);
      testJsOutputContent.includes('testFunctionWmlNew').should.equal(true);
      await clearWorkspace();
   });

   // TODO: дополнить тест проверки реакции на изменение файлов
   it('compile es and ts', async() => {
      const checkFiles = async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members([
            'StableES.js',
            'StableES.min.js',
            'StableTS.js',
            'StableTS.min.js',
            'StableES.es',
            'StableTS.ts',
            'Stable.routes.ts',
            'Stable.routes.js',
            'ReactTest.tsx',
            'ReactTest.js',
            'ReactTest.min.js'
         ]);

         const EsOutputPath = path.join(moduleOutputFolder, 'StableES.js');
         const TsOutputPath = path.join(moduleOutputFolder, 'StableTS.js');
         const TsxDevOutputPath = path.join(moduleOutputFolder, 'ReactTest.js');
         const TsxProdOutputPath = path.join(moduleOutputFolder, 'ReactTest.min.js');
         const RoutesTsOutputPath = path.join(moduleOutputFolder, 'Stable.routes.js');

         const EsContent = await fs.readFile(EsOutputPath);
         const TsContent = await fs.readFile(TsOutputPath);
         const TsxDevContent = await fs.readFile(TsxDevOutputPath);
         const TsxProdContent = await fs.readFile(TsxProdOutputPath);
         const RoutesTsContent = await fs.readFile(RoutesTsOutputPath);

         removeRSymbol(RoutesTsContent.toString()).should.equal(
            '"use strict";\n' +
            'module.exports = function () {\n' +
            '    return {\n' +
            '        \'/Module/Test\': function () { }\n' +
            '    };\n' +
            '};\n'
         );
         removeRSymbol(EsContent.toString()).should.equal(
            'define("Modul/StableES", ["require", "exports", "Modul/Di"], function (require, exports, Di_es_1) {\n' +
               '    "use strict";\n' +
               '    Object.defineProperty(exports, "__esModule", { value: true });\n' +
               '    var Factory = {\n' +
               '        Di: Di_es_1.default\n' +
               '    };\n' +
               '    exports.default = Factory;\n' +
               '});\n'
         );
         removeRSymbol(TsContent.toString()).should.equal(
            'define("Modul/StableTS", [' +
               '"require", ' +
               '"exports", ' +
               '"Modul/Di", ' +
               '"browser!/cdn/sound/id3-reader/id3-minimized.js", ' +
               '"is!browser?/cdn/sound/id3-reader/id3-minimized.js", ' +
               '"is!browser?cdn/sound/id3-reader/id3-minimized.js", ' +
               '"/cdn/sound/id3-reader/id3-minimized.js", ' +
               '"cdn/sound/id3-reader/id3-minimized.js"' +
               '], function (require, exports, Di_es_1) {\n' +
               '    "use strict";\n' +
               '    Object.defineProperty(exports, "__esModule", { value: true });\n' +
               '    var Factory = {\n' +
               '        Di: Di_es_1.default\n' +
               '    };\n' +
               '    exports.default = Factory;\n' +
               '});\n'
         );

         // check if debug version of tsx result has development react-jsx library
         removeRSymbol(TsxDevContent.toString()).should.equal(
            'define("Modul/ReactTest", ["require", "exports", "tslib", "react/jsx-dev-runtime"], function (require, exports, tslib_1, jsx_dev_runtime_1) {\n' +
            '    "use strict";\n' +
            '    Object.defineProperty(exports, "__esModule", { value: true });\n' +
            '    var _jsxFileName = "\\u041C\\u043E\\u0434\\u0443\\u043B\\u044C/ReactTest.tsx";\n' +
            '    function Square(props) {\n' +
            '        return (jsx_dev_runtime_1.jsxDEV("button", tslib_1.__assign({ className: "square", onClick: props.onClick }, { children: props.value }), void 0, false, { fileName: _jsxFileName, lineNumber: 2, columnNumber: 13 }, this));\n' +
            '    }\n' +
            '    exports.default = Square;\n' +
            '});\n'
         );

         // check if release version of tsx result has production react-jsx library
         removeRSymbol(TsxProdContent.toString()).should.equal(
            'define("Modul/ReactTest",["require","exports","tslib","react/jsx-runtime"],function(e,t,u,i){' +
            '"use strict";' +
            'function n(e){return i.jsx("button",u.__assign({className:"square",onClick:e.onClick},{children:e.value}),void 0)}' +
            'Object.defineProperty(t,"__esModule",{value:true}),t.default=n' +
            '});'
         );
      };

      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/esAndTs');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         typescript: true,
         minimize: true,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflowWithTimeout();

      await checkFiles();

      // запустим повторно таску
      await runWorkflowWithTimeout();

      await checkFiles();

      await clearWorkspace();
   });

   it('compile json to ts', async() => {
      const checkFiles = async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members([
            'currentLanguages.json',
            'currentLanguages.json.js',
            'currentLanguages.json.min.js',
            'currentLanguages.min.json'
         ]);

         const jsonJsOutputPath = path.join(moduleOutputFolder, 'currentLanguages.json.js');
         const jsonMinJsOutputPath = path.join(moduleOutputFolder, 'currentLanguages.json.min.js');

         const jsonJsContent = await fs.readFile(jsonJsOutputPath);
         const jsonMinJsContent = await fs.readFile(jsonMinJsOutputPath);
         const correctCompileJsonJs =
            "define('Modul/currentLanguages.json',[]," +
            'function(){return {' +
            '"ru-RU":"Русский (Россия)",' +
            '"uk-UA":"Українська (Україна)",' +
            '"en-US":"English (USA)"' +
            '};' +
            '});';

         jsonJsContent.toString().should.equal(correctCompileJsonJs);
         jsonMinJsContent.toString().should.equal(correctCompileJsonJs);
      };

      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/jsonToJs');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         minimize: true,
         modules: [
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await linkPlatform(sourceFolder);

      // запустим таску
      await runWorkflowWithTimeout();

      await checkFiles();

      // запустим повторно таску
      await runWorkflowWithTimeout();

      await checkFiles();

      await clearWorkspace();
   });

   it('check removal of outdated files', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/esAndTs');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         typescript: true,
         minimize: true,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };

      await fs.writeJSON(configPath, config);

      await linkPlatform(sourceFolder);
      const modulCachePath = path.join(cacheFolder, 'incremental_build/Modul');

      // запустим таску
      await runWorkflowWithTimeout();

      (await isRegularFile(modulCachePath, 'StableTS.ts')).should.be.equal(true);
      (await isRegularFile(path.join(outputFolder, 'Modul'), 'StableTS.ts')).should.be.equal(true);

      await fs.rename(path.join(sourceFolder, 'Модуль/StableTS.ts'), path.join(sourceFolder, 'Модуль/StableTS-new.ts'));

      // запустим таску
      await runWorkflowWithTimeout();

      (await isRegularFile(modulCachePath, 'StableTS.ts')).should.be.equal(false);
      (await isRegularFile(path.join(outputFolder, 'Modul'), 'StableTS.ts')).should.be.equal(false);
      (await isRegularFile(modulCachePath, 'StableTS-new.ts')).should.be.equal(true);
      (await isRegularFile(path.join(outputFolder, 'Modul'), 'StableTS-new.ts')).should.be.equal(true);

      await fs.remove(path.join(sourceFolder, 'Модуль/StableTS-new.ts'));

      await runWorkflowWithTimeout();

      (await isRegularFile(modulCachePath, 'StableTS-new.ts')).should.be.equal(false);
      (await isRegularFile(path.join(outputFolder, 'Modul'), 'StableTS-new.ts')).should.be.equal(false);

      await clearWorkspace();
   });

   describe('pack-library', () => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/_packLibraries');
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         logs: logsFolder,
         typescript: true,
         minimize: true,
         wml: true,
         builderTests: true,
         dependenciesGraph: true,
         modules: [
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View')
            },
            {
               name: 'UI',
               path: path.join(sourceFolder, 'UI')
            },
            {
               name: 'Compiler',
               path: path.join(sourceFolder, 'Compiler')
            },
            {
               name: 'UICore',
               path: path.join(sourceFolder, 'UICore')
            },
            {
               name: 'UICommon',
               path: path.join(sourceFolder, 'UICommon')
            },
            {
               name: 'Some fake name',
               path: path.join(sourceFolder, 'Modul')
            },
            {
               name: 'Modul2',
               path: path.join(sourceFolder, 'Modul2')
            }
         ]
      };

      /**
       * Набор файлов и папок, который должен получиться по завершении workflow
       * при перезапуске без изменений данный набор также должен сохраниться.
       * @type {string[]}
       */
      const correctOutputContentList = [
         'Modul.es',
         'Modul.js',
         'Modul.min.js',
         'Modul.modulepack.js',
         'external_public_deps.ts',
         'external_public_deps.js',
         'external_public_deps.min.js',
         'external_public_deps.modulepack.js',
         '_Cycle_dependence',
         '_External_dependence',
         '_es5',
         '_es6',
         'public',
         'module-dependencies.json',
         'libraryCycle.es',
         'libraryCycle.js',
         'libraryCycle.min.js',
         'privateDepCycle.es',
         'privateDepCycle.js',
         'privateDepCycle.min.js',
         'privateExternalDep.ts',
         'privateExternalDep.js',
         'privateExternalDep.min.js',
         'relativePluginDependency.ts',
         'testNativeNamesImports.ts',
         'testNativeNamesImports.js',
         'testNativeNamesImports.min.js',
         'testNativeNamesImports.modulepack.js',
         'publicFunction1.ts',
         'publicFunction1.js',
         'publicFunction1.min.js'
      ];

      /**
       * Будем хранить правильные исходники для всех тестов паковки
       * библиотек в одном объекте.
       * @type {{}}
       */
      const correctModulesContent = {};
      it('workspace-generated', async() => {
         await prepareTest(fixtureFolder);
         await linkPlatform(sourceFolder);
         await fs.writeJSON(configPath, config);
         await runWorkflowWithTimeout();
         const correctModulesPath = path.join(fixtureFolder, 'compiledCorrectResult');

         await pMap(
            [
               'Modul.js',
               'Modul2.js',
               'Modul.modulepack.js',
               'Module2.js',
               'Module2.modulepack.js',
               'libraryCycle.js',
               'privateDepCycle.js',
               'privateExternalDep.js',
               'testNativeNamesImports.js',
               'testNativeNamesImports.modulepack.js',
               'external_public_deps.js',
               'external_public_deps.modulepack.js'
            ],
            async(basename) => {
               const readedFile = await fs.readFile(path.join(correctModulesPath, basename), 'utf8');
               correctModulesContent[basename] = readedFile
                  .slice(readedFile.indexOf('define('), readedFile.length);
            },
            {
               concurrency: 5
            }
         );
      });
      it('test-output-file-content', async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members(correctOutputContentList);
      });
      it('libraries using relative dependencies with plugins must be ignored', async() => {
         (await isRegularFile(moduleOutputFolder, 'relativePluginDependency.js')).should.equal(false);
         const { messages } = await fs.readJson(path.join(workspaceFolder, 'logs/builder_report.json'));
         const errorMessage = 'relative dependencies with plugin are not valid. ';
         let relativeErrorExists = false;
         messages.forEach((currentError) => {
            if (currentError.message.includes(errorMessage)) {
               relativeErrorExists = true;
            }
         });
         relativeErrorExists.should.equal(true);
      });
      it('test-packed-library-dependencies-in-meta', async() => {
         const moduleDeps = await fs.readJson(path.join(moduleOutputFolder, 'module-dependencies.json'));
         const currentLibraryDeps = moduleDeps.links['Modul/external_public_deps'];
         currentLibraryDeps.should.have.members([
            'Modul/Modul',
            'Modul/public/publicInterface',
            'Modul/publicFunction1'
         ]);
         const currentLibraryPackedModules = moduleDeps.packedLibraries['Modul/external_public_deps'];
         currentLibraryPackedModules.should.have.members(['Modul/_es6/testPublicModule']);
      });
      it('test-first-level-return-statement-removal', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'external_public_deps.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'external_public_deps.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['external_public_deps.js']);
         removeRSymbol(packedCompiledEsContent.toString()).should.equal(correctModulesContent['external_public_deps.modulepack.js']);
      });
      it('test-recurse', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'Modul.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'Modul.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['Modul.js']);
         removeRSymbol(packedCompiledEsContent.toString()).should.equal(correctModulesContent['Modul.modulepack.js']);
      });
      it('test-not-amd-as-external-deps', async() => {
         const module2Output = path.join(outputFolder, 'Modul2');
         const compiledEsOutputPath = path.join(module2Output, 'Module2.js');
         const packedCompiledEsOutputPath = path.join(module2Output, 'Module2.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['Module2.js']);
         removeRSymbol(packedCompiledEsContent.toString()).should.equal(correctModulesContent['Module2.modulepack.js']);
      });
      it('test-native-variable-names-processing', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'testNativeNamesImports.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'testNativeNamesImports.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['testNativeNamesImports.js']);
         removeRSymbol(packedCompiledEsContent.toString()).should.equal(correctModulesContent['testNativeNamesImports.modulepack.js']);
      });
      it('test-recurse-library-dependencies-in-store', async() => {
         const correctStoreDepsForModule = [
            'Modul/_es5/Module.js',
            'Modul/_es6/Модуль.es',
            'Modul/_es6/Модуль2.es'
         ];
         const dependenciesStore = await fs.readJson(path.join(cacheFolder, 'dependencies.json'));
         dependenciesStore['Modul/Модуль.es'].should.have.members(correctStoreDepsForModule);
      });
      it('test-cycle-private-dependency', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'privateDepCycle.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);

         (await isRegularFile(moduleOutputFolder, 'privateDepCycle.modulepack.js')).should.equal(false);
         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['privateDepCycle.js']);
      });
      it('test-cycle-library-dependency', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'libraryCycle.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);

         (await isRegularFile(moduleOutputFolder, 'libraryCycle.modulepack.js')).should.equal(false);
         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['libraryCycle.js']);
      });
      it('test-external-private-dependency', async() => {
         let compiledEsOutputPath = path.join(module2OutputFolder, 'Modul.js');

         let compiledEsContent = await fs.readFile(compiledEsOutputPath);
         (await isRegularFile(module2OutputFolder, 'Modul.modulepack.js')).should.equal(false);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['Modul2.js']);

         compiledEsOutputPath = path.join(moduleOutputFolder, 'privateExternalDep.js');

         compiledEsContent = await fs.readFile(compiledEsOutputPath);
         (await isRegularFile(module2OutputFolder, 'privateExternalDep.modulepack.js')).should.equal(false);
         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['privateExternalDep.js']);
      });
      it('workflow-rebuilded', async() => {
         await runWorkflowWithTimeout();
      });
      it('test-output-file-content-after-rebuild', async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members(correctOutputContentList);
      });
      it('after rebuild - libraries using relative dependencies with plugins must be ignored', async() => {
         (await isRegularFile(moduleOutputFolder, 'relativePluginDependency.js')).should.equal(false);
         const { messages } = await fs.readJson(path.join(workspaceFolder, 'logs/builder_report.json'));
         const errorMessage = 'relative dependencies with plugin are not valid. ';
         let relativeErrorExists = false;
         messages.forEach((currentError) => {
            if (currentError.message.includes(errorMessage)) {
               relativeErrorExists = true;
            }
         });
         relativeErrorExists.should.equal(true);
      });
      it('test-packed-library-dependencies-in-meta-after-rebuild', async() => {
         const moduleDeps = await fs.readJson(path.join(moduleOutputFolder, 'module-dependencies.json'));
         const currentLibraryDeps = moduleDeps.links['Modul/external_public_deps'];
         currentLibraryDeps.should.have.members([
            'Modul/Modul',
            'Modul/public/publicInterface',
            'Modul/publicFunction1'
         ]);
         const currentLibraryPackedModules = moduleDeps.packedLibraries['Modul/external_public_deps'];
         currentLibraryPackedModules.should.have.members(['Modul/_es6/testPublicModule']);
      });
      it('test-first-level-return-statement-removal-after-rebuild', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'external_public_deps.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'external_public_deps.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['external_public_deps.js']);
         removeRSymbol(packedCompiledEsContent.toString()).should.equal(correctModulesContent['external_public_deps.modulepack.js']);
      });
      it('test-recurse-library-dependencies-in-store-after-rebuild', async() => {
         const correctStoreDepsForModule = [
            'Modul/_es5/Module.js',
            'Modul/_es6/Модуль.es',
            'Modul/_es6/Модуль2.es'
         ];
         const dependenciesStore = await fs.readJson(path.join(cacheFolder, 'dependencies.json'));
         dependenciesStore['Modul/Модуль.es'].should.have.members(correctStoreDepsForModule);
      });
      it('test-recurse-after-rerun-workflow', async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members(correctOutputContentList);

         const compiledEsOutputPath = path.join(moduleOutputFolder, 'Modul.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'Modul.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['Modul.js']);
         removeRSymbol(packedCompiledEsContent.toString()).should.equal(correctModulesContent['Modul.modulepack.js']);
      });
      it('test-not-amd-as-external-deps-after-rerun', async() => {
         const module2Output = path.join(outputFolder, 'Modul2');
         const compiledEsOutputPath = path.join(module2Output, 'Module2.js');
         const packedCompiledEsOutputPath = path.join(module2Output, 'Module2.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['Module2.js']);
         removeRSymbol(packedCompiledEsContent.toString()).should.equal(correctModulesContent['Module2.modulepack.js']);
      });
      it('test-native-variable-names-processing-after-rerun', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'testNativeNamesImports.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'testNativeNamesImports.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['testNativeNamesImports.js']);
         removeRSymbol(packedCompiledEsContent.toString()).should.equal(correctModulesContent['testNativeNamesImports.modulepack.js']);
      });
      it('test-cycle-private-dependency-after-rebuild', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'privateDepCycle.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);

         (await isRegularFile(moduleOutputFolder, 'privateDepCycle.modulepack.js')).should.equal(false);
         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['privateDepCycle.js']);
      });
      it('test-cycle-library-dependency-after-rebuild', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'libraryCycle.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);

         (await isRegularFile(moduleOutputFolder, 'libraryCycle.modulepack.js')).should.equal(false);
         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['libraryCycle.js']);
      });
      it('test-external-private-dependency-after-rebuild', async() => {
         let compiledEsOutputPath = path.join(module2OutputFolder, 'Modul.js');

         let compiledEsContent = await fs.readFile(compiledEsOutputPath);
         (await isRegularFile(module2OutputFolder, 'Modul.modulepack.js')).should.equal(false);

         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['Modul2.js']);

         compiledEsOutputPath = path.join(moduleOutputFolder, 'privateExternalDep.js');

         compiledEsContent = await fs.readFile(compiledEsOutputPath);
         (await isRegularFile(module2OutputFolder, 'privateExternalDep.modulepack.js')).should.equal(false);
         removeRSymbol(compiledEsContent.toString()).should.equal(correctModulesContent['privateExternalDep.js']);
      });
      it('workspace-cleared', async() => {
         await clearWorkspace();
      });
   });
});
