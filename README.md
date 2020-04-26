# Builder
###
Builder - утилита для сборки клиентского кода проектов на платформе СБИС3.
Сборка - процесс преобразования исходного кода в работающее приложение.

[Пользовательская документация](https://wi.sbis.ru/doc/platform/developmentapl/development-tools/builder/)

[Техническая документация](https://online.sbis.ru/shared/disk/2f1f267b-f1e0-4955-9a39-fbb9786084b5)

[Участок работ](https://online.sbis.ru/arearesponsibility.html?region_left=areaResponsibility#openworkarea=da98e741-0b59-480a-82b2-a83669ab3167)

# Задачи npm

Описаны в package.json. Запускаются из корневого каталога:

        npm run <имя команды>

Перед любым запуском нужно выполнить

    npm i

Т.к. в проекте есть .npmrc, то о флагах обычно можно не думать.

## Задачи npm для CI/CD

1. **build** - основная задача сборки проекта.
Запускает **build:verify** и **build:only**.
Артефакты: папка dest (готовый builder для SDK), файл eslint-report.log (отчёт ESLint только об ошибках), xunit.log и xunit-result.xml (резултьтат тестирования)
2. **build:only** - копирует нужные исходники в папку dest и устанавливает зависимости.
3. **build:verify** - проверка кода через ESLint(**build:lint**) и юнит тесты(**build:test**). Артефакты: файл eslint-report.log, xunit.log и xunit-result.xml.

## Задачи npm для разработки
1. **test** - запустить юнит тесты.
2. **test:coverage** - узнать % покрытия кода юниттестами. Артефакт: файл отчёта coverage/index.html.
3. **lint** - запустить ESLint. Если ESLint упал - точно будут проблемы при сборке. Варнинги можно игнорировать, но лучше поправить.
4. **lint:fix** - запустить ESLint с флагом --fix. Поправит самые простые ошибки.
6. **lint:errors** - выведет только ошибки, что уронят сборку.

## Про .npmrc

Флаг --legacy-bundling нужен для корректной установки зависимостей пакета sbis3-json-generator.

## Про package-lock.json
package-lock.json нужен для фиксации конкретных версий пакетов для всего дерева зависимостей.
Это нужно для:
1. Повторяемой сборки
2. Безопасности при обновлении минорных пакетов в глубине дерева зависимостей.
3. Быстрой установки зависимости через "npm ci" (NPM 6+)

[Подробнее:](https://docs.npmjs.com/files/package-lock.json)

# Использование Builder'а

## Задача **build**
Основная задача сборки статики проекта.

Выполнить из папки builder'а:

        node ./node_modules/gulp/bin/gulp.js --gulpfile ./gulpfile.js build --config=custom_config.json

Где custom_config.json - путь до JSON конфигурации в формате:

      {
         "cache": "путь до папки с кешем",
         "output": "путь до папки с ресурсами статики стенда",
         "localization": ["ru-RU", "en-US"] | false,            //опционально. список локализаций
         "default-localization": "ru-RU",                       //опционально, если нет "localization"
         "logs": "путь до папки для записи логов",              //опционально, используется для записи builder_report.json
         "multi-service": false|true,                           //опционально. по умолчанию false. Собираем один сервис или несколько. От этого зависит будем ли мы менять константы в статических html и пакетах.
         "url-service-path": "путь до текущего сервиса",        //опционально. по умолчанию "/"
         "typescript": true|false,                              //опционально, по умолчанию false. Задача компиляции TypeScript в модули AMD-формата.
         "modules": [                                           //сортированный по графу зависимостей список модулей
            {
              "name": "имя модуля",
              "path": "путь до папки модуля",
              "responsible": "ответственный",
              "preload_urls": ["url1", "url2"]
            }
         ]
      }
После сборки в папке с кешем создаётся файл "last_build_gulp_config.json" - копия последнего оригинального файла конфигурации.
#### Полный список флагов для настройки сборщика(указываются в custom_config.json):
#### 1) typescript
Компиляция typescript в модули AMD-формата.\
_Принимаемые значения:_ **false/true**\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере модуля Data)результат работы сборщика будет иметь вид:
![GitHub Logo](/images/typescript.png)
#### 2) less
Компиляция less в css.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере Controls/Button)результат работы сборщика будет иметь вид:
![GitHub Logo](/images/less.png)
#### 3) presentationServiceMeta
Генерация базовых мета-файлов сборщика, необходимых для работы Сервиса Представлений:

1. **"navigation-modules.json"** -набор модулей для Серверного конфигурирования правого аккордеона
2. **"routes-info.json"** -информация для работы роутинга на Сервисе Представлений
3. **"static_templates.json"** -информация для корректной отдачи статических html в Сервисе Представлений

_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере модуля Data)результат работы сборщика будет иметь вид:
![GitHub Logo](/images/presentationServiceMeta.png)
#### 4) contents
Генерация мета-файлов contents.js/contents.json, необходимых для работы приложения.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере модуля Data)результат работы сборщика будет иметь вид:
![GitHub Logo](/images/contents.png)
#### 5) compress
Генерация архивированных версий для каждого файла статики (для раздачи Диспетчером). Архивированные версии файла будут созданы только для минифицированных исходников(результат работы флага "minimize")\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере модуля WS.Core) результат работы сборщика будет иметь вид:
![GitHub Logo](/images/compress.png)
#### 6) deprecatedWebPageTemplates
Сборка статических html, задаваемых через механизм webPage.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере PersonalCertificates)результат работы сборщика будет иметь вид:
![GitHub Logo](/images/webpage.png)
#### 7) htmlWml
Cборка статических html на VDOM.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере TestPlatform/TestsPlatform/File/Page)результат работы сборщика будет иметь вид:
![GitHub Logo](/images/htmlwml.png)
#### 8) minimize
Минификация модулей AMD-формата.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере Controls/Application/TouchDetector) результат работы сборщика будет иметь вид:
![GitHub Logo](/images/minimize.png)
#### 9) wml
Компиляция динамических(tmpl, wml) шаблонов.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере Controls/Application/TouchDetector) результат работы сборщика будет иметь вид:
![GitHub Logo](/images/wml.png)
**.min.wml** содержит скомпилированный и минифицированный шаблон.
#### 10) deprecatedXhtml
Компиляция динамических устаревших шаблонов xhtml.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Результат работы сборщика аналогичен опции **wml**.
#### 11) deprecatedOwnDependencies
Упаковка вместе с компонентов его собственных шаблонных зависимостей.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере Controls/Tabs)результат работы сборщика будет иметь вид:
![GitHub Logo](/images/deprecatedOwnDependencies.png)
**.min.js** содержит компонент с запакованными в него собственными шаблонными зависимостями.\
**.min.original.js** содержит оригинальное содержимое компонента до паковки.\
#### 12) deprecatedStaticHtml
Паковка статических html-страниц. Выполняется по аналогии с runtime-паковкой на Сервисе Представлений(rtpackage)\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере PersonalCertificates) результат работы сборщика будет иметь вид:
![GitHub Logo](/images/deprecatedstatichtml.png)
**static_packages** содержит пакеты для каждой построенной статической html.\
#### 13) customPack
Паковка по созданной разработчиком пользовательской конфигурации - файл формата **package.json**\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере модуля WS.Core)результат работы сборщика будет иметь вид:
![GitHub Logo](/images/custompack.png)
#### 14) dependenciesGraph
Генерация дерева AMD-зависимостей.\ 
Где используется:
1. runtime паковка на Сервисе Представлений(rtpackage).
2. Работа  Chrome-плагина по анализу зависимостей SBIS Denendency Tree.

_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
Для набора исходников(на примере модуля WS.Core) результат работы сборщика будет иметь вид:
![GitHub Logo](/images/dependenciesgraph.png)
#### 15) sources
Копируем исходный код файлов в конечную директорию.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **true**.\
Для набора исходников(на примере модуля View) результат работы сборщика будет иметь следующий вид:\
Флаг установлен в значение _false_:
![GitHub Logo](/images/sources.png)
Флаг установлен в значение _true_:
![GitHub Logo](/images/sources-true.png)
#### 16) symlinks
Создаём символические ссылки для исходного кода проекта.\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **true**.\
Для набора исходников(на примере модуля Types) результат работы сборщика будет иметь следующий вид:\
Флаг установлен в значение _false_:
![GitHub Logo](/images/symlinks-false.png)
Флаг установлен в значение _true_:
![GitHub Logo](/images/symlinks.png)
#### 17) tsc
Выполнение в сборке проекта команды компилятора typescript - tsc с флагом --noEmit
(компиляция typescript без сохранения результатов компиляции - для выявления ошибок в typescript-исходниках вашего проекта)\
_Принимаемые значения:_ **false/true**.\
_Значение по умолчанию:_ **false**.\
## Задача **buildOnChange**
Задача по обновлению одного файла в развёрнутом локальном стенде. Обычно вызывается из WebStorm.

Выполнить из папки builder'а:

        node ./node_modules/gulp/bin/gulp.js --gulpfile ./gulpfile.js buildOnChange --config=last_build_gulp_config.json --filePath="FilePath"

Где **last_build_gulp_config.json** - путь до JSON конфигурации последней сборки, **FilePath** - файл который мы хотим обновить.

## Задача **runTypescript**
Задача по запуску typescript для модулей, описанных в gulp_config.

Выполнить из папки builder'а:

        node ./node_modules/gulp/bin/gulp.js --gulpfile ./gulpfile.js runTypescript --config=gulp_config.json

Где **gulp_config.json** - путь до JSON конфигурации сборки, используемой в основной задаче сборки "build"

## Задача **collectWordsForLocalization**

Задача сборa фраз для локализации статики. Нужно для genie.sbis.ru и wi.sbis.ru.

Выполнить из папки builder'а:

        node ./node_modules/gulp/bin/gulp.js --gulpfile ./gulpfile.js collectWordsForLocalization --config=custom_config.json

Где custom_config.json - путь до JSON конфигурации в формате:

      {
         "cache": "путь до папки с кешем",
         "output": "путь до результирующего json файла",
         "modules": [{                                          //сортированный по графу зависимостей список модулей
            "name": "имя модуля",
            "path": "путь до папки модуля",
            "responsible": "ответственный"
         }]
      }

# Тестирование

Builder тестируем через модульные тесты с помощью mocha и chai.
Для локальной отладки тестов нужно настроить среду разработки на запуск mochа в папке test. Нужно обязательно указать параметр "--timeout 600000".
Такой огромный таймаут нужен по двум причинам:
1. тесты на MacOS идут дольше, чем на windows и centos
2. интеграционные тесты тоже пишем в терминах mocha. Возможно, это не совсем корректно и нужно переделать.

# Style guide
Стандарт разработки на JavaScript описан [тут.](https://wi.sbis.ru/doc/platform/developmentapl/standards/styleguide-js/)

Чтобы эти требования соблюдались, написан конфиг для ESLint - файл ".eslintrc" в корне проекта. В конфиге нулевая толерантность к несоответствию style guide.
Причины описаны [тут](https://ru.wikipedia.org/wiki/Теория_разбитых_окон) и [тут](https://habrahabr.ru/company/pvs-studio/blog/347686/)

Также не пренебрегайте функцией Inspect Code в WebStorm.

# Логирование и вывод ошибок
Логирование и вывод ошибок осуществляется через универсальный логгер: sbis3-builder/lib/logger.js
Пример использования:

        const logger = require('./lib/logger').logger();
        logger.debug('Сообщение не будет видно пользователям, но будет в логах');
        logger.info('Сообщение будет видно пользователям и будет в логах');
        logger.warning('Текст предупреждения');
        logger.error('Текст ошибки');
        logger.error({ //аналогично можно вызывать logger.warning.
            message: 'Текст ошибки', //если не задать, то будет выведено error.message
            filePath: filePath, //полный путь до файла, крайне желательно
            moduleInfo: moduleInfo, // экземпляр класса ModuleInfo, если есть. актуально для Gulp.
            error: error //пойманное исключение, если есть
        });

Вывод сообщений уровня debug включается при запуске утилиты с флагом -LLLL. Побробнее [тут.](https://github.com/gulpjs/gulp-cli)

При запуске утилиты с флагом --log-level можно настроить уровень логгирования:
1. info - выводить все сообщения, предупреждения и ошибки при работе утилиты.
2. warning - выводить предупреждения и ошибки при работе утилиты.
3. error - выводить только ошибки при работе утилиты.

По умолчанию выставляется уровень логгирования info.
Пример запуска с логгированием исключительно ошибок:

        node ./node_modules/gulp/bin/gulp.js --gulpfile=./gulpfile.js build --config=custom_config.json --log-level=error

После сборки записывается builder_report.json - отчёт об ошибках и предупреждениях сборки для автоматизации оформления ошибок в системе CI/CD.
Флаг --log-level не влияет на builder_report.json, он будет содержать в себе все предупреждения и ошибки независимо от значения флага --log-level.

Также при работе Gulp записывает результаты работы каждого своего шага. Пример:

        [12:32:33] Using gulpfile ~/work/repos/saby/Builder/gulpfile.js
        [12:32:33] Starting 'build'...
        ..............................
        [12:32:35] Finished 'build' after 1.56 s

Чтобы выключить запись таких логов, выполняйте запуск утилиты с флагом --silent.

# Подключение и использование в виде npm-пакета.
#### 1) Для подключения Builder в ваш проект необходимо в package.json в секции dependencies прописать
        
        "sbis3-builder": "git+https://github.com/saby/Builder.git#rc-20.1000"
        
P.S. не забывайте об актуализации ветки Builder, обновлять её необходимо вручную.
#### 2) Выполните npm install
#### 3) Создайте в корне проекта файл builder.json. Это конфигурационный файл, по которому Builder будет собирать ваш проект.
Стандартная конфигурация имеет вид:

    {
        "cache": <путь до директории с кэшем сборщика>,
        "output": <путь до директории с результатом сборки>,
        "logs": <путь до папки с логами сборки>,
        "modules": [
            {
                "name": <ммя интерфейсного модуля>,
                "path": <путь до интерфейсного модуля>
            }
        ]
    }

Остаётся добавить нужные для решения ваших задач флаги Builder.
Пример: при задании подобной конфигурации для сборки

    {
        "cache": ./.builder/cache,
        "output": ./application,
        "logs": ./.builder/logs,
        "typescript": true,
        "modules": [
            {
                "name": "Types",
                "path": "./node_modules/saby-types/Types"
            }
        ]
    }
    
будет собран весь TypeScript-код интерфейсного модуля Types.
Пример задания builder.json смотрите также [здесь](https://github.com/saby/ui/blob/rc-20.1000/buildTemplate.json)
#### 4) Запустите Builder с помощью команды

        node node_modules/gulp/bin/gulp build --gulpfile=gulpfile.js --config=../../builder.json
        
Примечание 1: Путь до builder.json необходимо указывать относительно директории npm-пакета sbis3-builder\
Примечание 2: выполнять данную команду необходимо в корне вашего проекта.\
Примечание 3: Чтобы каждый раз не выполнять длинную команду для Builder, вы можете описать её один раз в виде npm-скрипта

    "build": "node node_modules/gulp/bin/gulp build --gulpfile=gulpfile.js --config=../../builder.json"
    
Пример подобного задания можете посмотреть [здесь.](https://github.com/saby/ui/blob/rc-20.1000/package.json#L19)


Далее остаётся из консоли выполнить команду

    npm run build

