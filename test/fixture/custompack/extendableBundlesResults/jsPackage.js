/* /InterfaceModule1/extend.package.json:superbundle-for-builder-tests.package.js */
(function(){define('css!InterfaceModule1/moduleStyle',['css!WS.Core/superbundle-for-builder-tests.package'],'');define('css!InterfaceModule1/amdModule',['css!WS.Core/superbundle-for-builder-tests.package'],'');})();
define("InterfaceModule1/library",["require","exports"],function(n,e){var t;Object.defineProperty(e,"__esModule",{value:true}),e["InterfaceModule1/_private/module1"]=true;var r=function(){if(!t)t=function(){"use strict";var e={},t=function(e,t){Object.defineProperty(t,"__esModule",{value:true});var r=function(){function e(e){this.variables=e}return e}();t.default=r}(n,e);if(t instanceof Function)return t;else if(t&&Object.getPrototypeOf(t)!==Object.prototype)return t;else for(var r in t)if(t.hasOwnProperty(r))e[r]=t[r];return e}();return t},u;e["InterfaceModule1/_private/module2"]=true;var o=function(){if(!u)u=function(){"use strict";var e={},t=function(e,t){Object.defineProperty(t,"__esModule",{value:true});var r=function(){function e(e){this.variables=e}return e}();t.default=r}(n,e);if(t instanceof Function)return t;else if(t&&Object.getPrototypeOf(t)!==Object.prototype)return t;else for(var r in t)if(t.hasOwnProperty(r))e[r]=t[r];return e}();return u};function i(){return"test"}return Object.defineProperty(e,"Module1",{get:function(){return r().default}}),Object.defineProperty(e,"Module2",{get:function(){return o().default}}),Object.defineProperty(e,"test",{get:function(){return i}}),e});
define("InterfaceModule1/amdModule",["css!InterfaceModule1/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});
/* /InterfaceModule2/extend.package.json:superbundle-for-builder-tests.package.js */
(function(){define('css!InterfaceModule2/moduleStyle',['css!WS.Core/superbundle-for-builder-tests.package'],'');})();
define("InterfaceModule2/amdModule",["css!InterfaceModule2/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});
/* /InterfaceModule3/extend.package.json:superbundle-for-builder-tests.package.js */
if(typeof window !== "undefined" && window.atob){define('css!InterfaceModule3/amdModule', function() {var global=(function(){return this || (0,eval)(this);})();var style = document.createElement("style"),head = document.head || document.getElementsByTagName("head")[0];style.type = "text/css";style.setAttribute("data-vdomignore", "true");style.appendChild(document.createTextNode(".interfaceModule3_logoDefault{background-image:url("+(global.wsConfig && global.wsConfig.resourceRoot ? global.wsConfig.resourceRoot : "resources/")+"InterfaceModule3/images/logo-en.svg?x_module=%{MODULE_VERSION_STUB=InterfaceModule3})}"));head.appendChild(style);});}
define("InterfaceModule3/amdModule",["css!InterfaceModule3/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});
define("InterfaceModule3/amdAnotherModule",[],function(){return{_moduleName:"InterfaceModule3/amdAnotherModule"}});