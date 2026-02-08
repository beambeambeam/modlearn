import type { UserConfig } from "@commitlint/types";

const Configuration: UserConfig = {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"scope-empty": [0],
		"scope-case": [0],
	},
};

export default Configuration;
