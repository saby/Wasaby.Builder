'use strict';

module.exports = function (module, base) {
    let deps = ['Core/i18n'], _const = global.requirejs('Core/constants'), json = [], css = [], jsonLang = [], cssLang = [];
    let availableLangs = Object.keys(global.requirejs('Core/i18n').getAvailableLang());

    return new Promise((resolve, reject) => {
        if (!availableLangs || (_const && !_const.defaultLanguage) || !module.deps.length) {
            return resolve('define("' + module.fullName + '", ["Core/i18n"], function(i18n) {return i18n.rk.bind(i18n);});');
        }

        let noCssDeps   = module.deps.filter(d => d.indexOf('native-css!') == -1);
        let noLangDeps  = [];
        let langDeps    = [];

        deps.concat(noCssDeps).forEach(d => {
            if (d.match(langRegExp) == null) {
                noLangDeps.push(d);
            } else {
                langDeps.push(d);
            }
        });
        // дописываем зависимость только от необходимого языка
        let result = 'define("' + module.fullName + '", '+ JSON.stringify(noLangDeps) +', function(i18n) {var langDep = ' + JSON.stringify(langDeps) + '.filter(function(dep){var lang = dep.match(' + langRegExp + '); if (lang && lang[1] == i18n.getLang()){return dep;}}); if (langDep){global.requirejs(langDep)} return i18n.rk.bind(i18n);});';

        return resolve(result);
    });
};
