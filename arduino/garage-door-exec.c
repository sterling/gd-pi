
#include <SPI.h>
#include "nRF24L01.h"
#include "RF24.h"
#include "sha256.h"
#include "printf.h"

const uint8_t doorTopInput = 2;
const uint8_t doorBotInput = 3;
const uint8_t doorControlOutput = 4;
const uint8_t DOOROPEN = 1;
const uint8_t DOORCLOSED = 0;
const uint8_t DOORTRANS = 2;

RF24 radio(7, 8);

byte addr[][6] = {"1Node", "2Node"};
const uint8_t secretKey[32] = {};

const int maxPayloadLen = 32;
char payload[maxPayloadLen + 1];
unsigned long lastDoorAction = 0;

void setup() {
  Serial.begin(9600);
  printf_begin();
  printf("=======================================\n");

  pinMode(doorControlOutput, OUTPUT);

  radio.begin();
  radio.setRetries(15, 15);
  radio.setDataRate(RF24_1MBPS);
  radio.setChannel(0x4c);
  radio.setCRCLength(RF24_CRC_16);
  radio.enableDynamicPayloads();

  radio.openWritingPipe(addr[1]);
  radio.openReadingPipe(1, addr[0]);

  radio.startListening();
  radio.printDetails();
}

void loop() {
  if (radio.available()) {
    uint8_t len = radio.getDynamicPayloadSize();
    
    radio.read(payload, len);
    payload[len] = 0;
    
    printf("payload: ");
    for (int i = 0; i < len; i++) {
      printf("%02X, ", (uint8_t)payload[i]);
    }
    printf("\n");

    uint8_t messageType = payload[0];

    if (messageType == 0xff) { // nonce request
      sendNonce();
    } else if (messageType == 0xaa) { // secure command
      uint8_t messageLen = len - 29;
      uint8_t hmacLen = 28;
      char hmac[hmacLen];
      char message[messageLen + 1];
      memcpy(hmac, payload + 1, hmacLen);
      memcpy(message, payload + 29, messageLen);;
      message[messageLen] = 0;

      printf("HMAC: %i\n", validHmac(hmac, message, hmacLen));

      if (validHmac(hmac, message, hmacLen)) {
        switch (message[0]) {
          case 0x01:
            sendDoorState();
            break;
          case 0x02:
            toggleDoor();
            break;
        } 
      }
    }
    
  }

  if (getDoorState() == DOOROPEN) {
    digitalWrite(doorControlOutput, HIGH);
  } else {
    digitalWrite(doorControlOutput, LOW);
  }
}

void toggleDoor() {
  unsigned long now = millis();
  printf("toggling door %ld\n", now - lastDoorAction);
  if (now - lastDoorAction > 1000) {
    lastDoorAction = now;
    digitalWrite(doorControlOutput, HIGH);
    delay(1000);
    digitalWrite(doorControlOutput, LOW);
  }
}

// 0 = closed, 1 = open, 2 = in transition
uint8_t getDoorState() {
  int doorTop = digitalRead(doorTopInput);
  int doorBot = digitalRead(doorBotInput);

  return doorTop == HIGH ? DOOROPEN : doorBot == HIGH ? DOORCLOSED : DOORTRANS;
}

void sendDoorState() {
  radio.stopListening();
  
  uint8_t state = getDoorState();
  printf("doorstate: %i\n", state);
  radio.write(&state, 1);
  
  radio.startListening();
}

bool validHmac(char *hmac, char *message, uint8_t len) {
  uint8_t *checkHash;
  Sha256.initHmac(secretKey, 32);
  Sha256.print(message);
  checkHash = Sha256.resultHmac();
  checkHash[224] = 0;

  for (int i = 0; i < len; i++) {
    if (checkHash[i] != (uint8_t)hmac[i]) {
      return false;
    }
  }
  return true;
}

void sendNonce() {
  radio.stopListening();
  
  unsigned long nonce = millis();
  char mlen = 2 + sizeof(long);
  char message[mlen];
  message[0] = 0xff;
  message[1] = sizeof(long);
  memcpy(message + 2, &nonce, message[1]);
  radio.write(message, mlen);
  
  radio.startListening();
}

