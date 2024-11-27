/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["react-app"],
  plugins: ["@stylistic", "@stylistic/ts", "@stylistic/js"],
  settings: {
    "import/resolver": {
      typescript: true,
    },
  },
  ignorePatterns: [
    "dist",
    "lib",
    "/src/client/shadcn",
    "/src/client/tailwind-styled-component",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        args: "none",
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            target: "./server",
            from: "./client",
          },
          {
            target: "./client",
            from: "./server",
          },
        ],
      },
    ],
    "import/no-anonymous-default-export": "off",
    curly: ["warn", "all"],
    "@stylistic/js/block-spacing": ["warn", "always"], // needs 'js' cuz ts rule is overbroad
    "@stylistic/padded-blocks": ["warn", "never"],
    "@stylistic/space-before-blocks": ["warn", "always"],
  },
};
