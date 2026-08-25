import { bundle, type WebpackOverrideFn } from "@remotion/bundler";

const resolveTypeScriptExtensions: WebpackOverrideFn = (configuration) => ({
  ...configuration,
  resolve: {
    ...configuration.resolve,
    extensionAlias: {
      ...configuration.resolve?.extensionAlias,
      ".js": [".tsx", ".ts", ".js"]
    }
  }
});

export async function bundleComposition(options: {
  entryPoint: string;
  outDir: string;
  publicDir: string;
}): Promise<string> {
  return bundle({ ...options, webpackOverride: resolveTypeScriptExtensions });
}
