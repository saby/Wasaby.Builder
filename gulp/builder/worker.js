'use strict';

// логгер - прежде всего
require('../../lib/logger').setGulpLogger();

// ws должен быть вызван раньше чем первый global.requirejs
require('../helpers/node-ws').init();

const fs = require('fs-extra'),
   workerPool = require('workerpool'),
   helpers = require('../../lib/helpers'),
   buildLess = require('../../lib/build-less'),
   processingTmpl = require('../../lib/processing-tmpl'),
   parseJsComponent = require('../../lib/parse-js-component'),
   processingRoutes = require('../../lib/processing-routes'),
   prepareXHTMLPrimitive = require('../../lib/i18n/prepare-xhtml'),
   buildXhtml = require('../../lib/processing-xhtml').buildXhtml,
   runMinifyCss = require('../../lib/run-minify-css'),
   runMinifyXhtmlAndHtml = require('../../lib/run-minify-xhtml-and-html'),
   uglifyJs = require('../../lib/run-uglify-js');

let componentsProperties;

process.on('unhandledRejection', (reason, p) => {
   // eslint-disable-next-line no-console
   console.log(
      "[00:00:00] [ERROR] Критическая ошибка в работе worker'а. ",
      'Unhandled Rejection at:\n',
      p,
      '\nreason:\n',
      reason
   );
   process.exit(1);
});

async function readComponentsProperties(componentsPropertiesFilePath) {
   if (!componentsProperties) {
      if (await fs.pathExists(componentsPropertiesFilePath)) {
         componentsProperties = await fs.readJSON(componentsPropertiesFilePath);
      } else {
         componentsProperties = {};
      }
   }
   return componentsProperties;
}

async function buildTmpl(text, relativeFilePath, componentsPropertiesFilePath) {
   return processingTmpl.buildTmpl(
      text,
      relativeFilePath,
      await readComponentsProperties(componentsPropertiesFilePath)
   );
}

async function buildHtmlTmpl(text, fullPath, relativeFilePath, componentsPropertiesFilePath) {
   return processingTmpl.buildHtmlTmpl(
      text,
      fullPath,
      relativeFilePath,
      await readComponentsProperties(componentsPropertiesFilePath)
   );
}

async function prepareXHTML(text, componentsPropertiesFilePath) {
   return prepareXHTMLPrimitive(text, await readComponentsProperties(componentsPropertiesFilePath));
}

workerPool.worker({
   parseJsComponent,
   parseRoutes: processingRoutes.parseRoutes,
   buildLess,
   buildTmpl,
   buildHtmlTmpl,
   prepareXHTML,
   buildXhtml,
   minifyCss: runMinifyCss,
   minifyXhtmlAndHtml: runMinifyXhtmlAndHtml,
   uglifyJs,
   gzip: helpers.gzip
});
