/* eslint-disable id-match */
'use strict';

const initTest = require('./init-test');

const path = require('path'),
   root = __dirname,
   application = 'fixture/custompack',
   applicationRoot = path.join(root, application),
   fs = require('fs-extra'),
   packHelpers = require('../lib/pack/helpers/custompack'),
   customPacker = require('../lib/pack/custom-packer'),
   { rebaseCSS } = require('../lib/pack/custom-packer'),
   DependencyGraph = require('../packer/lib/dependency-graph'),
   pMap = require('p-map'),
   builderConstants = require('../lib/builder-constants');

const removeAllNewLines = function(str) {
   return str.replace(/\n|\r/g, '');
};

describe('custompack', () => {
   let moduleDeps, currentNodes, currentLinks, depsTree;
   const customPackParameters = {
      versionedModules: {},
      cdnModules: {},
      compiledLessByModules: {
         '': ['InterfaceModule1/moduleStyle.min.css']
      },
      config: {
         localizations: [],
         sources: true,
         resourcesUrl: true
      }
   };
   before(async() => {
      moduleDeps = await fs.readJson(path.join(applicationRoot, 'module-dependencies.json'));
      currentNodes = Object.keys(moduleDeps.nodes);
      currentLinks = Object.keys(moduleDeps.links);
      depsTree = new DependencyGraph();
      if (currentLinks.length > 0) {
         currentLinks.forEach((link) => {
            depsTree.setLink(link, moduleDeps.links[link]);
         });
      }
      if (currentNodes.length > 0) {
         currentNodes.forEach((node) => {
            const currentNode = moduleDeps.nodes[node];
            currentNode.path = currentNode.path.replace(/^resources\//, '');
            depsTree.setNode(node, currentNode);
         });
      }
      await initTest();
   });

   it('should reject error if include option not exists', async() => {
      let result;
      try {
         const config = await fs.readJson(path.join(applicationRoot, 'configs/without-include.package.json'));
         const configsArray = packHelpers.getConfigsFromPackageJson(
            path.normalize('configs/without-include.package.json'),
            config
         );
         const currentResult = await customPacker.generateCustomPackage(
            depsTree,
            root,
            application,
            configsArray[0],
            customPackParameters
         );
         result = currentResult;
      } catch (err) {
         result = err;
      }

      (result instanceof Error).should.equal(true);
      result.message.should.equal(
         'Конфиг для кастомного пакета должен содержать опцию include для нового вида паковки.'
      );
   });

   it('versioned meta: should return correct css package path without theme', () => {
      const packagePath = '/test/Controls/controls-application.package.min';
      const themeName = '';

      const result = packHelpers.getCssPackagePathForMeta(themeName, packagePath);

      result.should.equal('/test/Controls/controls-application.package.min.css');
   });
   it('versioned meta: should return correct css package path with theme', () => {
      const packagePath = '/test/Controls/controls-application.package.min';
      const themeName = 'myTheme';

      const result = packHelpers.getCssPackagePathForMeta(themeName, packagePath);

      result.should.equal('/test/Controls/controls-application_myTheme.package.min.css');
   });
   it('versioned meta: should return correct css moduled-package path without theme', () => {
      const packagePath = '/test/Employee/Card/EmployeeCard.min';
      const themeName = '';

      const result = packHelpers.getCssPackagePathForMeta(themeName, packagePath);

      result.should.equal('/test/Employee/Card/EmployeeCard.min.css');
   });
   it('versioned meta: should return correct css moduled-package path with theme', () => {
      const packagePath = '/test/Employee/Card/EmployeeCard.min';
      const themeName = 'myTheme';

      const result = packHelpers.getCssPackagePathForMeta(themeName, packagePath);

      result.should.equal('/test/Employee/Card/EmployeeCard_myTheme.min.css');
   });
   it('should reject error when no data to pack', async() => {
      let result;
      try {
         const config = await fs.readJson(path.join(applicationRoot, 'configs/without-data.package.json'));
         const configsArray = packHelpers.getConfigsFromPackageJson(
            path.normalize('configs/without-data.package.json'),
            config
         );
         const currentResult = await customPacker.generateCustomPackage(
            depsTree,
            root,
            application,
            configsArray[0],
            customPackParameters
         );
         result = currentResult;
      } catch (err) {
         result = err;
      }

      (result instanceof Error).should.equal(true);
      result.message.should.equal(
         'В ваш пакет ничего не запаковалось, проверьте правильность описания правил паковки в package.json файле'
      );
   });
   it('should save js and css packages when only styles included', async() => {
      let result;
      try {
         const config = await fs.readJson(path.join(applicationRoot, 'configs/only-styles.package.json'));
         const configsArray = packHelpers.getConfigsFromPackageJson(
            path.normalize('configs/only-styles.package.json'),
            config
         );
         const currentResult = await customPacker.generateCustomPackage(
            depsTree,
            root,
            application,
            configsArray[0],
            customPackParameters
         );
         result = currentResult;
      } catch (err) {
         result = err;
      }

      (result instanceof Error).should.equal(false);
      const resultsToRead = [
         path.join(applicationRoot, 'configs/only-styles.package.min.css'),
         path.join(applicationRoot, 'configs/only-styles.package.min.js')
      ];
      const cssPackageResult = await fs.readFile(resultsToRead[0], 'utf8');
      const jsPackageResult = await fs.readFile(resultsToRead[1], 'utf8');
      const correctCssPackageResult = await fs.readFile(path.join(applicationRoot, 'packcss/correct-only-styles.package.min.css'), 'utf8');
      cssPackageResult.should.equal(correctCssPackageResult);
      jsPackageResult.should.equal('(function(){define(\'css!InterfaceModule1/moduleStyle\',[\'css!configs/only-styles.package\'],\'\');})();');
      resultsToRead.forEach(async(currentPath) => {
         await fs.remove(currentPath);
      });
   });
   const testCssPath = path.join(applicationRoot, 'packcss/testRebaseURL.css');
   it('rebaseUrl correct path without url-service-path', async() => {
      const urlServicePath = '/';
      const resultCSS = await rebaseCSS(
         testCssPath,
         applicationRoot,
         urlServicePath
      );
      removeAllNewLines(resultCSS).should.equal(
         '.online-Sidebar_logoDefault{background-image:url(/resources/packcss/images/logo-en.svg)}'
      );
   });
   it('rebaseUrl correct path with url-service-path', async() => {
      const urlServicePath = '/someTestPath/';
      const resultCSS = await rebaseCSS(
         testCssPath,
         applicationRoot,
         urlServicePath
      );
      removeAllNewLines(resultCSS).should.equal(
         '.online-Sidebar_logoDefault{background-image:url(/someTestPath/resources/packcss/images/logo-en.svg)}'
      );
   });

   it(`should include css-modules in bundle even if they excluded 
   by exclude section in case when they have the same name with js-module`, async() => {
      let result;
      try {
         const config = await fs.readJson(path.join(applicationRoot, 'configs/exclude-css.package.json'));
         const configsArray = packHelpers.getConfigsFromPackageJson(
            path.normalize('configs/exclude-css.package.json'),
            config
         );
         const currentResult = await customPacker.generateCustomPackage(
            depsTree,
            root,
            application,
            configsArray[0],
            customPackParameters
         );
         result = currentResult;
      } catch (err) {
         result = err;
      }

      (result instanceof Error).should.equal(false);
      const resultToRead = path.join(applicationRoot, 'configs/exclude-css.package.min.js');

      const jsPackageResult = await fs.readFile(resultToRead, 'utf8');

      const includeJs = jsPackageResult.includes('define(\'css!InterfaceModule3/amdModule\'');
      const includeCss = jsPackageResult.includes('define(\'InterfaceModule3/amdModule\'');

      (includeJs && includeCss).should.equal(true);

      const resultBundles = result.bundles['resources/configs/exclude-css.package.min'];
      const includesCssInbBundles = resultBundles.includes('css!InterfaceModule3/amdModule');
      let includesCssInbBundlesRoute = false;

      for (const module in result.bundlesRoute) {
         if (module === 'css!InterfaceModule3/amdModule') {
            includesCssInbBundlesRoute = true;
            break;
         }
      }

      (includesCssInbBundles && !includesCssInbBundlesRoute).should.equal(true);

      await fs.remove(resultToRead);
   });
});

async function removeResultFiles() {
   const configsPath = path.join(applicationRoot, 'configs');
   const pathsToRemove = [...(await fs.readdir(configsPath)).map(fileName => path.join('configs', fileName))];
   pathsToRemove.push(`InterfaceModule1${builderConstants.metaFolder}customPackIntersects.json`);
   pathsToRemove.push(`InterfaceModule2${builderConstants.metaFolder}customPackIntersects.json`);

   /**
    * Удаляем записанные тестом файлы(если были записаны)
    */
   await pMap(
      pathsToRemove,
      async(fileName) => {
         if (!fileName.endsWith('.package.json')) {
            await fs.remove(path.join(applicationRoot, fileName));
         }
      },
      {
         concurrency: 10
      }
   );
}

describe('custompack-intersects', () => {
   let moduleDeps, currentNodes, currentLinks, depsTree;

   before(async() => {
      moduleDeps = await fs.readJson(path.join(applicationRoot, 'module-dependencies.json'));
      currentNodes = Object.keys(moduleDeps.nodes);
      currentLinks = Object.keys(moduleDeps.links);
      depsTree = new DependencyGraph();
      if (currentLinks.length > 0) {
         currentLinks.forEach((link) => {
            depsTree.setLink(link, moduleDeps.links[link]);
         });
      }
      if (currentNodes.length > 0) {
         currentNodes.forEach((node) => {
            const currentNode = moduleDeps.nodes[node];
            currentNode.path = currentNode.path.replace(/^resources\//, '');
            depsTree.setNode(node, currentNode);
         });
      }

      await removeResultFiles();
      await initTest();
   });

   it('intersects-should-be-founded-and-splitted-by-interface-modules', async() => {
      const
         configs = await fs.readJson(path.join(applicationRoot, 'configs/intersects.package.json')),
         taskParams = {
            versionedModules: {},
            cdnModules: {},
            config: {
               defaultLocalization: '',
               localizations: [],
               sources: true,
               resourcesUrl: true
            }
         },
         results = {
            bundles: {},
            bundlesRoute: {},
            excludedCSS: {}
         };

      await customPacker.generateAllCustomPackages(
         {
            commonBundles: configs
         },

         // taskParameters, тут не нужны, это для локализации
         taskParams,
         depsTree,
         results,
         applicationRoot
      );

      await customPacker.collectAllIntersects(applicationRoot, results);

      /**
       * Проверка на существование помодульных результатов пересечений между кастомными пакетами
       */
      const
         firstModuleIntersectsOutput = path.join(applicationRoot, `InterfaceModule1${builderConstants.metaFolder}customPackIntersects.json`),
         secondModuleIntersectsOutput = path.join(applicationRoot, `InterfaceModule2${builderConstants.metaFolder}customPackIntersects.json`);

      (await fs.pathExists(firstModuleIntersectsOutput)).should.equal(true);
      (await fs.pathExists(secondModuleIntersectsOutput)).should.equal(true);

      const
         firstModuleIntersects = await fs.readFile(firstModuleIntersectsOutput, 'utf8'),
         secondModuleIntersects = await fs.readFile(secondModuleIntersectsOutput, 'utf8'),
         correctFirstModuleIntersects = await fs.readFile(
            path.join(path.dirname(firstModuleIntersectsOutput), 'correctCustomPackIntersects.json'),
            'utf8'
         ),
         correctSecondModuleIntersects = await fs.readFile(
            path.join(path.dirname(secondModuleIntersectsOutput), 'correctCustomPackIntersects.json'),
            'utf8'
         );
      removeAllNewLines(firstModuleIntersects).should.equal(removeAllNewLines(correctFirstModuleIntersects));
      removeAllNewLines(secondModuleIntersects).should.equal(removeAllNewLines(correctSecondModuleIntersects));
      await removeResultFiles();
   });
});
