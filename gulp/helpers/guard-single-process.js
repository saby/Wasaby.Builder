'use strict';

//предотвращение множественного запуска builder'а на одном кеше для предсказуемого результата.
const
   logger = require('../../lib/logger').logger(),
   path = require('path'),
   fs = require('fs-extra');

let lockFle;

function lock(config) {
   return new Promise(async(resolve, reject) => {
      const dir = config.cachePath;
      await fs.ensureDir(dir);
      lockFle = path.join(dir, 'builder.lockfile');

      const isFileExist = await fs.pathExists(lockFle);
      if (isFileExist) {
         const errorMessage = 'Похоже, что запущен другой процесс builder в этой же папке, попробуйте перезапустить его позже. ' +
            `Если вы уверены, что предыдущий запуск завершился, то удалите папку '${dir}' и перезапустите процесс.`;

         logger.error(errorMessage);
         reject(new Error(errorMessage));
         return;
      }
      await fs.ensureFile(lockFle);
      logger.debug(`Создали файл '${lockFle}'`);
      resolve();
   });
}

function unlock() {
   return new Promise(async(resolve, reject) => {
      const isFileExist = await fs.pathExists(lockFle);
      if (!isFileExist) {
         const errorMessage = `В процессе выполнения кто-то удалил файл '${lockFle}'. ` +
            'Нет гарантий, что результат не пострадал. Перезапустите процесс.';

         logger.error(errorMessage);
         reject(new Error(errorMessage));
         return;
      }
      await fs.remove(lockFle);
      logger.debug(`Удалили файл '${lockFle}'`);
      resolve();
   });
}

module.exports = {
   'lock': lock,
   'unlock': unlock
};
