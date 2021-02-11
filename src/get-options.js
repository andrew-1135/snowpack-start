/* eslint-disable no-prototype-builtins */
/* eslint-disable no-console */

const os = require("os");
const path = require("path");
const commander = require("commander"); // Command line util
const fse = require("fs-extra"); // Extra file manipulation utils
const prompts = require("prompts"); // User prompts

const styles = require("./styles.js");
const PACKAGE_JSON = require("../package.json");

const userDefaults = path.join(os.homedir(), ".snowpackstart.js");
const DEFAULT_OPTIONS = (
  fse.pathExistsSync(userDefaults)
  // eslint-disable-next-line import/no-dynamic-require
    ? require(userDefaults)
    : require("./defaults.js")
);

function projectDirValidator(projectDir) {
  if (!projectDir.trim().length) {
    return "No directory provided";
  } else if (fse.pathExistsSync(projectDir)) {
    return "Project directory already exists";
  } else {
    return true;
  }
}

const PROMPTS = new Map(Object.entries({
  projectDir: {
    type: "text",
    name: "projectDir",
    message: "Project directory",
    validate: projectDirValidator,
  },
  jsFramework: {
    type: "select",
    name: "jsFramework",
    message: "JavaScript framework",
    choices: [
      { title: "None", value: "none" },
      { title: "React", value: "react" },
      { title: "Vue", value: "vue" },
      { title: "Svelte", value: "svelte" },
      { title: "Preact", value: "preact" },
      { title: "LitElement", value: "lit-element" },
    ],
  },
  typescript: {
    type: "toggle",
    name: "typescript",
    message: "TypeScript",
    active: "Yes",
    inactive: "No",
  },
  codeFormatters: {
    type: "multiselect",
    name: "codeFormatters",
    message: "Code formatters",
    choices: [
      { title: "ESLint", value: "eslint" },
      { title: "Prettier", value: "prettier" },
    ],
  },
  sass: {
    type: "toggle",
    name: "sass",
    message: "Sass",
    active: "Yes",
    inactive: "No",
  },
  cssFramework: {
    type: "select",
    name: "cssFramework",
    message: "CSS framework",
    choices: [
      { title: "None", value: "none" },
      { title: "Tailwind CSS", value: "tailwindcss" },
      { title: "Bootstrap", value: "bootstrap" },
    ],
  },
  bundler: {
    type: "select",
    name: "bundler",
    message: "Bundler",
    choices: [
      { title: "Webpack", value: "webpack" },
      { title: "Snowpack", value: "snowpack" },
      { title: "None", value: "none" },
    ],
  },
  plugins: {
    type: "multiselect",
    name: "plugins",
    message: "Other plugins",
    choices: [
      { title: "Web Test Runner", value: "wtr" },
      { title: "PostCSS", value: "postcss" },
      { title: "Plugin Run Script", value: "prs" },
      { title: "Plugin Build Script", value: "pbs" },
      { title: "Plugin Optimize", value: "pgo" },
    ],
  },
  license: {
    type: "select",
    name: "license",
    message: "License",
    choices: [
      { title: "MIT", value: "mit" },
      { title: "GPL", value: "gpl" },
      { title: "Apache", value: "apache" },
      { title: "None", value: "none" },
    ],
  },
  author: {
    type: (prev, values) => {
      if (prev === "mit" && values.hasOwnProperty("license")) {
        return "text";
      } else {
        return null;
      }
    },
    name: "author",
    message: "Author",
  },
}));

const OPTION_TYPES = new Map(Object.entries({
  projectDir: "string",
  jsFramework: "string",
  typescript: "boolean",
  codeFormatters: "array",
  sass: "boolean",
  cssFramework: "string",
  bundler: "string",
  plugins: "array",
  license: "string",
  author: "string",
}));

const OPTION_TYPE_CHECKS = new Map(Object.entries({
  projectDir: opt => typeof opt === "string",
  jsFramework: opt => typeof opt === "string",
  typescript: opt => typeof opt === "boolean",
  codeFormatters: opt => Array.isArray(opt),
  sass: opt => typeof opt === "boolean",
  cssFramework: opt => typeof opt === "string",
  bundler: opt => typeof opt === "string",
  plugins: opt => Array.isArray(opt),
  license: opt => typeof opt === "string",
  author: opt => typeof opt === "string",
}));

class OptionNameError extends Error {
  constructor(optName) {
    super(styles.errorMsg(`Unknown option: ${optName}`));
    this.name = "OptionNameError";
  }
}

class OptionValueTypeError extends Error {
  constructor(optName, optValue) {
    super(styles.errorMsg(`Expected value of type ${OPTION_TYPES.get(optName)} for ${optName}, received ${typeof optValue}`));
    this.name = "OptionValueTypeError";
  }
}

function validateOptions(options) {
  for (const [optName, optValue] of Object.entries(options)) {
    if (!OPTION_TYPES.has(optName)) {
      throw new OptionNameError(optName);
    }
    if (!OPTION_TYPE_CHECKS.get(optName)(optValue)) {
      throw new OptionValueTypeError(optName, optValue);
    }
  }
}
// TODO: Add value validation

function displayDefaults() {
  console.log(styles.cyanBright("\n  Default settings"));

  for (const [optName, optValue] of Object.entries(DEFAULT_OPTIONS)) {
    console.log(`    ${`${styles.whiteBold(optName)}`} ${optValue}`);
  }
  console.log("");
}

function applyDefaultsToPrompts() {
  for (const [optName, optValue] of Object.entries(DEFAULT_OPTIONS)) {
    if (typeof optValue === "string") {
      const targetPrompt = PROMPTS.get(optName);
      if (targetPrompt.type === "text" || targetPrompt.name === "author") {
        // Project dir, author
        targetPrompt.initial = optValue;
      } else if (targetPrompt.type === "select") {
        // JS framework, CSS framework, bundler, license
        targetPrompt.initial = (
          targetPrompt.choices.findIndex(c => c.value === optValue)
        );
      }
    } else if (typeof optValue === "boolean") { // TypeScript, Sass
      PROMPTS.get(optName).initial = optValue;
    } else if (Array.isArray(optValue)) { // Code formatters, plugins
      for (const choice of PROMPTS.get(optName).choices) {
        if (optValue.includes(choice.value)) {
          choice.selected = true;
        }
      }
    } else {
      console.error(styles.fatalError("Error while processing default settings"));
      throw new OptionValueTypeError(optName, optValue);
    }
  }
}

function onCancel() {
  console.log(styles.fatalError("\nKeyboard exit\n"));
  process.exit(1);
}

module.exports = async function getOptions() {
  let projectDir;
  let cliOptions = new commander.Command(PACKAGE_JSON.name)
    .version(PACKAGE_JSON.version)
    .arguments("[project-dir]") // No prefix required
    .usage(`${styles.cyanBright("[project-directory]")} [other options]`)
    .action(pd => { projectDir = pd; })
    .description("Start a new custom Snowpack app.")
    .option("-d, --defaults", "Use default settings")
    .option(
      "-jsf, --js-framework <framework>",
      [
        "JavaScript framework <",
        PROMPTS.get("jsFramework").choices
          .map(framework => framework.value).join("/"),
        ">",
      ].join("")
    )
    .option(
      "-cdf, --code-formatters <formatters...>",
      [
        "Code formatters",
        "-".repeat(10),
        PROMPTS.get("codeFormatters").choices
          .map(cf => `<${cf.value}> (${cf.title})`).join("\n"),
        "-".repeat(10),
      ].join("\n")
    )
    .option("-ts, --typescript", "Use TypeScript")
    .option("-nts, --no-typescript", "Don't use TypeScript")
    .option("-s, --sass", "Use Sass")
    .option("-ns, --no-sass", "Don't use Sass")
    .option(
      "-cssf, --css-framework <framework>",
      `CSS Framework <${PROMPTS.get("cssFramework").choices
        .map(cf => cf.value).join("/")}>`,
    )
    .option(
      "-b, --bundler <bundler>",
      `Bundler <${PROMPTS.get("bundler").choices
        .map(bundler => bundler.value).join("/")}>`,
    )
    .option(
      "-p, --plugins <plugins...>",
      [
        "Other plugins",
        "-".repeat(10),
        PROMPTS.get("plugins").choices
          .map(p => `<${p.value}> (${p.title})`).join("\n"),
        "-".repeat(10),
      ].join("\n")
    )
    .option(
      "-l, -license <license>",
      `License <${PROMPTS.get("license").choices
        .map(license => license.value).join("/")}>`,
    )
    .option("-a, --author <author>", "Author")
    .on("-h", displayDefaults)
    .on("--help", displayDefaults)
    .parse(process.argv)
    .opts();

  if (projectDir) {
    cliOptions = { projectDir, ...cliOptions };
  }
  // TODO: Other installers
  //  TODO: skip procecesses
  // console.log(cliOptions);

  const options = {};
  if (cliOptions.defaults) {
    try {
      validateOptions(DEFAULT_OPTIONS);
    } catch (error) {
      console.error(styles.fatalError("Error while processing default settings"));
      console.error(error.message);
      process.exit(1);
    }

    Object.assign(options, JSON.parse(JSON.stringify(DEFAULT_OPTIONS)));
    // Quick and dirty deep copy
    delete cliOptions.defaults;

    console.log(styles.cyanBright("\n-- Default options --"));
    for (const [optName, optValue] of Object.entries(options)) {
      let optMessage = styles.whiteBold(PROMPTS.get(optName).message);
      if (cliOptions.hasOwnProperty(optName)) {
        optMessage = `${styles.errorMsg("×")} ${optMessage}`;
      } else {
        optMessage = `${styles.successMsg("√")} ${optMessage}`;
      }
      console.log(`${optMessage} ${optValue}`);
    }
  }

  if (Object.keys(cliOptions).length) {
    console.log(styles.cyanBright("\n-- CLI options --"));
    for (const [optName, optValue] of Object.entries(cliOptions)) {
      const optMessage = styles.whiteBold(`${PROMPTS.get(optName).message}: `);
      console.log(`${styles.successMsg("√")} ${optMessage}${optValue}`);
    }
    Object.assign(options, cliOptions);
  }

  const remainingPrompts = (
    [...PROMPTS.keys()]
      .filter(k => !options.hasOwnProperty(k))
      .map(k => PROMPTS.get(k))
  );
  if (remainingPrompts.length) {
    applyDefaultsToPrompts();
    if (Object.keys(options).length) {
      console.log(styles.cyanBright("\n-- Remaining options --"));
    } else {
      console.log(styles.cyanBright("\n-- Options --"));
    }
    Object.assign(options, await prompts(remainingPrompts, { onCancel }));
  }

  if (options.license === "mit" && !options.hasOwnProperty("author")) {
    options.author = await prompts(
      { type: "text", name: "author", message: "Author" }, { onCancel }
    ).author;
  }

  if (options.jsFramework === "none") {
    options.jsFramework = "blank";
  }
  for (const optKey of ["cssFramework", "bundler", "license"]) {
    if (options[optKey] === "none") {
      options[optKey] = null;
    }
  }

  // console.log(options);

  return options;
};
