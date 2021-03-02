define('Modul/Modul', [
    'tslib',
    'i18n!Modul/_es6/Modul',
    'i18n!Modul',
    'UI/Executor',
    'require',
    'exports',
    'css!theme?Modul/_es6/test'
], function (tslib_1, rk_1, rk, Executor, require, exports) {
    Object.defineProperty(exports, '__esModule', { value: true });
        exports['wml!Modul/_es6/test'] = true;
        var wml_Modul__es6_test = function () {
        var exports = {};
        var result = function (Executor, rk) {
            function debug() {
                debugger;
            }
            var thelpers = Executor.TClosure;
            var deps = Array.prototype.slice.call(arguments);
            var depsLocal = {};
            var includedTemplates = {};
            var scopeForTemplate, attrsForTemplate;
            var templateFunction = function Modul__es6_test(data, attr, context, isVdom, sets, forceCompatible, generatorConfig) {
                var templateCount = 0;
                var key = thelpers.validateNodeKey(attr && attr.key);
                var defCollection = {
                    id: [],
                    def: undefined
                };
                var viewController = thelpers.calcParent(this, typeof currentPropertyName === 'undefined' ? undefined : currentPropertyName, data);
                if (typeof forceCompatible === 'undefined') {
                    forceCompatible = false;
                }
                var markupGenerator = thelpers.createGenerator(isVdom, forceCompatible, generatorConfig);
                var filename = 'Modul/_es6/test';
                var rk = thelpers.getRk(filename);
                var funcContext = thelpers.getContext(this);
                try {
                    var out = markupGenerator.joinElements([markupGenerator.createTag('div', {
                            'attributes': { 'class': 'test' },
                            'events': typeof window === 'undefined' ? {} : {},
                            'key': key + '0_'
                        }, [], attr, defCollection, viewController)], key, defCollection);
                    if (defCollection && defCollection.def) {
                        out = markupGenerator.chain(out, defCollection, this);
                        defCollection = undefined;
                    }
                } catch (e) {
                    thelpers.templateError(filename, e, data);
                }
                return out || markupGenerator.createText('');
            };
            templateFunction.stable = true;
            templateFunction.reactiveProps = [];
            templateFunction.isWasabyTemplate = true;
            return templateFunction;
        }(Executor, rk);
        if (result instanceof Function) {
            return result;
        } else if (result && Object.getPrototypeOf(result) !== Object.prototype) {
            return result;
        } else {
            for (var property in result) {
                if (result.hasOwnProperty(property)) {
                    exports[property] = result[property];
                }
            }
        }
        return exports;
    }();
        exports['Modul/_es6/Modul2'] = true;
        var Modul__es6_Modul2 = function () {
        'use strict';
        var exports = {};
        var result = function (require, exports, tslib_1) {
            'use strict';
            Object.defineProperty(exports, '__esModule', { value: true });
            function prepareOptions(param1, param2) {
                return tslib_1.__awaiter(this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        return [
                            2,
                            {
                                sum: param1 + param2,
                                tplFn: template
                            }
                        ];
                    });
                });
            }
            exports.default = prepareOptions;
        }(require, exports, tslib_1, typeof css_theme_Modul__es6_test === 'undefined' ? null : css_theme_Modul__es6_test, wml_Modul__es6_test);
        if (result instanceof Function) {
            return result;
        } else if (result && Object.getPrototypeOf(result) !== Object.prototype) {
            return result;
        } else {
            for (var property in result) {
                if (result.hasOwnProperty(property)) {
                    exports[property] = result[property];
                }
            }
        }
        return exports;
    }();
        exports['Modul/_es5/Module'] = true;
        var Modul__es5_Module = function () {
        'use strict';
        var exports = {};
        var result = function (require, exports, tslib_1, Modul_2) {
            'use strict';
            return {
                Modul_1: Modul_2,
                default: Modul_2
            };
        }(require, exports, tslib_1, Modul__es6_Modul2);
        if (result instanceof Function) {
            return result;
        } else if (result && Object.getPrototypeOf(result) !== Object.prototype) {
            return result;
        } else {
            for (var property in result) {
                if (result.hasOwnProperty(property)) {
                    exports[property] = result[property];
                }
            }
        }
        return exports;
    }();
        exports['Modul/_es6/Modul'] = true;
        var Modul__es6_Modul = function () {
        'use strict';
        var exports = {};
        var result = function (require, exports, rk, Module_js_1) {
            'use strict';
            Object.defineProperty(exports, '__esModule', { value: true });
            exports.someTest = void 0;
            exports.default = Module_js_1.default;
            function someTest() {
                var test1 = rk('Тестовое сообщение');
                return test1;
            }
            exports.someTest = someTest;
        }(require, exports, rk_1, Modul__es5_Module);
        if (result instanceof Function) {
            return result;
        } else if (result && Object.getPrototypeOf(result) !== Object.prototype) {
            return result;
        } else {
            for (var property in result) {
                if (result.hasOwnProperty(property)) {
                    exports[property] = result[property];
                }
            }
        }
        return exports;
    }();
        var Modul_es_1 = Modul__es6_Modul;
    exports.default = Modul_es_1.default;
    
    return exports;
});