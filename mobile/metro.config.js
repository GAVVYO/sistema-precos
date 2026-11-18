// Metro do app: enxerga as regras do site em ../src sem copiar arquivos.
// - "@core/x" → ../src/x
// - "@/x" dentro de ../src (arquivos do site) → ../src/x; no app → mobile/src/x
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const appRoot = __dirname;
const siteRoot = path.resolve(appRoot, "..");
const siteSrc = path.join(siteRoot, "src");

const config = getDefaultConfig(appRoot);
config.watchFolders = [siteSrc, path.join(siteRoot, "node_modules")];
config.resolver.nodeModulesPaths = [path.join(appRoot, "node_modules"), path.join(siteRoot, "node_modules")];

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  let name = moduleName;
  if (name.startsWith("@core/")) name = path.join(siteSrc, name.slice(6));
  else if (name.startsWith("@/") && context.originModulePath.startsWith(siteSrc + path.sep)) name = path.join(siteSrc, name.slice(2));
  const resolve = upstream ?? context.resolveRequest;
  return resolve(context, name, platform);
};

module.exports = config;
