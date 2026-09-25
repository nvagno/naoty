// Hook afterPack d'electron-builder : copie le serveur Next autonome dans les
// ressources de l'application. (Les extraResources écartent toujours node_modules.)
import fs from "node:fs";
import path from "node:path";

export default async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const resources =
    electronPlatformName === "darwin" || electronPlatformName === "mas"
      ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");
  const from = path.join(packager.projectDir, ".next", "standalone");
  const to = path.join(resources, "server");
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
}
