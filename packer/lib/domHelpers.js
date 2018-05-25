'use script';
const crypto = require('crypto');
const xmldom = require('tensor-xmldom');
const fs = require('fs-extra');
const path = require('path');
const parser = new xmldom.DOMParser();
const serializer = new xmldom.XMLSerializer();
const logger = require('../../lib/logger').logger();

function wrap(obj, prop, replacer) {
   (function(orig) {
      obj[prop] = replacer;
      obj[prop].restore = function() {
         obj[prop] = orig;
      };
   })(obj[prop]);
}

function uniqname(names, ext) {
   const md5 = crypto.createHash('md5');
   md5.update(names + '');
   return md5.digest('hex') + '.' + ext;
}

function domify(text) {
   const errors = [];
   wrap(console, 'log', function(m) {
      errors.push(m);
   });
   wrap(console, 'error', function(m) {
      errors.push(m);
   });
   const result = parser.parseFromString(text, 'text/html');

   //eslint-disable-next-line no-console
   console.log.restore();

   //eslint-disable-next-line no-console
   console.error.restore();

   return result;
}

function stringify(dom) {
   return serializer.serializeToString(dom);
}

function mkDomNode(document, node, attributes) {
   const newNode = document.createElement(node);
   Object.keys(attributes || {}).forEach(function(attrName) {
      newNode.setAttribute(attrName, attributes[attrName]);
   });
   if (node === 'script') {
      newNode.textContent = ' ';
   }
   return newNode;
}

function mkCommentNode(document, data) {
   return document.createComment(data);
}

function removeDomCollection(col, filter) {
   const deadlist = [];
   for (var i = 0, l = col.length; i < l; i++) {
      if (!filter || filter(col[i])) {
         deadlist.push(col[i]);
      }
   }
   for (i = 0, l = deadlist.length; i < l; i++) {
      deadlist[i].parentNode.removeChild(deadlist[i]);
   }
}

function checkFiles(root, sourceFile, result) {
   let isSane = true, errors = [];
   result.files.forEach(function(packItem, i) {
      const fullPath = path.join(root, packItem);
      if (!fs.existsSync(fullPath)) {
         let l = result.nodes[i].lineNumber,
            c = result.nodes[i].columnNumber;
         errors.push('line ' + l + ' col ' + c + ': file not found' + ' ' + packItem);
         isSane = false;
      }
   });
   if (!isSane) {
      logger.warning('Warning: ' + path.relative(root, sourceFile) + ' skipped');
      logger.warning(errors.join('\n'));
   }
   return isSane;
}

const helpers = {
   uniqname: uniqname,
   domify: domify,
   stringify: stringify,
   mkDomNode: mkDomNode,
   mkCommentNode: mkCommentNode,

   package: function(fileset, root, packageHome, collector, packer, nodeProducer, ext) {
      fileset.map(function(f) {
         let dom = domify(fs.readFileSync(f, 'utf-8')),
            results = collector(dom);

         results.forEach(function(result) {
            let packedContent, packedFiles = [];

            if (result.files.length > 1) {
               if (checkFiles(root, f, result)) {
                  packedContent = packer(result.files.map(function(fl) {
                     return path.join(root, fl);
                  }).filter(function deleteControls(filename) {
                     if (ext === 'css') {
                        filename = filename.replace(/\\/g, '/');
                        return !(filename.includes('resources/Controls') ||
                           (filename.includes('resources/SBIS3.CONTROLS') && !filename.includes('resources/SBIS3.CONTROLS/themes')));
                     } else {
                        return true;
                     }
                  }), root);

                  // For each result content item create uniq filename and write item to it
                  packedContent.forEach(function(aSinglePackedFileContent, idx) {
                     const packedFile = path.join(packageHome, uniqname(result.files, idx + '.' + ext));
                     packedFiles.push(packedFile);
                     fs.ensureDirSync(path.dirname(packedFile));
                     fs.writeFileSync(packedFile, aSinglePackedFileContent);
                  });

                  // Remove initial collection from DOM
                  removeDomCollection(result.nodes);

                  // For each packed file create new DOM node and attach it to document
                  packedFiles.forEach(function(aSingleFile) {
                     const newNode = nodeProducer(dom, path.relative(root, aSingleFile));
                     if (result.before) {
                        result.before.parentNode.insertBefore(newNode, result.before);
                     } else {
                        dom.getElementsByTagName('head')[0].appendChild(newNode);
                     }
                  });

                  // update HTML
                  fs.writeFileSync(f, stringify(dom));

                  logger.debug('OK  : ' + f);
               } else {
                  logger.warning({
                     message: 'Skip file',
                     filePath: f
                  });
               }
            }
         });
      });
   }
};

module.exports = helpers;
