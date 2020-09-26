const fs = require("fs");
const strip = require("strip-comments");

/**
 * Takes a string and extracts its defines.
 * 
 * Example (taken from LAYOUT_US_ENGLISH):
 * 
 * #define SHIFT_MASK   0x40
 * #define ASCII_21     KEY_1 + SHIFT_MASK
 * 
 * The value 0x40 will be stored with the key KEYCODE_MASK.
 * In the next line, there are keys within the value, so they will be looked up. SHIFT_MASK can be found, KEY_1 not. Now it tries to find it in map (second argument). If I can't be found an error will be trown.
 * 
 * map is the result of an other call to generate.
 */
function generate(string, map = {}) {
	const pair = {};
	const format = string
		.split("\n")
		.map(a => {
			a = a.replace("#define ", "");
			const index = a.indexOf(" ");
			const key = a.slice(index + 1).trim();
			return [a.slice(0, index), key.includes(" + ") ? key.split(" + ") : [key]];
		});

	format.forEach(([name, keys]) => {
		if (name === "KEYCODE_TYPE")
			return;

		const parts = [];

		keys.forEach(key => {
			if (pair[key])
				parts.push(pair[key]);
			else if (map[key])
				parts.push(map[key]);
			else {
				try {
					parts.push(eval(key));
				} catch (error) {
					console.error("Can't convert:", name, key);
				}
			}
		});

		pair[name] = parts.reduce((all, cur) => all + cur, 0);
	});

	return pair;
}

// load keylayout file and remove comments
const keyLayouts = strip(fs.readFileSync("./keylayouts.h") + "")
	.split("\n")
	.map(a => a.trim())
	.filter(a => a.length > 0)
	.join("\n");

// extract LAYOUT_UNSPECIFIED & generate pairs
const defaultStart = keyLayouts.indexOf("#define LAYOUT_UNSPECIFIED") + 27;
const defaultEnd = keyLayouts.indexOf("#ifdef LAYOUT_US_INTERNATIONAL", defaultStart) - 1;

const DEFAULT = keyLayouts.slice(defaultStart, defaultEnd);
const DEFAULT_PAIRS = generate(DEFAULT);

// extract all Languages only to #define ASCII_7F, ISO_8859_1 is currently not supported by DigiKeyboard
let last = defaultEnd;
const LANGUAGES = {};
while (true) {
	last = keyLayouts.indexOf("#ifdef LAYOUT_", last) + 14;
	const lastAscii = keyLayouts.indexOf("#define ASCII_7F", last);

	const nameEnd = keyLayouts.indexOf("\n", last - 1);
	const textEnd = keyLayouts.indexOf("\n", lastAscii);

	const name = keyLayouts.slice(last, nameEnd);
	const text = keyLayouts.slice(nameEnd + 1, textEnd);

	if (name === "UNSPECIFIED")
		break;

	LANGUAGES[name] = text;
}

// Generate a string containing all languages with its keycodes
let LANGUAGE_KEYCODES = "";
for (const name in LANGUAGES) {
	const pair = generate(LANGUAGES[name], DEFAULT_PAIRS);

	LANGUAGE_KEYCODES += "const uint16_t " + name + "[] PROGMEM = {";
	for (let i = 0; i < 96; i++) {
		LANGUAGE_KEYCODES += `${pair["ASCII_" + (i + 0x20).toString(16).toUpperCase()]}`;
		if (i < 95)
			LANGUAGE_KEYCODES += ", ";
		else
			LANGUAGE_KEYCODES += "};\n";
	}
}

// Generate a string with a call to the test function in c
const maxGroupSize = 8;
let lastSplit = 1;
let CALL_TO_TEST = `byte PART = 1;

  switch (PART) {
`;
const LANGUAGE_NAMES = Object.keys(LANGUAGES);
const maxNameLength = Math.max(...LANGUAGE_NAMES.map(a => a.length)) + 2;
const DEFAULT_LANGUAGE = `test((char*) "${"US ENGLISH".padEnd(maxNameLength, " ")}");`;
for (let i = 0; i < LANGUAGE_NAMES.length; i++) {
	if (i % maxGroupSize === 0) {
		if (lastSplit > 1)
			CALL_TO_TEST += "      break;\n\n";
		CALL_TO_TEST += "    case (" + lastSplit++ + "):\n"
	}

	const name = LANGUAGE_NAMES[i].replace(/_/g, " ").padEnd(maxNameLength, " ");
	CALL_TO_TEST += `      test((char*) "${name}", ${LANGUAGE_NAMES[i]});\n`;
}
CALL_TO_TEST += "      break;\n  }";

const TEST_STRING = "abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890 !\\\"#$%&'()*+,-./:;<=>?@[\\\\]^_`{|}~";

const template = `#define LAYOUT_US_ENGLISH
#include "DigiKeyboard.h"

__LANGUAGE_KEYCODES__
const char TEST_STRING[] PROGMEM = {"__TEST_STRING__"};

void setup() {
  DigiKeyboard.sendKeyStroke(0);
  __DEFAULT_LANGUAGE__

  __CALL_TO_TEST__
}

void loop() {
  delay(100);
}

void test(char name[]) {
  DigiKeyboard.print(name);
  for (byte i = 0; i < strlen_P(TEST_STRING); i++)
    DigiKeyboard.print((char) pgm_read_byte_near(TEST_STRING + i));
  DigiKeyboard.println();
}

void test(char name[], const uint16_t language[]) {
  for (byte i = 0; i < 96; i++)
    keycodes_ascii[i] = pgm_read_byte_near(language + i);
  test(name);
}

/*
  Click here and let it write:



*/`;

if (!fs.existsSync("test"))
	fs.mkdirSync("test");

fs.writeFileSync("test/test.ino", template
	.replace("__LANGUAGE_KEYCODES__", LANGUAGE_KEYCODES)
	.replace("__TEST_STRING__", TEST_STRING)
	.replace("__DEFAULT_LANGUAGE__", DEFAULT_LANGUAGE)
	.replace("__CALL_TO_TEST__", CALL_TO_TEST)
);

console.log("Successfully generated test/test.ino.");
console.log("Exported languages:", LANGUAGE_NAMES.join(", "));
