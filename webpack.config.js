import path from "path";
import { fileURLToPath } from "url";

const rootFolder = path.dirname(fileURLToPath(import.meta.url));
const outputFolder = path.resolve(rootFolder, "webpacked");

const entries = {
  "browser-pubsub-p2p-publish-to-kubo":
    "./browser-pubsub-p2p-publish-to-kubo.js",
};

export default {
  // each file is its own entry
  entry: entries,

  output: {
    // output each test entry to its own file name
    filename: "[name].js",
    path: outputFolder,

    // clean the dist folder on each rebuild
    clean: true,
  },
};
