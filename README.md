# DigiKeyboardTester

The USB Development Board based on an Attiny85 from [Digispark](http://digistump.com/products/1) can act as a Keyboard.
The default library by [Digispark](https://github.com/digistump/DigistumpArduino) only supports the English Keyboard Layout but some engineers forked their work and managed to create switchable layouts.

This project takes the *keylayout.h* file and generates a test.ino. With that you can test many layouts at once, without flashing again<sup>[1](#1)</sup>. So if you are one of these cool engineers, you can test and modify your *keylayout.h* faster and easier.

This project was developed with [Node.JS](https://nodejs.org/en/). If you don't have it, there is also an EXE. If you want to modify its behavior, you need Node.JS though. Just place *keylayout.h* next to it and it will generate a working test.ino in the folder test. Attention: It will replace an existing one.

This program does not support chars with ISO_8859_1, because many libraries do not support it either.

<a id="1">[1]</a> If there are many layouts the storage of the Attiny85 might not be sufficient, so you have to split the layouts. This program has some logic for that.

## Preparation

Copy your existing *keylayout.h* file into this project folder. You could also take my, which is taken from the library by [ArminJo](https://github.com/ArminJo/DigistumpArduino).

In order to change the layout at runtime, it needs access to *keycodes_ascii* located at the end of *keylayout.h*. So please change it from:

`const KEYCODE_TYPE keycodes_ascii[] PROGMEM`

to

`KEYCODE_TYPE keycodes_ascii[]`

Because it's now not longer stored in PROGMEM, the access to this variable has changed, so go into *DigiKeyboard.h* and change this line in the write-Function:

`data = pgm_read_byte_near(keycodes_ascii + (chr - 0x20));`

to

`data = keycodes_ascii[chr - 0x20];`

The given test/test.ino should compile without problems.

Because of these changes `DigiKeyboard.print` and `DigiKeyboard.println` do not longer work with strings only char-Arrays are accepted. It's strange but otherwise only a blank line gets printed.

You can now test your key codes and see where problems might be. Just do some modifications in the *keylayout.h*, run the program and upload. So you don't have to copy anything to `\AppData\Local\Arduino15\packages\digistump\hardware\avr\1.7.0\libraries\DigisparkKeyboard\` or something like that.

The Arduino IDE does not support hot reload of files, so you have to close the opened one and reopen the new file, better use Platform IO here.

When finished correcting a language, just take the new *keylayout.h*, revert all *keycodes_ascii*-changes and you can release it.

## Working example

*keylayout.h* (wouldn't work, just for demonstration):

```C
#define LAYOUT_UNSPECIFIED

#define KEY_1           ( 0x1E | 0xF000 )    // Keyboard 1 and !
#define KEY_2           ( 0x1F | 0xF000 )    // Keyboard 2 and
#define KEY_3           ( 0x20 | 0xF000 )    // Keyboard 3 and #
#define KEY_4           ( 0x21 | 0xF000 )    // Keyboard 4 and $
#define KEY_5           ( 0x22 | 0xF000 )    // Keyboard 5 and %
#define KEY_6           ( 0x23 | 0xF000 )    // Keyboard 6 and ^
#define KEY_7           ( 0x24 | 0xF000 )    // Keyboard 7 and &
#define KEY_8           ( 0x25 | 0xF000 )    // Keyboard 8 and *
#define KEY_9           ( 0x26 | 0xF000 )    // Keyboard 9 and (

#ifdef LAYOUT_US_INTERNATIONAL

#define SHIFT_MASK      0x0040

#define ASCII_23        KEY_3 + SHIFT_MASK   // 35 #
#define ASCII_24        KEY_4 + SHIFT_MASK   // 36 $
#define ASCII_25        KEY_5 + SHIFT_MASK   // 37 %
#define ASCII_32        KEY_2                // 50 2

#endif
```

As you can see there are key codes which work for any layout. The layout US_INTERNATIONAL uses them. After my programs magic the test.ino would look like this:

```C
#include "DigiKeyboard.h"

const uint16_t US_INTERNATIONAL[] PROGMEM = {61484, 61534, 62764, 61536, 61537, 61538, 61540, 61996};

const char TEST_STRING[] PROGMEM = {"abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"};

void setup() {
  DigiKeyboard.sendKeyStroke(0);
  byte PART = 1;

  switch (PART) {
    case (1):
      test((char*) "US INTERNATIONAL       ", US_INTERNATIONAL);
      break;
  }
}

void test(char name[], const uint16_t language[]) {
  for (byte i = 0; i < 96; i++)
    keycodes_ascii[i] = pgm_read_byte_near(language + i);
  
  DigiKeyboard.print(name);
  for (byte i = 0; i < strlen_P(TEST_STRING); i++)
    DigiKeyboard.print((char) pgm_read_byte_near(TEST_STRING + i));
  DigiKeyboard.println();
}

.
.
.
```

The key codes were imported, parsed and converted to the correct values, they got placed into the US_INTERNATIONAL-Array. This would happen for each language.

TEST_STRING contains all ASCII-Letters to test a language on.

As hint [1](#1) said, the tests get separated to save storage (the switch-Statement). So you could test PART 1, then increase the counter and upload again. Really easy.

The test-Function takes the key codes, puts them into *keycodes_ascii* and prints the language name and the letters.

## Customization

To customize the behavior you need to install Node.JS.

You can change how many tests are allowed in one case-Statement, search for `maxGroupSize`.

You could also change the test-string. Don't forget, it has to be double escaped, one time for JavaScript and one for C, search for `TEST_STRING`.
