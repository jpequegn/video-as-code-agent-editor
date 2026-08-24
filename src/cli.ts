#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { Command } from "commander";

import { VERSION } from "./version.js";

export function createProgram(): Command {
  return new Command()
    .name("vace")
    .description("Compile reviewable video edits from typed plans")
    .version(VERSION)
    .showHelpAfterError();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await createProgram().parseAsync(process.argv);
}
