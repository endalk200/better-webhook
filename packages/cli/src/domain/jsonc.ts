export const stripJsonComments = (input: string): string => {
	let output = "";
	let inString = false;
	let escaped = false;
	let inLineComment = false;
	let inBlockComment = false;

	for (let index = 0; index < input.length; index += 1) {
		const current = input[index] ?? "";
		const next = input[index + 1] ?? "";

		if (inLineComment) {
			if (current === "\n" || current === "\r") {
				inLineComment = false;
				output += current;
			}
			continue;
		}

		if (inBlockComment) {
			if (current === "*" && next === "/") {
				inBlockComment = false;
				index += 1;
				continue;
			}
			output += current === "\n" || current === "\r" ? current : " ";
			continue;
		}

		if (inString) {
			output += current;
			if (escaped) {
				escaped = false;
				continue;
			}
			if (current === "\\") {
				escaped = true;
				continue;
			}
			if (current === '"') {
				inString = false;
			}
			continue;
		}

		if (current === '"') {
			inString = true;
			output += current;
			continue;
		}

		if (current === "/" && next === "/") {
			inLineComment = true;
			index += 1;
			continue;
		}

		if (current === "/" && next === "*") {
			inBlockComment = true;
			index += 1;
			continue;
		}

		output += current;
	}

	return output;
};

export const parseJsonc = (input: string): unknown => JSON.parse(stripJsonComments(input));
