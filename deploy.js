// deploy.js
import * as ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация
const config = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  secure: process.env.FTP_SECURE === 'true',
  localRoot: path.join(__dirname, 'dist'),
  remoteRoot: process.env.FTP_REMOTE_PATH || '/'
};

// Функция для рекурсивной загрузки директории
async function uploadDir(client, localDir, remoteDir) {
  const files = fs.readdirSync(localDir);
  
  for (const file of files) {
    const localPath = path.join(localDir, file);
    const remotePath = path.join(remoteDir, file).replace(/\\/g, '/');
    const stat = fs.statSync(localPath);
    
    if (stat.isDirectory()) {
      try {
        // Пробуем создать директорию на удаленном сервере
        await client.ensureDir(remotePath);
        console.log(`📁 Создана директория: ${remotePath}`);
        // Рекурсивно загружаем содержимое директории
        await uploadDir(client, localPath, remotePath);
      } catch (err) {
        console.error(`❌ Ошибка при создании директории ${remotePath}:`, err.message);
      }
    } else {
      try {
        // Загружаем файл
        await client.uploadFrom(localPath, remotePath);
        console.log(`📤 Загружен файл: ${remotePath}`);
      } catch (err) {
        console.error(`❌ Ошибка при загрузке файла ${remotePath}:`, err.message);
      }
    }
  }
}

// Основная функция деплоя
async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = process.env.FTP_VERBOSE === 'true';
  
  try {
    console.log('📡 Начинаем FTP деплой...');
    
    // Подключаемся к FTP серверу
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      secure: config.secure
    });
    
    console.log('✅ Успешное подключение к FTP серверу');
    
    // Убедимся, что удаленная директория существует
    await client.ensureDir(config.remoteRoot);
    console.log(`📁 Удаленная директория: ${config.remoteRoot}`);
    
    // Загружаем файлы
    await uploadDir(client, config.localRoot, config.remoteRoot);
    
    console.log('✅ Деплой успешно завершен!');
  } catch (err) {
    console.error('❌ Ошибка при деплое:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

// Запускаем деплой
deploy();