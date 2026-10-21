import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: ["coverage/**", "playwright-report/**", "test-results/**"],
  },
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
