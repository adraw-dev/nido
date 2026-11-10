/**
 * Ajustes de compilación de Android que deben sobrevivir a `expo prebuild`
 * (la carpeta android/ se regenera y se pierde lo editado a mano):
 *
 * - Solo arm64-v8a: los celulares actuales; compila ~4 veces más rápido.
 * - En Windows: local.properties con el SDK y CMake 3.31.6. El CMake 3.22.1
 *   por defecto trae ninja 1.10, que falla con rutas de más de 260 caracteres.
 *   Solo se escribe si esas carpetas existen (en EAS/Linux no hace nada).
 */
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';

function withArm64Only(config) {
  return withGradleProperties(config, (cfg) => {
    const key = 'reactNativeArchitectures';
    const existing = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
    if (existing) existing.value = 'arm64-v8a';
    else cfg.modResults.push({ type: 'property', key, value: 'arm64-v8a' });
    return cfg;
  });
}

function withWindowsLocalProperties(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const localAppData = process.env.LOCALAPPDATA;
      if (process.platform !== 'win32' || !localAppData) return cfg;
      const sdk = path.join(localAppData, 'Android', 'Sdk');
      const cmake = path.join(sdk, 'cmake', CMAKE_VERSION);
      if (!fs.existsSync(sdk)) return cfg;

      const esc = (p) => p.replace(/\\/g, '\\\\');
      const lines = [`sdk.dir=${esc(sdk)}`];
      if (fs.existsSync(cmake)) lines.push(`cmake.dir=${esc(cmake)}`);
      else console.warn(`[withLocalAndroidBuild] No está CMake ${CMAKE_VERSION}; instálalo en SDK Manager.`);

      fs.writeFileSync(path.join(cfg.modRequest.platformProjectRoot, 'local.properties'), `${lines.join('\n')}\n`);
      return cfg;
    },
  ]);
}

module.exports = function withLocalAndroidBuild(config) {
  return withWindowsLocalProperties(withArm64Only(config));
};
