'use strict';

const chai = require('chai'),
   parseJsComponent = require('../lib/parse-js-component');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

chai.should();
const expect = chai.expect;

describe('parse js component', function() {
   it('basic', async() => {
      const result = parseJsComponent('');
      Object.getOwnPropertyNames(result).length.should.equal(0);
   });
   it('error', async() => {
      expect(() => {
         parseJsComponent('define(');
      }).to.throw('Line 1: Unexpected end of input');
   });
   it('empty module name', async() => {
      const result = parseJsComponent('define(function(){});');
      Object.getOwnPropertyNames(result).length.should.equal(0);
   });
   it('normal module name', async() => {
      const result = parseJsComponent('define("My.Module/Name", function(){});');
      Object.getOwnPropertyNames(result).length.should.equal(1);
      result['moduleName'].should.equal('My.Module/Name');
   });
   it('declare object webpage', async() => {
      const result = parseJsComponent('define("My.Module/Name", function(){' +
         'let module;' +
         'module.webPage = {' +
         '   htmlTemplate: "\\\\Тема Скрепка\\\\Шаблоны\\\\empty-template.html",' +
         '   title: "Пожалуйста, подождите...",' +
         '   outFileName: "ca_stub",' +
         '   trash:"trash"' +
         '};' +
         'return module;});');
      Object.getOwnPropertyNames(result).length.should.equal(2);
      result['moduleName'].should.equal('My.Module/Name');
      const webPage = result['webPage'];
      Object.getOwnPropertyNames(webPage).length.should.equal(3);
      webPage['htmlTemplate'].should.equal('\\Тема Скрепка\\Шаблоны\\empty-template.html');
      webPage['title'].should.equal('Пожалуйста, подождите...');
      webPage['outFileName'].should.equal('ca_stub');
   });

   it('declare tricky webpage', async() => {
      const result = parseJsComponent('define("My.Module/Name", function(){' +
         'let module;' +
         'module.webPage = {};' +
         'module.webPage.htmlTemplate = "\\\\Тема Скрепка\\\\Шаблоны\\\\empty-template.html";' +
         'module.webPage.title = "Пожалуйста, подождите...";' +
         'module.webPage.outFileName = "ca_stub";' +
         'return module;});');
      Object.getOwnPropertyNames(result).length.should.equal(2);
      result['moduleName'].should.equal('My.Module/Name');
      const webPage = result['webPage'];

      //теоритически это должно работать. но мы сознательно это не поддерживаем сейчас, поэтому webPage - пустой
      Object.getOwnPropertyNames(webPage).length.should.equal(0);
   });
});

