'use strict';

const path = require('path');
const fs = require('fs');
const humanize = require('humanize');
const async = require('async');
const logger = require('../lib/logger').logger();
const DoT = global.requirejs('Core/js-template-doT');
const tmplLocalizator = require('../lib/i18n/tmpl-localizator');
const oldToNew = require('sbis3-ws/ws/core/resources/deprecatedModules.json');
const dblSlashes = /\\/g;
const extFile = /(\.tmpl|\.x?html)$/;
const runJsonGenerator = require('../lib/i18n/run-json-generator');
const helpers = require('../lib/helpers');
const WSCoreReg = /(^ws\/)(deprecated)?/;
const requirejsPaths = global.requirejs.s.contexts._.config.paths;

function getModulenamesForPaths(mDeps, templateMask) {
   const namesForPaths = {};
   Object.keys(mDeps.nodes).forEach(function(node) {
      if (node.includes(templateMask)) {
         let path = helpers.prettifyPath(mDeps.nodes[node].path);
         if (!namesForPaths[path]) {
            namesForPaths[path] = [];
         }
         namesForPaths[path].push(node);
      }
   });
   return namesForPaths;
}

function removeLastSymbolIfSlash(path) {
   const lastSymbol = path[path.length - 1];

   if (lastSymbol === '/' || lastSymbol === '\\') {
      return path.slice(0, path.length - 1);
   }
   return path;
}

function checkPathForInterfaceModule(currentPath, application) {
   let resultPath = '', resultNode = '';
   //Учитываем возможность наличия application
   currentPath = helpers.removeLeadingSlash(helpers.prettifyPath(path.join(application, currentPath)));
   Object.keys(requirejsPaths).forEach(function(node) {
      const nodePath = helpers.prettifyPath(requirejsPaths[node]);
      if (currentPath.indexOf(nodePath) === 0 && nodePath.length > resultPath.length) {
         resultPath = nodePath;
         resultNode = node;
      }
   });
   return resultPath ? currentPath.replace(resultPath, resultNode) : currentPath;
}

function errorTmplBuild(err, currentNode, fullPath) {
   logger.error({
      message: `Resources error. An ERROR occurred while building template ${currentNode}!`,
      filePath: fullPath,
      error: err
   });
}

function stripBOM(x) {
   if (x.charCodeAt(0) === 0xFEFF) {
      return x.slice(1);
   }

   return x;
}

/**
 * Создаёт шаблон в зависимости от типа шаблона (tmpl, xhtml, html)
 * @param {String} nameModule - имя шаблона
 * @param {String} contents - конент для вствки в тело define
 * @param {String} original - оригинальный файл
 * @param {Object} nodes - список всех узлов из module-dependencies.json
 * @param {String} applicationRoot - путь до сревиса
 * @param {Function} callback - функция коллбэк
 * @param {Object} deps - список зависмостей для вставки в зависимости define
 */
function createTemplate(templateOptions, namesForCurrentTemplate, nodes, applicationRoot, splittedCore, callback) {
   const
      fullPath = templateOptions.fullPath,
      contents = templateOptions.contents,
      original = templateOptions.original,
      deps = templateOptions.deps;

   let
      nameModule = templateOptions.currentNode,
      nameNotPlugin = nameModule.substr(nameModule.lastIndexOf('!') + 1),
      plugin = nameModule.substr(0, nameModule.lastIndexOf('!') + 1),
      needPushJs = false,
      data,
      jsPath,
      jsModule,
      secondName;


   //TODO на время переходного периода при отказе от contents.json
   /* При компиляции из xhtml в js у нас билдяться со старыми именами и в результате по новому имени
    шаблон уже не доступен. Поэтому здесь проверяем, чтобы старые имена не были заюзаны. Для этого
    создали список модулей которые подверглись переименованию и проверяем есть ли данный шаблон в списке.
    https://online.sbis.ru/opendoc.html?guid=f11afc8b-d8d2-462f-a836-a3172c7839a3
    */
   for (const name in oldToNew) {
      if (oldToNew.hasOwnProperty(name)) {
         if (name === nameNotPlugin && oldToNew[name] !== nameNotPlugin) {
            secondName = nameModule;
            nameNotPlugin = oldToNew[name];
            nameModule = plugin + oldToNew[name];
            break;
         }
         if (oldToNew[name] === nameNotPlugin && nameNotPlugin !== name) {
            secondName = plugin + name;
            break;
         }
      }
   }

   if (nodes.hasOwnProperty(nameNotPlugin)) {
      needPushJs = true;
      jsPath = path.join(applicationRoot, nodes[nameNotPlugin].path).replace(dblSlashes, '/');
      jsModule = fs.readFileSync(jsPath);
   }

   if (plugin.indexOf('html!') > -1) {
      data = `define("${nameModule}",function(){var f=${contents};f.toJSON=function(){return {$serialized$:"func", module:"${nameModule}"}};return f;});`;
   } else if (plugin.indexOf('tmpl!') > -1) {
      data = `define("${nameModule}",${JSON.stringify(deps)},function(){var deps=Array.prototype.slice.call(arguments);${contents}});`;
   }

   if (namesForCurrentTemplate && namesForCurrentTemplate.length > 1) {
      let firstName = namesForCurrentTemplate.shift();
      namesForCurrentTemplate.forEach(function(moduleName) {
         data += `\ndefine("${moduleName}",["${firstName}"],function(template){return template;});`;
      });
   }

   if (secondName) {
      data += `\ndefine("${secondName}",["${nameModule}"],function(module){return module;});`;
   }


   //TODO костыль на время переходного периода при отказе от contents.json
   /*
    В резудьтате отказа от плагина js! и переименования модулей возникла гонка,
    require дефайнит и модуль, и шаблон под одним именем, но так как в шаблоне нет js модуля он
    считает, что модуля по данному имени нет. Временным решением принято дефайнить js в шаблоне,
    чтобы если первым прелетит шаблон, модуль был найден.
    https://online.sbis.ru/opendoc.html?guid=bcedfcf8-494d-451e-92f9-d9144e11ecac
    */
   if (needPushJs) {
      data += jsModule;
   }

   /**
    * Позорный костыль для обратной поддержки препроцессора
    */
   if (splittedCore) {
      fs.writeFile(fullPath.replace(extFile, '.min$1'), data, function(err) {
         if (!err && nodes.hasOwnProperty(nameModule)) {
            nodes[nameModule].amd = true;
            nodes[nameModule].path = nodes[nameModule].path.replace(extFile, '.min$1');
            if (nodes[secondName]) {
               try {
                  nodes[secondName].amd = true;
                  nodes[secondName].path = nodes[secondName].path.replace(extFile, '.min$1');
               } catch (e) {
                  console.dir(e.stack);
               }
            }
            //Если имеются дополнительные дефайны для шаблонов, меняем пути и для них
            if (namesForCurrentTemplate && namesForCurrentTemplate[0] !== nameModule) {
               namesForCurrentTemplate.forEach(function(moduleName) {
                  nodes[moduleName].amd = true;
                  nodes[moduleName].path = nodes[moduleName].path.replace(extFile, '.min$1');
               });
            }
         }
         setImmediate(callback.bind(null, err, nameModule, fullPath));
      });
   } else {
      fs.writeFile(fullPath.replace(extFile, '.original$1'), original, function() {
         fs.writeFile(fullPath, data, function(err) {
            if (!err && nodes.hasOwnProperty(nameModule)) {
               nodes[nameModule].amd = true;
               if (nodes[secondName]) {
                  nodes[secondName].amd = true;
               }
            }
            setImmediate(callback.bind(null, err, nameModule, fullPath));
         });
      });
   }
}

module.exports = function(grunt) {
   const splittedCore = grunt.option('splitted-core');

   if (splittedCore) {
      Object.keys(requirejsPaths).forEach(function(path) {
         const result = requirejsPaths[path].match(WSCoreReg);
         if (result && result[2]) {
            requirejsPaths[path] = removeLastSymbolIfSlash(requirejsPaths[path].replace(WSCoreReg, 'resources/WS.Deprecated/'));
         }
         requirejsPaths[path] = removeLastSymbolIfSlash(requirejsPaths[path].replace(WSCoreReg, 'resources/WS.Core/'));
      });
   }

   grunt.registerMultiTask('tmpl-build', 'Generate static html from modules', async function() {
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача tmpl-build.`);
      const start = Date.now();
      const
         self = this,
         done = self.async(),
         root = self.data.root,
         application = self.data.application,
         applicationRoot = path.join(root, application),
         mDeps = JSON.parse(fs.readFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'))),
         nodes = mDeps.nodes,
         namesForPaths = getModulenamesForPaths(mDeps, 'tmpl!');

      let componentsProperties = {};

      //запускаем только при наличии задач локализации
      if (grunt.option('prepare-xhtml' || grunt.option('make-dict') || grunt.option('index-dict'))) {
         const optModules = grunt.option('modules').replace(/"/g, '');
         const optJsonCache = grunt.option('json-cache').replace(/"/g, '');
         const folders = await fs.readJSON(optModules);
         const resultJsonGenerator = await runJsonGenerator(folders, optJsonCache);
         for (const error of resultJsonGenerator.errors) {
            logger.warning({
               message: 'Ошибка при разборе JSDoc комментариев',
               filePath: error.filePath,
               error: error.error
            });
         }
         componentsProperties = resultJsonGenerator.index;
      }

      const deps = ['View/Builder/Tmpl', 'View/config'];

      global.requirejs(deps.concat(['optional!View/Runner/tclosure']), function(tmpl, config, tclosure) {
         let tclosureStr = '';
         if (tclosure) {
            deps.push('View/Runner/tclosure');
            tclosureStr = 'var tclosure=deps[0];';
         }

         async.eachOfLimit(self.files, 20, function(value, index, callback) {
            let
               fullPath = helpers.prettifyPath(value.dest),
               filename = helpers.removeLeadingSlash(fullPath.replace(helpers.prettifyPath(applicationRoot), '')),
               _deps = JSON.parse(JSON.stringify(deps)),
               result = ['var templateFunction = '],
               currentNode = namesForPaths[filename] ? namesForPaths[filename][0] : null;

            /**
             * Если имени узла для шаблона в module-dependencies не определено, генерим его автоматически
             * с учётом путей до интерфейсных модулей, заданных в path в конфигурации для requirejs
             */
            if (!currentNode) {
               currentNode = `tmpl!${checkPathForInterfaceModule(filename, application).replace(/(\.min)?\.tmpl$/g, '')}`;
            }

            const conf = {config: config, filename: filename, fromBuilderTmpl: true};
            fs.readFile(fullPath, 'utf8', function(err, html) {
               if (err) {
                  logger.warning({
                     message: 'Potential 404 error. An ERROR occurred while building template',
                     filePath: fullPath,
                     error: err
                  });
                  return setImmediate(callback);
               }
               if (splittedCore) {
                  /**
                   * пишем сразу оригинал в .min файл. В случае успешной генерации .min будет перебит сгенеренным шаблоном. В случае
                   * ошибки мы на клиенте не будем получать 404х ошибок на плохие шаблоны, а разрабам сразу прилетит в консоль ошибка,
                   * когда шаблон будет генерироваться находу, как в дебаге.
                   */
                  fs.writeFileSync(fullPath.replace(extFile, '.min$1'), html);
               }
               const templateRender = Object.create(tmpl);

               const original = html;
               html = stripBOM(html);

               if (html.indexOf('define') === 0) {
                  return setImmediate(callback);
               }

               try {
                  templateRender.getComponents(html).forEach(function(dep) {
                     _deps.push(dep);
                  });

                  tmplLocalizator.parseTmpl(html, filename, componentsProperties)
                     .then(function(traversedObj) {
                        const traversed = traversedObj.astResult;
                        try {
                           if (traversed.__newVersion === true) {
                              /**
                               * Новая версия рендера, для шаблонизатора. В результате функция в строке.
                               */
                              const tmplFunc = templateRender.func(traversed, conf);
                              result.push(tmplFunc.toString() + ';');

                              if (tmplFunc.includedFunctions) {
                                 result.push('templateFunction.includedFunctions = {');
                                 result.push('};');
                              }
                           } else {
                              result.push('function loadTemplateData(data, attributes) {');
                              result.push('return tmpl.html(' + JSON.stringify(traversed) + ', data, {config: config, filename: "' + currentNode + '"}, attributes);};');
                           }

                           result.push('templateFunction.stable = true;');
                           result.push('templateFunction.toJSON = function() {return {$serialized$: "func", module: "' + currentNode + '"}};');
                           result.push('return templateFunction;');

                           _deps.splice(0, 2);
                           let
                              depsStr = 'var _deps = {};',
                              i = tclosure ? 1 : 0;
                           for (; i < _deps.length; i++) {
                              depsStr += '_deps["' + _deps[i] + '"] = deps[' + i + '];';
                           }

                           const contents = tclosureStr + depsStr + result.join('');

                           const templateOptions = {
                              fullPath: fullPath,
                              currentNode: currentNode,
                              contents: contents,
                              original: original,
                              deps: _deps
                           };
                           createTemplate(templateOptions, namesForPaths[filename], nodes, applicationRoot, splittedCore, callback);

                        } catch (error) {
                           logger.warning({
                              message: 'An ERROR occurred while building template',
                              filePath: fullPath,
                              error: error
                           });
                           setImmediate(callback);
                        }
                     }, function(error) {
                        logger.warning({
                           message: 'An ERROR occurred while building template',
                           filePath: fullPath,
                           error: error
                        });
                        setImmediate(callback);
                     });
               } catch (error) {
                  errorTmplBuild(error, currentNode, fullPath);
                  setImmediate(callback);
               }
            });
         }, function(err, currentNode, fullPath) {
            if (err) {
               errorTmplBuild(err, currentNode, fullPath);
            }

            try {
               mDeps.nodes = nodes;
               grunt.file.write(path.join(applicationRoot, 'resources', 'module-dependencies.json'), JSON.stringify(mDeps, null, 2));
            } catch (error) {
               logger.error({error: error});
               grunt.fail.fatal(error);
            }

            logger.debug(`Duration: ${(Date.now() - start) / 1000} sec`);
            done();
         });
      });
   });

   grunt.registerMultiTask('xhtml-build', 'Generate static html from modules', function() {
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача xhtml-build.`);
      const start = Date.now();
      const
         self = this,
         done = self.async(),
         root = self.data.root,
         application = self.data.application,
         applicationRoot = path.join(root, application),
         mDeps = JSON.parse(fs.readFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'))),
         nodes = mDeps.nodes,
         namesForPaths = getModulenamesForPaths(mDeps, 'html!');

      async.eachOfLimit(self.files, 2, function(value, index, callback) {
         let
            fullPath = helpers.prettifyPath(value.dest),
            filename = helpers.removeLeadingSlash(fullPath.replace(helpers.prettifyPath(applicationRoot), '')),
            currentNode = namesForPaths[filename] ? namesForPaths[filename][0] : null;

         /**
          * Если имени узла для шаблона в module-dependencies не определено, генерим его автоматически
          * с учётом путей до интерфейсных модулей, заданных в path в конфигурации для requirejs
          */
         if (!currentNode) {
            currentNode = `html!${checkPathForInterfaceModule(filename, application).replace(/(\.min)?\.xhtml$/g, '')}`;
         }

         fs.readFile(fullPath, 'utf8', function(err, html) {
            if (err) {
               logger.warning({
                  message: 'Potential 404 error. An ERROR occurred while building template',
                  filePath: fullPath,
                  error: err
               });
               return setImmediate(callback);
            }
            if (splittedCore) {
               /**
                * пишем сразу оригинал в .min файл. В случае успешной генерации .min будет перебит сгенеренным шаблоном. В случае
                * ошибки мы на клиенте не будем получать 404х ошибок на плохие шаблоны, а разрабам сразу прилетит в консоль ошибка,
                * когда шаблон будет генерироваться находу, как в дебаге.
                */
               fs.writeFileSync(fullPath.replace(extFile, '.min$1'), html);
            }
            const original = html;
            html = stripBOM(html);

            if (html.indexOf('define') === 0) {
               return setImmediate(callback);
            }

            try {
               let config, template;

               config = DoT.getSettings();

               if (module.encode) {
                  config.encode = config.interpolate;
               }

               template = DoT.template(html, config);

               const contents = template.toString().replace(/[\n\r]/g, '');

               const templateOptions = {
                  fullPath: fullPath,
                  currentNode: currentNode,
                  contents: contents,
                  original: original
               };
               createTemplate(templateOptions, namesForPaths[filename], nodes, applicationRoot, splittedCore, callback);

            } catch (error) {
               logger.warning({
                  message: 'An ERROR occurred while building template',
                  filePath: fullPath,
                  error: error
               });
               setImmediate(callback);
            }
         });
      }, function(err, currentNode, fullPath) {
         if (err) {
            errorTmplBuild(err, currentNode, fullPath);
         }

         try {
            mDeps.nodes = nodes;
            grunt.file.write(path.join(applicationRoot, 'resources', 'module-dependencies.json'), JSON.stringify(mDeps, null, 2));
         } catch (error) {
            grunt.fail.fatal(error);
         }

         logger.debug(`Duration: ${(Date.now() - start) / 1000} sec`);

         done();
      });
   });
};
