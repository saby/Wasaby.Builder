(function(){define('css!InterfaceModule1/moduleStyle',['css!WS.Core/superbundle-for-builder-tests.package'],'');define('css!InterfaceModule1/amdModule',['css!WS.Core/superbundle-for-builder-tests.package'],'');})();
define("InterfaceModule1/library",["require","exports"],function(n,e){var t;Object.defineProperty(e,"__esModule",{value:true}),e["InterfaceModule1/_private/module1"]=true;var r=function(){if(!t)t=function(){"use strict";var e={},t=function(e,t){Object.defineProperty(t,"__esModule",{value:true});var r=function(){function e(e){this.variables=e}return e}();t.default=r}(n,e);if(t instanceof Function)return t;else if(t&&Object.getPrototypeOf(t)!==Object.prototype)return t;else for(var r in t)if(t.hasOwnProperty(r))e[r]=t[r];return e}();return t},o;e["InterfaceModule1/_private/module2"]=true;var u=function(){if(!o)o=function(){"use strict";var e={},t=function(e,t){Object.defineProperty(t,"__esModule",{value:true});var r=function(){function e(e){this.variables=e}return e}();t.default=r}(n,e);if(t instanceof Function)return t;else if(t&&Object.getPrototypeOf(t)!==Object.prototype)return t;else for(var r in t)if(t.hasOwnProperty(r))e[r]=t[r];return e}();return o};function f(){return"test"}return Object.defineProperty(e,"Module1",{get:function(){var e=r().default;if("function"===typeof e&&!e.prototype.hasOwnProperty("_moduleName"))e.prototype._moduleName="InterfaceModule1/library:Module1";return e},enumerable:true}),Object.defineProperty(e,"Module2",{get:function(){var e=u().default;if("function"===typeof e&&!e.prototype.hasOwnProperty("_moduleName"))e.prototype._moduleName="InterfaceModule1/library:Module2";return e},enumerable:true}),Object.defineProperty(e,"test",{get:function(){var e=f;if("function"===typeof e&&!e.prototype.hasOwnProperty("_moduleName"))e.prototype._moduleName="InterfaceModule1/library:test";return e},enumerable:true}),e});
define("InterfaceModule1/amdModule",["css!InterfaceModule1/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});